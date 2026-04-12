---
title: "Data Platform Overview"
description: "The Acme Tech Data Platform is the centralized data infrastructure, AI services, and governance layer that serves all Acme Corporation subsidiaries. T"
---

# Data Platform Overview

## Data Platform Mission

The Acme Tech Data Platform is the centralized data infrastructure, AI services, and governance layer that serves all Acme Corporation subsidiaries. The platform exists to ensure that every subsidiary — from Acme Retail’s demand forecasting to Acme Financial Services’ fraud detection — can leverage enterprise-grade data and AI capabilities without building and maintaining independent data infrastructure.

The platform’s core competencies are:

| Competency | Description |
|---|---|
| Analytical Data Warehousing | Centralized, governed data warehouse with per-subsidiary isolation and cross-subsidiary sharing |
| Knowledge Retrieval (RAG) | Retrieval-Augmented Generation pipeline powering Copilot knowledge bases and AI assistants |
| ML Model Management | Centralized experiment tracking, model registry, and deployment lifecycle governance |
| Cross-Subsidiary Data Sharing | Governed data exchange between subsidiaries with consent management and audit controls |

The guiding principle is **build once, serve many**: every investment in data infrastructure accrues to all six subsidiaries, eliminating redundant tooling and enabling cross-subsidiary intelligence that no subsidiary could achieve independently.

For the RAG pipeline architecture that powers knowledge retrieval, see [RAG Architecture](./rag-architecture.md). For the overall Acme Tech architecture, see [Architecture Overview](../architecture/overview.md).

---

## Data Platform Architecture

The data platform comprises five core services, each selected for its ability to serve multi-tenant workloads with subsidiary-level isolation while centralizing operations and governance.

### Snowflake — Analytical Data Warehouse

Acme Corp operates a single Snowflake Enterprise account hosted on Azure (East US 2 region). Snowflake serves as the primary analytical data warehouse, supporting SQL analytics, data science workloads, and governed data sharing.

**Multi-Tenant Design:**

| Component | Configuration |
|---|---|
| Databases | One per subsidiary: `ACME_RETAIL`, `ACME_FSI`, `ACME_TELCO`, `ACME_INSURANCE`, `ACME_DISTRIBUTION`, `ACME_MEDIA`, plus `ACME_CORPORATE` for shared reference data |
| Role-Based Access | Subsidiary roles (`ACME_RETAIL_ANALYST`, `ACME_FSI_ENGINEER`, etc.) scoped to subsidiary databases only. Cross-database access requires explicit Secure Data Share grant. |
| Virtual Warehouses | Sized per subsidiary workload: XS (Distribution), S (Media, Insurance), M (Retail, Telco), L (Acme Tech platform jobs), XL (FSI regulatory reporting and risk calculations) |
| Secure Data Shares | Read-only, real-time shares between subsidiary databases — no data movement, no copies |

Cost allocation uses Snowflake’s resource monitors with per-subsidiary warehouse budgets. Monthly cost reports are published to subsidiary CFOs via the FinOps dashboard.

### Azure AI Search — Knowledge Retrieval

Azure AI Search (Standard S2 tier) powers the knowledge retrieval layer used by the RAG pipeline, Copilot knowledge bases, and internal search portals.

**Configuration:**

| Aspect | Detail |
|---|---|
| Indexes | Per-subsidiary indexes (`idx-acme-tech`, `idx-acme-retail`, `idx-acme-fsi`, `idx-acme-telco`, `idx-acme-insurance`, `idx-acme-distribution`, `idx-acme-media`) plus `idx-corporate` shared index |
| Search Mode | Hybrid: keyword (BM25) + vector (cosine similarity) with Reciprocal Rank Fusion (RRF) |
| Embedding Model | Azure OpenAI `text-embedding-ada-002` (1536 dimensions) |
| Security | Per-index API keys, query-time OData filters for subsidiary and classification-level scoping |

See [RAG Architecture](./rag-architecture.md) for the full pipeline design, chunking strategy, and retrieval configuration.

### Azure OpenAI — Inference and Embeddings

Azure OpenAI provides the large language model and embedding capabilities used throughout the data platform.

| Model | Deployment | Purpose | Rate Limit |
|---|---|---|---|
| GPT-4o | `acme-gpt4o-prod` | Primary inference for RAG responses, agent reasoning, document generation | Per-subsidiary via Azure API Management (APIM) |
| text-embedding-ada-002 | `acme-ada002-prod` | Document and query embedding for vector search | 60,000 tokens/minute shared, burst via APIM queuing |
| GPT-4o-mini | `acme-gpt4omini-prod` | Lightweight tasks: classification, summarization, metadata extraction | Per-subsidiary via APIM |

