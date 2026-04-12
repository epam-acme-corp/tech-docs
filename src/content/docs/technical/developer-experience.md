---
title: "Developer Experience Standards"
description: "The Acme Tech Developer Experience (DevEx) program is the strategic initiative responsible for engineering productivity across all Acme Corporation su"
---

# Developer Experience Standards

## Developer Experience Vision

The Acme Tech Developer Experience (DevEx) program is the strategic initiative responsible for engineering productivity across all Acme Corporation subsidiaries. The program operates under the principle that every hour a developer spends fighting tooling, waiting on access, or deciphering undocumented processes is an hour not spent delivering business value. Our mission is to reduce time-to-first-commit for every new engineer to under four hours and to make the "right way" the "easy way" — ensuring that secure, compliant, observable code is the natural outcome of following our golden paths rather than a burden layered on after the fact.

The DevEx program tracks four key performance indicators across all six subsidiaries and Acme Tech itself:

| Metric | Target | Measurement Method |
|---|---|---|
| Time-to-First-Commit | < 4 hours from laptop handoff | Automated tracking via onboarding-bot GitHub App |
| Developer Satisfaction (DevSat) | > 4.2 / 5.0 (quarterly survey) | Anonymous Qualtrics survey, subsidiary-segmented |
| CI Pipeline Success Rate | > 92% on default branch | Datadog CI Visibility, per-repo dashboards |
| Mean Time to First PR Review | < 8 business hours | GitHub Insights, CODEOWNERS-based attribution |

These metrics are reported monthly to subsidiary CTOs and quarterly to the Group CTO. Trends that fall below target trigger an improvement initiative tracked as a GitHub Issue in `acme-tech/devex-backlog`.

The program is guided by three core principles:

1. **Self-service by default.** Engineers should be able to provision repositories, environments, and access without filing tickets or waiting for approvals — except where regulatory or security requirements demand a gate.
2. **Golden paths over guardrails.** Rather than blocking engineers from making mistakes, we invest in paved-road tooling (starter templates, devcontainers, reusable workflows) that makes the correct approach the fastest approach.
3. **Documentation as product.** Every doc in this knowledge base is treated with the same rigor as production code: versioned in Git, reviewed via pull request, continuously tested for freshness, and indexed for AI-powered retrieval.

For the platform engineering capabilities that underpin DevEx, see [Platform Engineering Standards](./platform-engineering.md).

---

## Developer Onboarding Workflow

Acme Tech operates a fully automated onboarding pipeline designed to take a new hire from corporate identity provisioning to a merged pull request within their first week. The pipeline is orchestrated through GitHub Actions, triggered by SCIM webhook events from Microsoft Entra ID.

### Day 0 — Automated Identity and Repository Access

When Human Resources completes the new-hire record in Workday, the following chain executes without manual intervention:

1. **Identity provisioning.** Workday syncs the employee record to Microsoft Entra ID. The employee’s subsidiary, department, and role attributes are mapped to Entra groups.
2. **SCIM to GitHub.** Entra ID SCIM connector provisions a GitHub Enterprise Managed User (EMU) account in the Acme Corp enterprise. The username follows the convention `firstname-lastname_acme`.
3. **Organization and team membership.** A GitHub Actions workflow in `acme-tech/identity-sync` reads the SCIM payload, adds the EMU account to the correct subsidiary organization (e.g., `acme-retail`, `acme-fsi`), and assigns default team memberships based on department.
4. **Copilot license assignment.** The same workflow calls the GitHub Copilot API to assign an Enterprise-tier license, scoped to the user’s subsidiary team. The VS Code extension pack is configured via Settings Sync linked to the engineer’s Entra ID identity. The Acme Corp knowledge base corpus is linked to the user’s Copilot Chat context automatically.

### Day 1 — Self-Service Guided Setup

On the engineer’s first morning, they receive a welcome email directing them to the Acme Tech Onboarding Portal (hosted on GitHub Pages at `acme-tech.github.io/onboarding`). The portal provides a step-by-step guided workflow:

1. Clone the `acme-tech/starter-repo` repository that matches their subsidiary stack.
2. Open the repository in VS Code. The devcontainer auto-builds with all required tooling pre-installed.
3. Verify GitHub Copilot is active: the portal includes a verification check that confirms completions and Chat are functional.
4. Submit a "hello world" pull request to the subsidiary sandbox repository (e.g., `acme-retail/sandbox`). The PR triggers CI validation and confirms the engineer’s end-to-end toolchain is operational.

### Day 1–3 — Buddy-Guided Training

Each new engineer is paired with a buddy from their subsidiary team, assigned automatically by the onboarding bot based on team capacity and recent mentoring history. Required training modules (delivered via GitHub-hosted Markdown and interactive exercises) cover:

- **Git workflow.** Trunk-based development, branch naming conventions, commit message standards (Conventional Commits).
- **Code review culture.** Review expectations, CODEOWNERS, constructive feedback guidelines.
- **Security fundamentals.** Secret scanning, dependency review, SAST integration, responsible disclosure process.
- **Copilot best practices.** Prompt engineering, content exclusion awareness, when to trust vs. verify suggestions, responsible AI obligations.

