---
title: "RAG Architecture"
description: "Retrieval-Augmented Generation (RAG) is the foundational architecture powering AI-driven knowledge retrieval across Acme Corporation. Rather than rely"
---

# RAG Architecture

## RAG Architecture Overview

Retrieval-Augmented Generation (RAG) is the foundational architecture powering AI-driven knowledge retrieval across Acme Corporation. Rather than relying solely on a large language model’s parametric knowledge — which may be outdated or lack Acme-specific context — the RAG pipeline retrieves relevant documentation from Acme Corp’s indexed knowledge bases before generating a response. This ensures that AI-generated answers are grounded in authoritative, current, organization-specific content.

The RAG pipeline powers the following capabilities across the enterprise:

| Capability | Consumers | Description |
|---|---|---|
| Copilot Knowledge Bases | All subsidiary engineers (~8,000 users) | Context-aware Copilot Chat grounded in internal docs, ADRs, runbooks |
| Customer-Facing AI Assistants | Acme Retail (shopping assistant), Acme FSI (wealth advisory chatbot) | Production assistants serving external customers with domain-specific knowledge |
| Internal Search Portal | All Acme Corp employees | Unified search across all non-restricted documentation |
| Automated Documentation Generation | Acme Tech DevEx team | Draft generation for release notes, incident summaries, onboarding guides |

The pipeline operates under a core design principle: **retrieval accuracy is more important than generation fluency.** A fluent but hallucinated answer is worse than a less polished answer grounded in retrieved facts. Every design decision — chunking strategy, embedding model selection, hybrid search configuration — optimizes for retrieval precision and recall.

For the data platform infrastructure that hosts the RAG pipeline, see [Data Platform Overview](./platform-overview.md).

---

## RAG Pipeline Design

The end-to-end RAG pipeline consists of six stages, from document ingestion through response generation.

### Stage 1 — Ingest

Document ingestion is event-driven. A GitHub Actions webhook fires on every merge to the default branch of any Acme Corp repository. The webhook payload identifies changed files, which are filtered to content types eligible for indexing:

| Source Type | Format | Origin |
|---|---|---|
| Knowledge base articles | Markdown (`.md`) | Git repositories (primary source) |
| Legacy documentation | Confluence exports (HTML to Markdown) | One-time migration, maintained in Git going forward |
| API specifications | OpenAPI 3.x (YAML/JSON) | Git repositories, auto-generated from code annotations |
| Operational runbooks | Markdown (`.md`) | Git repositories, reviewed by on-call teams quarterly |

Files matching exclusion patterns (defined in `.ragignore` at repository root) are skipped. Binary files, images, and auto-generated lock files are excluded by default.

### Stage 2 — Chunk

Documents are split into chunks optimized for embedding quality and retrieval precision.

**Chunking algorithm:** Heading-aware Markdown splitting. The splitter respects Markdown structure, breaking documents at H2 (`##`) and H3 (`###`) boundaries. Each chunk is prefixed with its heading hierarchy (e.g., `# RAG Architecture > ## Pipeline Design > ### Stage 2 — Chunk`) to preserve context.

**Parameters:**

| Parameter | Value | Rationale |
|---|---|---|
| Target chunk size | 500 tokens | Balances embedding precision with sufficient context per chunk |
| Overlap | 50 tokens | Prevents information loss at chunk boundaries |

**Metadata attached per chunk:**

- `source_path` — Full file path within the repository (e.g., `acme-tech/data/rag-architecture.md`)
- `section_heading` — Heading hierarchy for the chunk
- `subsidiary` — Owning subsidiary, derived from repository organization
- `last_modified` — Git commit timestamp of the most recent change to the source file
- `author` — Git author of the most recent commit
- `classification` — Data classification level (Public, Internal, Confidential, Restricted) from document frontmatter

### Stage 3 — Embed

Each chunk is converted to a 1536-dimensional vector using Azure OpenAI’s `text-embedding-ada-002` model.

Embedding requests are batched and rate-limited to stay within the Azure OpenAI deployment’s token budget (60,000 tokens per minute). A retry queue with exponential backoff handles transient throttling. For a typical documentation merge affecting 10 to 50 files, embedding completes within two to five minutes.