Rate limits are enforced per subsidiary through Azure API Management policies. FSI and Retail receive higher allocations given their inference-heavy workloads (fraud detection, customer-facing AI assistants). Usage is tracked in Datadog and billed back to subsidiaries monthly.

Content filtering is enabled on all deployments: hate, self-harm, violence, and sexual content filters are set to the strictest blocking level. Custom blocklists are maintained for Acme-specific prohibited terms.

### Cosmos DB — Platform Metadata Store

Azure Cosmos DB (Serverless tier, NoSQL API) serves as the metadata backbone for the data platform. It stores pipeline execution state, data quality scores, model registry metadata, and RAG pipeline configuration.

**Design:**

| Container | Partition Key | Purpose |
|---|---|---|
| `pipeline-runs` | `subsidiaryId` | ETL/ELT pipeline execution records, status, duration, error logs |
| `data-quality` | `subsidiaryId` | Per-table, per-column quality scores (completeness, accuracy, timeliness) |
| `model-registry` | `subsidiaryId` | ML model metadata — training params, metrics, deployment stage, lineage |
| `rag-config` | `subsidiaryId` | RAG pipeline settings — chunking params, embedding model, index mappings |

Serverless billing ensures cost scales with actual usage rather than provisioned throughput. Global distribution is not enabled — all data resides in the East US 2 region for data residency compliance.

### MLflow — Experiment Tracking and Model Registry

MLflow (open-source, deployed on Azure Kubernetes Service) provides centralized experiment tracking and model lifecycle management for all subsidiary data science teams.

**Configuration:**

| Aspect | Detail |
|---|---|
| Tracking Server | Deployed on AKS, backed by Azure Database for PostgreSQL |
| Artifact Storage | Azure Blob Storage, container per subsidiary |
| Authentication | Entra ID OAuth2, role-based access per subsidiary |
| Model Stages | Development → Staging → Production → Retired |

Subsidiary data scientists log experiments, parameters, metrics, and artifacts to the shared MLflow instance. Model promotion from Staging to Production requires approval by the subsidiary ML lead and an Acme Tech platform engineer. Artifact storage is retained for two years after a model transitions to Retired stage.

---

## Data Governance Framework

Data governance at Acme Corp is enforced through classification, retention policies, and access controls applied consistently across all platform services.

### Data Classification Levels

| Level | Definition | Access Controls | Encryption |
|---|---|---|---|
| Public | Information approved for external disclosure | No restrictions beyond authentication | TLS in transit, AES-256 at rest (platform default) |
| Internal | Business information for all authenticated Acme employees | Entra ID authentication required | TLS in transit, AES-256 at rest (platform-managed key) |
| Confidential | Sensitive subsidiary data — financial reports, strategic plans, customer analytics | Authorized subsidiary users only, role-based access | TLS in transit, AES-256 at rest, Customer-Managed Keys (CMK) for FSI and Insurance |
| Restricted | PII, PHI, trading algorithms, actuarial models, proprietary IP | Strictest controls — named-user access, audit logging on every read/write, dynamic data masking | TLS in transit, AES-256 at rest, CMK mandatory, field-level encryption where applicable |

### Retention Policy

| Data Category | Retention Period | Storage Tier |
|---|---|---|
| Transactional records | 7 years | Hot (1 year) then Cool (6 years) |
| Application and platform logs | 90 days hot, 1 year cold | Hot then Archive |
| ML training datasets | 2 years after model retirement | Cool storage |
| Knowledge base content | Retained while source document exists in Git | Indexed in Azure AI Search |

### PII Management

Azure Purview scans all Snowflake databases and Azure storage accounts weekly to auto-detect and tag PII columns and files. Detected PII is classified at the Restricted level and tagged with the specific PII category (name, email, SSN, health record).

In non-production Snowflake environments, dynamic data masking is applied to all Restricted columns. Engineers working on analytics and model development see masked values (e.g., `***-**-1234` for SSN, `j***@***.com` for email). Production access to unmasked PII requires a time-boxed access grant approved by the subsidiary data steward, logged, and auto-revoked after the approved duration.

Quarterly access reviews are conducted by each subsidiary’s data steward in collaboration with the Acme Tech Data Governance team. Users with Restricted-level access who have not accessed the data in the prior quarter have their access revoked.

---

## Cross-Subsidiary Data Sharing

One of the platform’s most valuable capabilities is governed data sharing between subsidiaries. Snowflake Secure Data Shares enable real-time, read-only access without data duplication or ETL latency.

### Active Data Shares

