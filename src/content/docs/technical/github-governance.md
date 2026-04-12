---
title: "GitHub Enterprise Governance"
description: "This document defines the governance model, policies, and standards for Acme Corporation's GitHub Enterprise deployment. All repositories, organizatio"
---

# GitHub Enterprise Governance

This document defines the governance model, policies, and standards for Acme Corporation's GitHub Enterprise deployment. All repositories, organizations, and workflows across every subsidiary operate under these enterprise-wide rules.

## GitHub Enterprise Organization Structure

### Enterprise Account

Acme Corporation operates a single GitHub Enterprise Cloud account (`acme-corporation`) using the Enterprise Managed Users (EMU) model. All user accounts are provisioned through SCIM from the corporate Entra ID tenant, ensuring centralized lifecycle management and policy enforcement. For identity provisioning details, see [Identity & Access Management Architecture](../security/identity-access-management.md).

### Organizations

| Organization | Subsidiary | Description | Approx. Repos |
|---|---|---|---|
| `acme-tech` | Acme Tech | Shared infrastructure, Terraform modules, pipeline templates, platform tooling, and internal developer tools | ~320 |
| `acme-retail` | Acme Retail | E-commerce platform, loyalty services, inventory management, POS systems | ~280 |
| `acme-fsi` | Acme Financial Services | Trading platforms, risk engines, regulatory reporting, payment processing | ~210 |
| `acme-telco` | Acme Telco | Network management, customer portals, billing platforms, 5G edge services | ~175 |
| `acme-insurance` | Acme Insurance | Claims processing, policy management, underwriting engines, actuarial tools | ~150 |
| `acme-distribution` | Acme Distribution | Supply chain management, warehouse automation, fleet logistics, route optimization | ~130 |
| `acme-media` | Acme Media | Content management, streaming platform, ad tech, audience analytics | ~190 |

Shared repositories — including Terraform modules, reusable GitHub Actions workflows, and internal developer documentation — reside in the `acme-tech` organization and are accessible to all subsidiaries. Each subsidiary organization is administered by its own CTO and Lead Architect, operating within the guardrails defined by enterprise-level policies.

## Repository Naming Conventions

All repositories follow a standardized naming convention to ensure discoverability, ownership clarity, and automated tooling compatibility.

### Naming Pattern

`{subsidiary-prefix}-{domain}-{component}`

| Category | Pattern | Naming Convention |
|---|---|---|
| Application repos | `{prefix}-{domain}-{component}` | `retail-bookstore-api`, `fsi-trading-engine`, `telco-billing-gateway` |
| Documentation repos | `{prefix}-docs-{area}` | `tech-docs-platform`, `retail-docs-onboarding`, `fsi-docs-compliance` |
| Terraform modules | `terraform-azurerm-{resource}` | `terraform-azurerm-vnet`, `terraform-azurerm-aks`, `terraform-azurerm-keyvault` |
| Reusable workflows | Stored in `acme-tech/.github` | `security-scan.yml`, `terraform-plan-apply.yml`, `docker-build-push.yml` |
| Libraries/SDKs | `{prefix}-lib-{name}` | `tech-lib-auth`, `retail-lib-cart-sdk`, `fsi-lib-risk-models` |

### Subsidiary Prefixes

| Prefix | Organization |
|---|---|
| `tech` | acme-tech |
| `retail` | acme-retail |
| `fsi` | acme-fsi |
| `telco` | acme-telco |
| `insurance` | acme-insurance |
| `distribution` | acme-distribution |
| `media` | acme-media |

Repositories that do not conform to the naming convention are flagged by a nightly compliance audit and reported to the organization owner for remediation.

## Branch Protection Rules

### Default Branch (`main`)

All repositories enforce the following branch protection rules on the `main` branch:

- **Require Pull Request** — Direct commits to `main` are blocked. All changes must go through a pull request.
- **Required Approving Reviews** — Minimum 2 approving reviews for production code, 1 for documentation-only changes.
- **Required Status Checks** — The `security-scan` workflow and repository-specific CI checks must pass before merge.
- **Require Conversation Resolution** — All review threads must be resolved before the PR can be merged.
- **Linear History** — Only squash merges and rebases are permitted. Merge commits are disabled to maintain a clean history.
- **Dismiss Stale Reviews** — Approvals are automatically dismissed when new commits are pushed to the PR branch.

### Release Branches (`release/*`)

Release branches inherit all `main` branch protections with the following additions:

- **Release Manager Review** — At least one approval must come from a designated release manager (defined in CODEOWNERS).
- **Deployment Environment Approval** — Merge to a release branch triggers a deployment that requires environment-level approval in GitHub.

### Feature Branches

Feature branches have no branch protection rules. They are automatically deleted after their PR is merged into `main`.

## Ruleset Configuration

### Enterprise-Level Rulesets

Enterprise rulesets apply uniformly across all organizations and cannot be overridden at the org or repo level:

