---
title: "Copilot Governance"
description: "GitHub Copilot is the strategic AI-powered coding assistant deployed across all Acme Corporation subsidiaries. Operating on the GitHub Copilot Enterpr"
---

# Copilot Governance

## Copilot Program Overview

GitHub Copilot is the strategic AI-powered coding assistant deployed across all Acme Corporation subsidiaries. Operating on the GitHub Copilot Enterprise tier, the program serves approximately 8,000 active users spanning six subsidiary organizations and Acme Tech’s shared-services engineering team. Copilot is embedded into the standard developer workflow as a core productivity tool, not an optional add-on.

The program delivers the following capabilities to Acme Corp engineers:

| Capability | Description | Availability |
|---|---|---|
| Code Completions | Inline suggestions during active editing | All licensed users |
| Copilot Chat | Conversational AI in IDE and GitHub.com | All licensed users |
| Copilot CLI | Command-line assistance for shell, Git, and GitHub operations | All licensed users |
| Pull Request Summaries | AI-generated PR descriptions and review summaries | All repositories in Acme Corp enterprise |
| Copilot Code Review | Automated code review suggestions on pull requests | All repositories in Acme Corp enterprise |

The program is governed by the Acme Tech Developer Experience team in collaboration with subsidiary CTOs and the Acme Corp Information Security Office. All policies in this document are enforced at the GitHub Enterprise level and apply uniformly unless a subsidiary-specific exception is documented.

For the broader developer experience framework, see [Developer Experience Standards](./developer-experience.md).

---

## License Management

Copilot licenses are allocated per subsidiary based on active engineering headcount and budgeted annually through the Acme Tech shared-services cost allocation model. Current allocations are as follows:

| Subsidiary | Licensed Seats | Active Users (Feb 2025) | Utilization |
|---|---|---|---|
| Acme Tech | 2,500 | 2,340 | 93.6% |
| Acme Retail | 1,800 | 1,680 | 93.3% |
| Acme Financial Services | 1,200 | 1,090 | 90.8% |
| Acme Telco | 900 | 845 | 93.9% |
| Acme Insurance | 600 | 542 | 90.3% |
| Acme Distribution | 500 | 465 | 93.0% |
| Acme Media | 500 | 478 | 95.6% |
| **Total** | **8,000** | **7,440** | **93.0%** |

### Provisioning Automation

License assignment is fully automated through GitHub team membership. When an engineer is provisioned via the SCIM onboarding pipeline (see [Developer Experience Standards](./developer-experience.md)), their subsidiary team membership triggers automatic Copilot license assignment via the GitHub API. No manual license management is required.

### License Reclamation

Licenses are monitored monthly for utilization. An account that has not generated a Copilot event (completion, Chat interaction, CLI invocation) for thirty consecutive days enters a grace period. At the end of the thirty-day grace period, the license is automatically reclaimed and returned to the subsidiary’s available pool. Engineers whose licenses are reclaimed can request reactivation through their team lead.

### Monthly Utilization Review

The DevEx team publishes a monthly license utilization report to each subsidiary CTO. Subsidiaries with utilization below 85% for two consecutive months are flagged for a seat optimization review — either rebalancing unused seats to higher-demand subsidiaries or investing in adoption enablement.

---

## Content Exclusions

Content exclusions prevent Copilot from processing, training on, or suggesting code from sensitive repositories and file paths. Exclusions are configured at the GitHub Enterprise level and enforced for all Copilot features (completions, Chat, agents).

### Enterprise-Level Exclusion Rules

The following exclusion patterns are active across the Acme Corp enterprise:

| Pattern | Scope | Rationale |
|---|---|---|
| `acme-fsi/**/*compliance*` | All files in FSI compliance paths | Regulatory compliance logic subject to audit controls |
| `acme-fsi/**/*trading*` | All files in FSI trading paths | Proprietary trading algorithms — trade secret classification |
| `acme-insurance/**/*actuarial*` | All files in Insurance actuarial paths | Actuarial models under regulatory review |
| `acme-insurance/**/*claims-engine*` | All files in Insurance claims engine | Claims processing logic — proprietary business rules |
| `**/secrets/**` | Any `secrets` directory across all organizations | Credential and key material directories |
| `**/.env*` | All environment configuration files | Potential secret exposure in environment variables |