### Stage 4 — Index

Embedded chunks are upserted into the appropriate Azure AI Search index. The index schema is designed for hybrid search (keyword + vector):

| Field | Type | Behavior |
|---|---|---|
| `id` | String | Unique chunk identifier (hash of source_path + heading + chunk offset) |
| `content` | String (searchable) | Full text of the chunk, used for BM25 keyword matching |
| `content_vector` | Vector (1536 dimensions) | Embedding vector, used for cosine similarity scoring |
| `source_path` | String (filterable, facetable) | Repository file path for provenance tracking |
| `subsidiary` | String (filterable, facetable) | Owning subsidiary for permission-filtered retrieval |
| `section_heading` | String (searchable) | Heading hierarchy for context and display |
| `last_modified` | DateTimeOffset (filterable, sortable) | Source file modification timestamp |
| `classification` | String (filterable) | Data classification level for access control |

### Stage 5 — Retrieve

At query time, the retrieval engine executes a hybrid search combining keyword and vector approaches:

1. **BM25 keyword search** against the `content` field — excels at exact term matches, acronyms (e.g., "ADR-001"), error codes, and configuration keys.
2. **Cosine similarity search** against the `content_vector` field — excels at semantic matching, paraphrases (e.g., "how to set up authentication" matches documentation titled "Identity and Access Management Configuration"), and conceptual queries.
3. **Reciprocal Rank Fusion (RRF)** merges the two ranked result lists with parameter `k=60`.

Top-K is set to 5 — the five highest-scoring chunks after fusion are passed to the generation stage.

### Stage 6 — Generate

The retrieved chunks are injected into a GPT-4o prompt as grounding context. The system prompt enforces strict grounding rules:

- Answers must be based exclusively on retrieved context.
- If the retrieved context does not contain sufficient information, the model must state this explicitly rather than speculate.
- Citations to source documents (file path and section heading) are required in every response.

---

## Knowledge Base Management per Subsidiary

Each subsidiary’s documentation is indexed into a dedicated Azure AI Search index, ensuring content isolation and enabling subsidiary-specific search tuning.

### Index Inventory

| Index Name | Primary Content | Approximate Chunks |
|---|---|---|
| `idx-acme-tech` | Platform docs, governance, DevEx standards, architecture decisions | 42,000 |
| `idx-acme-retail` | Retail services, inventory, order fulfillment, POS integration | 38,000 |
| `idx-acme-fsi` | Trading platform, risk models, compliance frameworks, KYC/AML | 31,000 |
| `idx-acme-telco` | Network management, BSS/OSS, provisioning, CDR processing | 28,000 |
| `idx-acme-insurance` | Claims processing, underwriting, actuarial documentation, policy admin | 22,000 |
| `idx-acme-distribution` | Route optimization, warehouse management, fleet tracking | 18,000 |
| `idx-acme-media` | Content management, streaming delivery, ad tech, editorial workflow | 15,000 |
| `idx-corporate` | Corporate governance, glossaries, documentation standards, templates | 12,000 |

### Query Routing

When an engineer interacts with Copilot Chat or the internal search portal, the query is routed to their subsidiary’s index plus the `idx-corporate` shared index. This default routing ensures engineers receive relevant subsidiary context augmented by corporate-wide standards.

Cross-subsidiary search (e.g., an Acme Tech engineer querying `idx-acme-retail`) requires explicit opt-in via the search portal’s advanced filters and passes through an access verification check against the user’s Entra ID group memberships and the target index’s access policy.

---

## Embedding Model Selection

### Current Model

The primary embedding model is Azure OpenAI `text-embedding-ada-002`, producing 1536-dimensional vectors.

### Selection Rationale

| Criterion | Assessment |
|---|---|
| Retrieval quality | Evaluated against MTEB benchmark suite; ada-002 provides strong performance across information retrieval, semantic textual similarity, and classification tasks |
| Cost efficiency | Competitive per-token pricing via Azure commitment tier; sufficient for the current corpus of approximately 500,000 total chunks across all indexes |
| Azure-native integration | First-class support in Azure AI Search vector indexing, Azure OpenAI batch API, and Azure Functions SDK |
| Dimensionality | 1536 dimensions — effective for the corpus size without requiring dimensionality reduction |