### Day 5 — Validation Checkpoint

On day five, a GitHub Actions workflow auto-creates a pull request against the engineer’s onboarding checklist issue. The checklist covers:

- [ ] EMU account active and MFA enrolled
- [ ] Devcontainer built and verified
- [ ] Copilot completions and Chat confirmed functional
- [ ] Sandbox PR submitted and merged
- [ ] Training modules completed (Git, review, security, Copilot)
- [ ] Buddy sign-off recorded

The onboarding is considered successful when the checklist PR is merged. If any item is unresolved by day five, the onboarding bot escalates to the subsidiary engineering manager.

---

## IDE Standards

### Primary IDE — Visual Studio Code

Visual Studio Code is the primary supported IDE across all Acme Corporation subsidiaries. Standardization on a single editor enables consistent extension management, settings synchronization, and devcontainer support.

### Acme Corp Extension Pack

All engineers install the `acme-corp-extension-pack`, published to the Acme Corp private Open VSX registry. The pack includes:

| Extension | Purpose |
|---|---|
| GitHub Copilot + Chat | AI-assisted code completion and conversational coding |
| GitHub Pull Requests and Issues | In-editor PR review, issue management |
| GitLens | Git blame, history, comparison |
| ESLint + Prettier | JavaScript/TypeScript linting and formatting |
| Pylance + Black | Python language support and formatting |
| C# Dev Kit | .NET development (Acme Insurance, Acme Retail legacy) |
| Docker + Kubernetes | Container management and cluster exploration |
| HashiCorp Terraform | Infrastructure-as-code authoring |
| Datadog | APM trace exploration, log tailing |
| Acme Internal Tools | Acme-specific snippets, internal API explorer, golden path scaffolding |

Settings Sync is configured via Microsoft Entra ID, ensuring that editor settings, keybindings, and extension state roam across devices. Engineers joining a new Codespace or laptop receive their full environment automatically.

### Alternative IDEs

JetBrains IDEs (IntelliJ IDEA, PyCharm, GoLand, Rider) are supported for engineers who prefer them. Copilot plugins are available for all JetBrains products. However, devcontainer support in JetBrains is not actively managed by the DevEx team — engineers using JetBrains are responsible for local environment parity. Extension pack equivalents are documented in `acme-tech/ide-standards` but are not enforced.

---

## Development Environment — Devcontainers

Every Acme Corp repository that contains application code ships with a `.devcontainer/` configuration. Devcontainers ensure that all engineers — regardless of their local operating system — work in an identical, reproducible environment.

### Per-Subsidiary Technology Stacks

Each subsidiary maintains a base devcontainer image tailored to its primary technology stack:

| Subsidiary | Base Image Stack | Key Components |
|---|---|---|
| Acme Retail | Node.js 20 + TypeScript | PostgreSQL 15, Redis 7, Webpack |
| Acme Financial Services | Java 21 + Spring Boot 3 | Oracle Instant Client, Kafka 3.6, Maven |
| Acme Telco | Go 1.22 + gRPC | PostgreSQL 15, Protocol Buffers compiler, Buf CLI |
| Acme Insurance | .NET 8 | SQL Server 2022 (container), Entity Framework tooling |
| Acme Distribution | Python 3.12 + FastAPI | PostgreSQL 15, SQLAlchemy, Alembic, Celery |
| Acme Media | Node.js 20 + Next.js 14 | MongoDB 7, ImageMagick, Sharp |

### Common Devcontainer Features

All devcontainer images include the following shared components:

- **Acme Corp CA certificates** — Pre-installed to enable TLS verification against internal services.
- **Corporate proxy settings** — Environment variables pre-configured for HTTP/HTTPS proxy when building inside the corporate network.
- **Azure CLI** — Authenticated via Entra ID device code flow on first launch.
- **GitHub CLI (`gh`)** — Pre-installed, authenticated via EMU token.
- **Terraform CLI** — Version-locked to the Acme Tech-approved release.
- **GitHub Copilot** — Extension auto-installed and activated.

### GitHub Codespaces Configuration

Acme Corp uses GitHub Codespaces for cloud-based development. Default machine types are assigned per use case:

| Use Case | Machine Type | Monthly Budget Limit |
|---|---|---|
| Standard development | 4-core / 16 GB RAM | 120 hours |
| Build-intensive work | 8-core / 32 GB RAM | 80 hours |
| ML and data engineering | 16-core / 64 GB RAM | 40 hours |

Prebuild configurations are enabled on all repositories with more than ten active contributors, reducing Codespace start time from minutes to under thirty seconds.

### Image Maintenance

Base devcontainer images are rebuilt weekly (Sunday 04:00 UTC) by a scheduled GitHub Actions workflow in `acme-tech/devcontainer-images`. Breaking changes (major runtime version bumps, removed tools) are announced at least two weeks in advance via a GitHub Discussion in `acme-tech/announcements`. Non-breaking updates (security patches, minor versions) are applied silently.

---

## Code Review Standards