| Ruleset | Rule | Enforcement |
|---|---|---|
| Default branch protection | Block force pushes to default branch | All repos, all orgs |
| Tag protection | Only org owners can create tags matching `v*` | All repos, all orgs |
| Conventional commits | Commit messages must follow format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:` | All repos, all orgs |

### Organization-Level Rulesets

Organization-level rulesets extend enterprise rules for subsidiary-specific requirements:

| Organization | Ruleset | Rule |
|---|---|---|
| `acme-fsi` | Signed commits | All commits must be signed (GPG or SSH) |
| `acme-insurance` | Signed commits | All commits must be signed (GPG or SSH) |
| All orgs | Large file block | Block files exceeding 50 MB (use Git LFS for large assets) |

The signed commit requirement for FSI and Insurance organizations satisfies regulatory audit requirements for code provenance and integrity verification.

## GitHub Actions Governance

### Actions Allowlist

GitHub Actions execution is restricted to trusted namespaces at the enterprise level:

- **Allowed**: `actions/*`, `github/*`, `acme-tech/*`
- **Third-Party**: Must be reviewed and added to `acme-tech/actions-allowlist` via PR. Approved actions must be pinned by commit SHA, not by tag or branch reference.

The allowlist repository includes automated checks that verify the requested action's license, maintenance status, and known vulnerability history before approval.

### Required Workflows

The `security-scan.yml` workflow is enforced as a required workflow at the enterprise level. It runs on every pull request in every organization and cannot be skipped, disabled, or overridden by repository administrators. This workflow executes CodeQL analysis, secret scanning validation, and dependency review.

### OIDC and Workload Identity Federation

GitHub Actions workflows authenticate to Azure using OIDC-based Workload Identity Federation. No Azure credentials (client secrets, certificates) are stored in GitHub secrets. The federation trust is configured with subject claims scoped to specific repositories and environments:

```
repo:acme-corporation/acme-retail/{repo}:environment:{env}
```

This scoping ensures that a workflow in one repository cannot obtain tokens for resources belonging to another repository, even within the same organization.

### Runner Policy

All workflow jobs must execute on self-hosted runners operated by Acme Tech. GitHub-hosted runners are disabled at the enterprise level. For runner group details and configuration, see [Platform Engineering](./platform-engineering.md).

## Security Scanning Configuration

### Secret Scanning

Secret scanning is enabled for all repositories across every organization:

- **Default Patterns** — All GitHub-supported secret patterns are active (API keys, tokens, certificates, connection strings)
- **Custom Patterns** — Acme-specific patterns detect internal credential formats, including Acme API gateway keys (`acm-key-*`), internal service tokens, and legacy authentication headers
- **Push Protection** — Enabled enterprise-wide. Contributors are blocked from pushing commits containing detected secrets. Override requires a security team member's approval with documented justification.

### CodeQL Analysis

CodeQL static analysis is configured using GitHub's default setup:

- **Supported Languages** — JavaScript/TypeScript, Python, Java, C#, Go
- **Custom Queries** — Acme-specific CodeQL query packs target patterns relevant to the Acme architecture: insecure API gateway configurations, improper partition key usage in Cosmos DB, and hardcoded environment-specific values
- **Scan Schedule** — PR-triggered scans on every pull request. Weekly full-repository scheduled scans (Saturday 02:00 UTC) to catch vulnerabilities in unchanged code paths

### Dependabot Configuration

Dependabot is configured uniformly across all repositories using a standardized `dependabot.yml` template distributed through the `.github` repository:

**Security Updates:**
- Automated PRs for known vulnerabilities
- Auto-merge for patch-level updates if CI passes and no breaking changes detected
- Critical/high severity updates generate a P3 alert if not merged within 48 hours

**Version Updates:**
- Weekly check (Monday 06:00 UTC)
- Grouped PRs for minor version updates within the same ecosystem
- Major version updates require manual review and are not auto-merged
- Assignee: repository CODEOWNERS

## Code Review Standards

### Review Requirements

| Change Type | Required Reviewers | Review Source |
|---|---|---|
| Production code | 2 | At least one from CODEOWNERS for the affected path |
| Documentation | 1 | Any team member |
| Security-sensitive (auth, crypto, IAM) | 2 + security team | CODEOWNERS + `ACM-TECH-SECURITY` team |
| Infrastructure (Terraform) | 2 | Platform Engineering + subsidiary team |

### CODEOWNERS

Every repository must include a `CODEOWNERS` file at the root. CODEOWNERS defines path-based review assignments ensuring that domain experts review changes to their areas of responsibility. Repositories without a valid CODEOWNERS file are flagged by the nightly compliance audit.

### Auto-Assignment

Review requests are distributed using GitHub's round-robin auto-assignment with load balancing enabled. Teams configure a maximum review load (typically 3 concurrent reviews per engineer) to prevent bottlenecks. When all team members are at capacity, the review request queues and the team lead is notified.

### Review SLAs

| Priority | SLA | Escalation |
|---|---|---|
| Standard | 1 business day | Reminder at 20 hours, escalation to team lead at 24 hours |
| Security | 4 hours | Immediate notification, escalation to security lead at 3 hours |
| Critical hotfix | 2 hours | Page team on-call, bypass auto-assignment for fastest available reviewer |

### Stale PR Management

Pull requests that remain unmerged and inactive are managed through automated workflows:

- **14 days without activity** — Automated reminder comment posted to PR author and reviewers
- **30 days without activity** — PR is automatically closed with a comment explaining the closure and instructions for reopening
- **Exception** — PRs labeled `long-running` or `blocked` are excluded from automatic closure but receive weekly status check reminders

---

*For the overall platform architecture, see [Architecture Overview](../architecture/overview.md). For GitHub Enterprise configuration decisions, see [ADR-002: GitHub Enterprise Cloud](../architecture/adr/ADR-002-github-enterprise-cloud.md). For platform engineering details, see [Platform Engineering](./platform-engineering.md).*