Ada-002 was evaluated against Cohere embed-v3 and OpenAI text-embedding-3-small. Ada-002 was selected for its balance of retrieval quality, Azure-native support, and operational simplicity. Text-embedding-3-small offers newer architecture but requires additional deployment complexity for non-Azure-native hosting.

### Future Roadmap

The Acme Tech Data Platform team plans to evaluate `text-embedding-3-large` in H2 2025. The model supports Matryoshka dimensionality reduction, which would allow reducing stored vector dimensions (e.g., from 3072 to 1024) while retaining retrieval quality. This is projected to reduce Azure AI Search storage costs by 30 to 40 percent at the current corpus scale.

---

## Chunking Strategy

### Heading-Aware Markdown Splitting

The chunking strategy is purpose-built for Acme Corp’s documentation corpus, which is predominantly structured Markdown.

**Algorithm:**

1. Parse the Markdown document into an AST (Abstract Syntax Tree).
2. Split at H2 (`##`) boundaries. If a resulting section exceeds 500 tokens, split further at H3 (`###`) boundaries.
3. If a section still exceeds 500 tokens after H3 splitting, apply sentence-level splitting with 50-token overlap.
4. Prefix each chunk with the full heading hierarchy: `# Document Title > ## Section > ### Subsection`.

### Special Handling

| Content Type | Handling |
|---|---|
| Tables | Kept intact within a single chunk, even if the table exceeds 500 tokens. Tables are critical for structured reference data and lose meaning when split. |
| Code blocks | Kept intact up to 500 tokens. Code blocks exceeding 500 tokens are split at function or class boundaries (detected via tree-sitter parsing). |
| Frontmatter | Excluded from chunk content but preserved as metadata fields (title, owner, last-updated, status). |
| Inline links | Preserved in chunk text for context, though link targets are not followed or indexed. |

### Rationale

The 500-token target with 50-token overlap was determined through iterative evaluation. Smaller chunks (250 tokens) improved precision but lost context, leading to incomplete answers. Larger chunks (1000 tokens) retained context but reduced retrieval precision by mixing multiple topics within a single vector. The 500-token target consistently produced the best balance in Acme Corp’s evaluation benchmarks using a curated set of 200 questions across all subsidiary knowledge bases.

---

## Hybrid Search Configuration

### Why Hybrid Search

Neither keyword search nor vector search alone provides optimal retrieval across Acme Corp’s diverse query patterns:

| Query Type | Best Approach | Reasoning |
|---|---|---|
| Exact identifiers (`ADR-001`, `ACME-RETAIL-429`, `INCIDENT-2025-0142`) | Keyword (BM25) | Exact token match — vector search may return semantically similar but wrong identifiers |
| Error codes and config keys (`ERROR_SNOWFLAKE_TIMEOUT`, `APIM_RATE_LIMIT_EXCEEDED`) | Keyword (BM25) | Precise string matching outperforms approximate semantic matching |
| Conceptual queries ("how do I set up a new data share between subsidiaries?") | Vector (cosine) | Semantic understanding captures intent even when query wording differs from documentation |
| Paraphrased questions ("what is the process for onboarding a new ML model?") | Vector (cosine) | Matches against documentation titled "ML Model Governance — Model Lifecycle" despite different phrasing |
| Mixed queries ("ADR-001 authentication approach for Retail") | Hybrid | Combines exact match on "ADR-001" with semantic match on "authentication approach" |

### Fusion Algorithm — Reciprocal Rank Fusion (RRF)

The BM25 and vector result lists are merged using Reciprocal Rank Fusion with parameter `k=60`:

```
RRF_score(document) = sum of  1 / (k + rank_i)
```

Where `rank_i` is the document’s rank in each contributing search method. The `k` parameter controls the influence of rank position — a higher `k` reduces the gap between ranks, giving more weight to documents that appear in both lists even if their individual ranks differ. Azure AI Search’s default `k=60` has proven effective in Acme Corp’s evaluation and has not been tuned.