### Reviewer Matrix

Pull request review requirements vary by change type to balance velocity with risk mitigation:

| Change Type | Required Reviewers | Composition |
|---|---|---|
| Production application code | 2 | 1 from owning team + 1 cross-team reviewer |
| Infrastructure (Terraform, Helm) | 2 | 1 from subsidiary + 1 from Acme Tech Platform team |
| Security-sensitive code | 3 | 2 standard + 1 from Acme Tech Security team |
| Documentation only | 1 | Any team member with write access |

### CODEOWNERS Enforcement

Every repository must contain a `CODEOWNERS` file at the root. Branch protection rules enforce that all files in a pull request match at least one CODEOWNERS pattern, and the designated owners are automatically requested as reviewers. CODEOWNERS files are reviewed quarterly by subsidiary tech leads to ensure accuracy.

### Auto-Assignment and Load Balancing

Reviewer assignment uses GitHub’s round-robin algorithm with load balancing enabled. Engineers with more than five open review requests are temporarily excluded from the rotation. On-call engineers are excluded during their rotation.

### Review SLAs

| Priority | Initial Review SLA | Stale Reminder | Escalation | Auto-Close |
|---|---|---|---|---|
| Standard | 1 business day | 7 days | 14 days (to tech lead) | 30 days |
| Security / Hotfix | 4 hours | 12 hours | 24 hours (to subsidiary CTO) | N/A |

### Quality Focus

Reviewers focus on correctness, security implications, maintainability, and alignment with architectural decisions (ADRs). Style and formatting concerns are handled exclusively by automated linters (ESLint, Prettier, Black, gofmt, dotnet-format) — human reviewers should not comment on style issues that a linter would catch.

---

## Documentation-as-Code Culture

All documentation at Acme Corp lives in Git repositories alongside the code it describes. There is no separate wiki, Confluence instance, or SharePoint site for technical documentation (legacy Confluence content has been migrated to Markdown and archived).

### Workflow

Documentation changes follow the same pull request workflow as code changes: branch, commit, open PR, review, merge. This ensures that documentation is version-controlled, peer-reviewed, and auditable.

### Standards

- All docs are authored in Markdown following the [Acme Corp Documentation Standards](../../corporate/governance/documentation-standards.md).
- Templates are provided for Architecture Decision Records (ADRs), runbooks, API documentation, and onboarding guides.
- Every document includes metadata frontmatter (title, owner, last-updated, status) for automated indexing.

### Knowledge Base Integration

On merge to the default branch, a GitHub Actions workflow triggers the RAG ingestion pipeline (see [RAG Architecture](../data/rag-architecture.md)). Documents are chunked, embedded, and indexed into Azure AI Search within fifteen minutes of merge. This means every engineer’s Copilot Chat and the Acme Corp internal search portal always reflect the latest approved content.

### Freshness Enforcement

A scheduled GitHub Actions workflow runs quarterly to flag documents whose `last-updated` date exceeds 180 days. Flagged documents are assigned to their CODEOWNERS via an auto-created issue. If the issue is not resolved within 30 days, the document is marked `status: stale` in its frontmatter, and a banner is injected at the top warning readers that the content may be outdated.

---

## Inner-Source Model

Acme Tech operates an inner-source model that enables subsidiary engineering teams to contribute to shared repositories maintained by Acme Tech. This model accelerates feature delivery, reduces duplicated effort, and builds cross-subsidiary engineering community.

### Contribution Workflow

1. **Fork** the target Acme Tech repository into the contributor’s subsidiary organization.
2. **Branch** from `main` following the naming convention: `<subsidiary>/<feature-or-fix-description>`.
3. **Develop** locally or in Codespaces, following the repository’s CONTRIBUTING.md and coding standards.
4. **Open a pull request** from the fork back to the upstream Acme Tech repository.
5. **Review** by the module owner (Acme Tech) plus at least one reviewer from the contributor’s subsidiary.
6. **Merge** by the module owner after all checks pass and reviews are approved.

### Inner-Source Champions

Each subsidiary designates two to three Inner-Source Champions — senior engineers who serve as liaisons between their subsidiary and Acme Tech. Champions are responsible for:

- Identifying opportunities for shared components.
- Mentoring subsidiary engineers through their first inner-source contributions.
- Representing their subsidiary’s needs in Acme Tech planning discussions.

### Discovery and Visibility

Shared repositories are tagged with GitHub Topics: `inner-source`, `shared-module`, `reusable-workflow`. The Acme Tech monthly engineering newsletter features a showcase of recent inner-source contributions, highlighting the contributing team, the problem solved, and the impact across subsidiaries.

### Recognition

Inner-source contributors are recognized through the quarterly Inner-Source Contributor Award, selected by the Acme Tech engineering leadership. Contribution data — pull requests opened, reviews performed, issues filed — is tracked automatically via GitHub and surfaced in the DevEx dashboard accessible to subsidiary CTOs.

For governance policies governing repository creation and access, see [GitHub Governance](./github-governance.md). For Copilot-specific policies that apply during development, see [Copilot Governance](./copilot-governance.md).