| Source | Consumer | Data Set | Purpose | Classification | Anonymized |
|---|---|---|---|---|---|
| Acme Retail | Acme Financial Services | Transaction patterns | Cross-channel fraud detection | Confidential | Yes — hashed customer IDs, no PII |
| Acme Financial Services | Acme Insurance | Customer financial profiles | Cross-sell opportunity scoring | Confidential | Consent-based, opt-in only |
| Acme Retail | Acme Media | Product catalog and taxonomy | Content personalization for Acme Media retail-adjacent content | Internal | N/A — no customer data |
| All Subsidiaries | Acme Tech | Infrastructure and FinOps metrics | Cost optimization, capacity planning, platform SLA reporting | Internal | N/A — operational data only |

### Approval Process

New data shares require a pull request to the `acme-tech/data-governance` repository with:

1. Business justification and intended use case.
2. Data classification of shared data set.
3. PII assessment — whether any PII or Restricted data is included.
4. Consent verification — for customer data, evidence that consent frameworks cover the proposed use.
5. Dual approval: source subsidiary data steward and Acme Tech Data Governance lead.

### Guardrails

- **No PII without explicit consent and legal review.** Any share involving customer PII must be reviewed by the Acme Corp Legal team and have a documented consent basis.
- **Automatic expiry.** All data shares expire twelve months after creation. Renewal requires a new PR following the same approval process.
- **Audit logging.** All queries against shared data are logged in Snowflake’s access history and surfaced in the Acme Tech governance dashboard.

---

## ML Model Governance

### Model Lifecycle

All machine learning models deployed at Acme Corp follow a standardized lifecycle managed through the MLflow Model Registry:

| Stage | Activities | Gate |
|---|---|---|
| Development | Train, experiment, log to MLflow. Iterate on features, hyperparameters, architecture. | Self-service — no approval required |
| Staging | Automated validation pipeline: accuracy benchmarks, bias assessment (Fairlearn toolkit), performance profiling, data drift baseline | All automated checks must pass |
| Production | Live inference serving, A/B testing, monitoring | Approval by subsidiary ML lead + Acme Tech platform engineer |
| Retired | Model decommissioned, inference endpoint removed, artifacts retained | Initiated by model owner, confirmed by subsidiary ML lead |

### Model Card Requirement

Every model promoted to Staging or Production must include a model card (stored in the MLflow artifact store) documenting:

- **Purpose:** What business problem does this model solve?
- **Training data:** Source datasets, time range, preprocessing steps.
- **Metrics:** Accuracy, precision, recall, F1, AUC, or domain-specific metrics.
- **Limitations:** Known failure modes, edge cases, out-of-distribution scenarios.
- **Bias assessment:** Fairlearn disparity metrics across protected groups (where applicable).
- **Owner:** Subsidiary team and individual engineer responsible for the model.

### Drift Monitoring

Models in Production are continuously monitored for data drift and performance degradation using Azure Machine Learning’s monitoring capabilities:

| Indicator | Threshold | Action |
|---|---|---|
| Feature drift (Population Stability Index, PSI) | PSI > 0.2 on any input feature | P3 alert to model owner, investigation required within 5 business days |
| Accuracy degradation | > 5% drop from baseline on rolling 7-day window | P2 alert to model owner and subsidiary ML lead, remediation required within 2 business days |
| Inference latency | > 2x baseline P95 latency | P3 alert to Acme Tech platform team |

---

## Data Quality Standards

Data quality is measured and enforced systematically across all subsidiary data assets using the Great Expectations framework integrated into every ETL and ELT pipeline.

### Quality Dimensions

| Dimension | Definition | Measurement Method |
|---|---|---|
| Completeness | Percentage of non-null values in required columns | Column-level null checks |
| Accuracy | Conformance to known reference values or business rules | Cross-reference validation, range checks |
| Consistency | Agreement across related tables and systems | Cross-table join assertions |
| Timeliness | Data freshness relative to expected arrival schedule | Pipeline SLA monitoring (Datadog) |
| Uniqueness | Absence of duplicate records on defined key columns | Duplicate detection expectations |
| Validity | Conformance to defined formats, enums, and constraints | Schema validation, regex pattern matching |

### Quality Gates

Every ETL/ELT pipeline includes quality gate checkpoints powered by Great Expectations. If a critical quality expectation fails (e.g., primary key uniqueness, referential integrity), the pipeline halts and raises a P2 incident. Warning-level failures (e.g., completeness drops below 95% but above 90%) generate a P3 alert and allow the pipeline to continue.

### Quality Dashboards

Per-table quality scores are computed daily and pushed to Datadog dashboards. Subsidiary data stewards have visibility into their data quality trends. Alerts fire on sustained degradation (quality score below threshold for three consecutive days).

### Master Data Management

Acme Corp maintains a centrally managed customer master record in the `ACME_CORPORATE` Snowflake database. The golden record is resolved using deterministic and probabilistic matching rules. Change Data Capture (CDC) synchronizes the customer master to subsidiary databases on a near-real-time basis. Subsidiaries consume the golden record as a read-only reference and enrich it with subsidiary-specific attributes in their local databases.