---

## Permission-Filtered Retrieval

Retrieval security is enforced at query time through mandatory OData filter expressions applied before scoring. No unauthorized content is ever scored or returned, even partially.

### Subsidiary Filter

Every query includes a mandatory subsidiary filter. An Acme Retail engineer’s query is automatically scoped:

```
filter: subsidiary eq 'acme-retail' or subsidiary eq 'corporate'
```

This ensures that FSI compliance documentation, Insurance actuarial models, and other subsidiary-specific content are never surfaced to unauthorized users — even if the vector similarity score is high.

### Classification Filter

The user’s clearance level (derived from Entra ID group membership) determines which classification levels are searchable:

| User Role | Searchable Classification Levels |
|---|---|
| Standard Engineer | Public, Internal |
| Senior Engineer / Tech Lead | Public, Internal, Confidential (own subsidiary only) |
| Data Steward / Compliance Officer | Public, Internal, Confidential, Restricted (own subsidiary only) |

The classification filter is appended to every query:

```
filter: (classification eq 'Public' or classification eq 'Internal') and (subsidiary eq 'acme-retail' or subsidiary eq 'corporate')
```

### Implementation Note

Filters are applied as **pre-filters** — they restrict the candidate document set before BM25 scoring and vector similarity computation. This is a deliberate design choice: pre-filtering guarantees that no unauthorized document influences the result ranking, even indirectly. Post-filtering (scoring first, filtering second) would risk leaking relevance signals from restricted content.

The `idx-corporate` index is always included in the subsidiary filter, ensuring that every engineer has access to corporate governance, documentation standards, and shared technical guidance regardless of subsidiary affiliation.

---

## Content Freshness and Re-Indexing

### Event-Driven Incremental Re-Indexing

The primary re-indexing mechanism is event-driven, triggered by GitHub Actions webhooks:

1. **Trigger:** Merge to the default branch fires a repository dispatch event.
2. **Azure Function:** An Azure Function receives the webhook payload, identifies changed Markdown files by comparing the merge commit to its parent.
3. **Re-chunk:** Changed files are re-processed through the chunking pipeline. Chunks corresponding to deleted or modified sections are removed; new and updated chunks are generated.
4. **Re-embed:** New and modified chunks are sent to the `text-embedding-ada-002` model for vectorization.
5. **Upsert:** Updated chunks are upserted into the appropriate Azure AI Search index. Chunk IDs (hash of source path + heading + offset) ensure idempotent updates.

**Latency:** End-to-end, from merge commit to searchable content, the pipeline completes in under fifteen minutes for typical documentation changes (fewer than fifty files). Large-scale migrations (e.g., repository restructuring) may take up to one hour.

### Scheduled Full Re-Index

A full re-index of all documentation across all indexes runs weekly on Sunday at 02:00 UTC. This ensures consistency by reconciling any drift between Git content and indexed content (e.g., from transient pipeline failures or schema migrations). The full re-index processes all Markdown files in all Acme Corp repositories, re-chunks, re-embeds, and replaces all index content atomically.

### Monitoring and Alerting

| Condition | Severity | Alert Channel |
|---|---|---|
| Incremental pipeline failure | P2 | `#data-platform-alerts` Slack, PagerDuty (Acme Tech Data Platform on-call) |
| Incremental latency > 30 minutes | P3 | `#data-platform-alerts` Slack |
| Document count regression > 5% (indicates mass deletion or pipeline bug) | P2 | `#data-platform-alerts` Slack, PagerDuty |
| Weekly full re-index failure | P2 | PagerDuty |
| Embedding API throttling > 10 minutes sustained | P3 | `#data-platform-alerts` Slack |

All pipeline metrics (execution count, duration, chunk count, embedding latency, upsert count) are published to Datadog and visualized on the Data Platform Operations dashboard. The dashboard is reviewed daily by the on-call platform engineer.

For the broader data platform context, see [Data Platform Overview](./platform-overview.md). For the architecture decisions governing the overall Acme Tech platform, see [Architecture Overview](../architecture/overview.md).