### Exclusion Policy

The following categories of code are excluded from Copilot processing as a matter of policy:

- **PII processing logic.** Code that directly handles personally identifiable information, including data masking routines, consent management, and data subject access request (DSAR) processors.
- **Regulatory compliance implementations.** Logic that enforces financial regulations (SOX, PCI-DSS, MiFID II) or insurance regulations (state-specific claims handling requirements).
- **Proprietary algorithms.** Trading strategies, pricing models, actuarial calculations, and recommendation engines classified as trade secrets.

Subsidiary CTOs may request additional content exclusions by submitting a pull request to the `acme-tech/copilot-config` repository. The PR must include the exclusion pattern, business justification, and impact assessment. Approval requires sign-off from both the subsidiary CTO and the Acme Tech DevEx lead.

---

## Agent Governance

As Copilot agents and third-party AI agents become integral to the developer workflow, Acme Tech enforces governance controls on agent registration, capability scoping, and auditability.

### Agent Registry

All agents operating within the Acme Corp GitHub Enterprise must be registered in the `acme-tech/agent-registry` repository. Each agent entry includes a YAML manifest with the following fields:

```yaml
name: retail-inventory-agent
version: 2.1.0
purpose: Automates inventory reorder threshold adjustments based on demand forecasting
owner: acme-retail/platform-team
approved_mcp_servers:
  - github-mcp (Tier 1)
  - azure-mcp (Tier 2, approved 2025-01-15)
data_scope: acme-retail repositories only
last_review: 2025-02-28
next_review: 2025-05-28
```

### MCP Server Tier Classification

Model Context Protocol (MCP) servers that agents connect to are classified into three tiers based on risk:

| Tier | Classification | Approval Required | Audit Frequency |
|---|---|---|---|
| Tier 1 — Unrestricted | GitHub MCP server, local filesystem, database (read-only) | None — available to all registered agents | Quarterly |
| Tier 2 — Subsidiary Approval | Azure MCP, Datadog MCP, Snowflake MCP | Subsidiary CTO sign-off | Monthly |
| Tier 3 — Enterprise Approval | External API MCP servers, custom network-enabled MCP servers | Group CTO + InfoSec sign-off | Continuous logging + monthly review |

### Agent Primitives

Acme Tech defines four standard agent primitives, each with distinct permission boundaries:

| Primitive | Purpose | Permissions | Human Gate |
|---|---|---|---|
| Task Agent | Implements code changes | Read/write to assigned repository, create branches and PRs | PR merge requires human approval |
| Review Agent | Performs automated code review | Read-only repository access, can post review comments | Review is advisory — human reviewer makes final decision |
| Research Agent | Explores codebase, gathers context | Read-only access to indexed knowledge base and repositories | No write access; outputs are informational |
| Deployment Agent | Triggers CI/CD pipeline actions | Read-only repo, can trigger approved GitHub Actions workflows | Deployment to production requires human approval gate |

### Audit and Compliance

Every agent invocation is logged to Datadog with the following attributes: agent name, invoking user, MCP servers accessed, repositories touched, files modified, and execution duration. Logs are retained for one year and are queryable by the Acme Corp Information Security Office. Any code or infrastructure modification produced by an agent must flow through a standard pull request — agents create PRs, but only human engineers can approve and merge them.

---

## Knowledge Base Management

The Copilot knowledge base is powered by the Acme Corp RAG pipeline (see [RAG Architecture](../data/rag-architecture.md)) and provides context-aware assistance grounded in Acme Corp’s internal documentation, runbooks, and architectural decisions.

### Per-Subsidiary Knowledge Indexes

Each subsidiary maintains an isolated Azure AI Search index containing documentation specific to its domain:

| Index | Content Sources | Approximate Chunk Count |
|---|---|---|
| `idx-acme-tech` | Acme Tech KB, platform docs, governance | 42,000 |
| `idx-acme-retail` | Retail technical docs, runbooks, API specs | 38,000 |
| `idx-acme-fsi` | FSI compliance docs, trading platform, risk models | 31,000 |
| `idx-acme-telco` | Telco network docs, BSS/OSS platform | 28,000 |
| `idx-acme-insurance` | Insurance claims, underwriting, actuarial docs | 22,000 |
| `idx-acme-distribution` | Distribution logistics, route optimization | 18,000 |
| `idx-acme-media` | Media CMS, content delivery, streaming | 15,000 |
| `idx-corporate` | Corporate policies, governance, shared standards | 12,000 |

### Knowledge Isolation

Subsidiary knowledge indexes are isolated by default. An engineer at Acme Retail queries `idx-acme-retail` and `idx-corporate` but cannot access `idx-acme-fsi` content through Copilot Chat. This ensures that confidential subsidiary data — particularly in regulated industries (FSI, Insurance) — is not inadvertently surfaced to unauthorized users.

### Shared Corporate Knowledge

The `idx-corporate` index is available to all Acme Corp employees and contains governance policies, documentation standards, the technology glossary, and cross-cutting architectural guidance. This ensures a baseline of organizational knowledge is accessible regardless of subsidiary affiliation.

### Re-Indexing Automation

When documentation is merged to the default branch of any Acme Corp repository, a GitHub Actions workflow triggers the RAG ingestion pipeline. Changed files are detected, re-chunked, re-embedded, and upserted into the appropriate Azure AI Search index. The end-to-end latency from merge to searchable content is under fifteen minutes.

### Quarterly Quality Audit

Every quarter, the DevEx team runs a quality audit on knowledge base indexes. Documents with low retrieval frequency (fewer than five retrievals in the quarter) are flagged for review. Document owners are notified via auto-generated GitHub Issues and have thirty days to confirm relevance, update content, or approve archival.

---

## Usage Analytics

Copilot usage is tracked at the subsidiary level to measure adoption, identify optimization opportunities, and quantify productivity impact.

### Key Metrics

| Metric | Target | Reporting Cadence |
|---|---|---|
| Completion Acceptance Rate | > 30% | Monthly |
| Chat Interactions per Developer per Week | > 10 | Monthly |
| Agent Invocations per Developer per Month | Tracked (no target yet) | Monthly |
| Estimated Lines Assisted by Copilot | Tracked as percentage of total | Quarterly |

### Reporting

Monthly reports are distributed to subsidiary CTOs with trends, top-performing teams, and areas for improvement. Quarterly impact reviews are presented to the Group CTO, David Ramirez, correlating Copilot adoption metrics with engineering velocity (deployment frequency, lead time for changes, change failure rate).

---

## Responsible AI Guidelines

Acme Corp is committed to the responsible deployment of AI-powered developer tools. The following principles govern Copilot and agent usage across the enterprise.

### Human in the Loop

All code produced or modified by an AI agent must be reviewed by a human engineer before merging. Agents may create branches and open pull requests, but merge authority rests exclusively with human reviewers who meet the review requirements defined in [Developer Experience Standards](./developer-experience.md).

### Data Boundaries

Copilot and agents must not process customer PII. Content exclusions (defined above) enforce this at the platform level. Engineers are additionally trained during onboarding to avoid pasting customer data into Copilot Chat prompts.

### Bias and Fairness

Agent-generated outputs — including code suggestions, documentation, and review comments — are subject to the same quality and fairness standards as human-authored work. Teams are encouraged to review agent outputs critically, particularly in domains affecting customers (pricing, eligibility, content moderation).

### Transparency

All commits that include AI-assisted contributions carry a `Co-authored-by` trailer identifying the AI tool. This ensures auditability and allows downstream analysis of AI contribution patterns.

### Incident Response

Copilot-related incidents (unexpected behavior, content exclusion bypass, policy violation) are reported in the `#copilot-incidents` Slack channel. The DevEx team triages all incidents within four hours during business hours. Critical incidents (data leakage, exclusion bypass) escalate immediately to the Information Security Office.

For platform-level governance, see [GitHub Governance](./github-governance.md). For the underlying infrastructure, see [Platform Engineering Standards](./platform-engineering.md).
