---
title: "ADR-002 — Standardization on GitHub Enterprise Cloud for Source Control and CI/CD"
description: "---"
---

# ADR-002: Standardization on GitHub Enterprise Cloud for Source Control and CI/CD

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2023-08-22 |
| **Deciders** | Marcus Chen (Group CTO), Sarah Okonkwo (VP Platform Engineering), David Reeves (VP Security & CISO) |
| **Reviewed by** | Architecture Review Board |

---

## Context

Prior to standardization, Acme Corporation's six subsidiaries operated fragmented and inconsistent source control and CI/CD platforms:

- **Acme Financial Services** used Azure DevOps with Azure Repos and Azure Pipelines. Mature CI/CD practices but no code scanning or dependency analysis beyond basic pipeline checks.
- **Acme Retail** used GitHub.com with free/Team plans (non-enterprise, personal accounts). Good developer experience but no enterprise governance, no SSO, and inconsistent repository policies.
- **Acme Telco** used self-hosted GitLab Enterprise Edition on-premises. Full-featured but operationally expensive to maintain, patch, and scale. No integration with enterprise identity.
- **Acme Insurance** used Apache Subversion (SVN) with Jenkins for CI. Severely outdated — no branch-based workflows, no code review process, no automated security scanning. Highest migration risk.
- **Acme Distribution** used Atlassian Bitbucket Cloud with Bamboo for CI. Functional but isolated from the rest of the enterprise with no shared governance.
- **Acme Media** used GitHub.com with Team plans (personal accounts). Similar to Retail — good developer experience but no enterprise controls.

This fragmentation created several critical problems:

1. **Security gaps:** No unified vulnerability scanning, secret detection, or dependency analysis. Each subsidiary applied (or failed to apply) security practices independently.
2. **Inconsistent governance:** Repository policies, branch protection rules, and access controls varied wildly. Some subsidiaries had no branch protection at all.
3. **No enterprise identity:** Most platforms used local accounts rather than federated identity, making offboarding a manual, error-prone process with security implications.
4. **Duplicated costs:** Six separate SCM/CI platform licenses, six separate administrative teams, six separate training programs.
5. **No inner-source capability:** Engineers could not discover, reference, or contribute to code across subsidiary boundaries.

---

## Decision

We will standardize the entire Acme Corporation enterprise on **GitHub Enterprise Cloud with Enterprise Managed Users (EMU)** as the unified source control, CI/CD, and developer collaboration platform.

### Enterprise Structure

- **Enterprise account:** `acme-corporation`
- **Enterprise Managed User (EMU) suffix:** `_acme` (all user accounts are provisioned as `{username}_acme`)
- **Organizations:**

| Organization | Subsidiary | Purpose |
|---|---|---|
| `acme-tech` | Acme Tech | Shared platform services, Terraform modules, workflow templates, internal tooling |
| `acme-retail` | Acme Retail | Retail applications, e-commerce APIs, inventory systems |
| `acme-fsi` | Acme Financial Services | Trading platforms, regulatory reporting, payment processing |
| `acme-telco` | Acme Telco | Network management, subscriber platforms, billing systems |
| `acme-insurance` | Acme Insurance | Claims processing, underwriting systems, policy administration |
| `acme-distribution` | Acme Distribution | Supply chain, logistics, warehouse management |
| `acme-media` | Acme Media | Content management, streaming platforms, editorial tooling |

### Identity Integration

User accounts are provisioned and managed exclusively through SCIM from Microsoft Entra ID (see [ADR-003](./ADR-003-entra-id-federation.md)). EMU accounts cannot be created manually — they are automatically provisioned when a user is assigned the GitHub Enterprise application in Entra ID and deprovisioned when the assignment is removed. This ensures that user lifecycle management is fully automated and tied to the enterprise HR onboarding/offboarding process.

### Enterprise-Level Policies

The following policies are enforced at the enterprise level, applying to all organizations:

- **GitHub Advanced Security (GHAS):** Enabled for all organizations. CodeQL code scanning, secret scanning with push protection, and Dependabot security updates are mandatory.
- **Actions allowed list:** Only actions from `actions/*`, `github/*`, and the internal `acme-tech/*` organization are permitted. Third-party actions require security review and allowlisting by the Security & Compliance team.
- **Copilot policies:** GitHub Copilot Business is enabled enterprise-wide with content exclusion rules for regulated repositories (FSI, Insurance) and telemetry configured per subsidiary privacy requirements.
- **Repository visibility:** Default repository visibility is `internal` (visible to all enterprise members) to enable inner-source discovery. `Public` visibility is restricted to the `acme-tech` organization for approved open-source contributions.
- **Branch protection rulesets:** Enterprise-level rulesets enforce a minimum set of protections on default branches: require pull request reviews (minimum 1 reviewer), require status checks to pass, require signed commits for `acme-fsi` and `acme-insurance` organizations.

### CI/CD Infrastructure

GitHub Actions is the standard CI/CD platform. All build, test, security scan, and deployment workflows run on **self-hosted runners hosted on dedicated AKS clusters** in the hub VNet.

- **Runner groups** are configured per subsidiary to ensure workload isolation. Acme FSI runners operate in a dedicated node pool with enhanced security controls.
- **Reusable workflow templates** are published in the `acme-tech/.github` repository and consumed by all subsidiary organizations for standard build/test/deploy patterns.
- **OIDC federation** to Azure enables passwordless deployment from GitHub Actions to Azure resources, eliminating the need for stored service principal secrets.

### Migration Strategy

Migration to GitHub Enterprise Cloud follows an 18-month phased plan:

| Phase | Timeline | Subsidiaries | Approach |
|---|---|---|---|
| Phase 1 | Q3–Q4 2023 | Acme Retail, Acme Media | Already on GitHub.com — migrate to EMU enterprise, import repos |
| Phase 2 | Q1–Q2 2024 | Acme Financial Services, Acme Distribution | Migrate from Azure DevOps (using `gh gei`) and Bitbucket Cloud |
| Phase 3 | Q3 2024 | Acme Telco | Migrate from self-hosted GitLab using `gh gei` |
| Phase 4 | Q4 2024–Q1 2025 | Acme Insurance | Migrate from SVN using `svn2git`, establish branch-based workflows, comprehensive training |

---

## Consequences

### Positive

- **Unified security posture:** GHAS provides consistent vulnerability scanning, secret detection, and dependency analysis across every repository in the enterprise. Security policies are enforced at the enterprise level rather than relying on each subsidiary to configure their own.
- **Single identity:** EMU with Entra ID SCIM ensures that every GitHub account is tied to a corporate identity. When an employee leaves, their GitHub access is automatically revoked within minutes.
- **Shared CI/CD infrastructure:** Self-hosted runners on AKS eliminate the need for each subsidiary to provision and maintain their own CI/CD infrastructure. Cost is shared and scaling is centralized.
- **Copilot governance:** Enterprise-level Copilot policies ensure consistent configuration across subsidiaries, including content exclusions for regulated code and usage analytics for ROI measurement.
- **Inner-source enablement:** Internal repository visibility allows engineers across subsidiaries to discover, learn from, and contribute to each other's codebases — fostering knowledge sharing and reducing duplicate implementations.

### Negative

- **Migration effort for legacy systems:** Migrating Acme Insurance from SVN to Git requires significant effort — not just technical migration, but training engineers in Git workflows, branch strategies, and pull request reviews. This is a multi-quarter commitment.
- **EMU limitations:** Enterprise Managed Users cannot participate in public open-source repositories on GitHub.com. Engineers who need to contribute to open-source projects require separate personal GitHub accounts, which creates a dual-identity experience.
- **Training investment:** Engineers accustomed to Azure DevOps, GitLab, or Bitbucket require training on GitHub workflows, Actions syntax, and GHAS tools. The Developer Experience team is developing a comprehensive training program with self-paced modules and instructor-led workshops.

### Mitigations

- **Phased 18-month migration:** The phased approach spreads migration effort across six quarters, allowing the Platform Engineering team to focus on one or two subsidiaries at a time and incorporate lessons learned.
- **Migration tooling:** `gh gei` (GitHub Enterprise Importer) handles repository migration from Azure DevOps, GitLab, and Bitbucket with history preservation. `svn2git` converts SVN repositories to Git with full commit history mapping.
- **Training program:** The Developer Experience team delivers targeted training for each subsidiary based on their source platform. Acme Insurance receives the most intensive program, including Git fundamentals, branching strategies, and code review practices.
- **Open-source contribution process:** A documented process allows engineers to use personal GitHub accounts for approved open-source contributions, with Acme Tech providing guidelines for IP protection and contribution approval.

---

## Related Documents

- [Platform Architecture Overview](../overview.md)
- [ADR-001: Hub-Spoke Network Architecture](./ADR-001-hub-spoke-network.md)
- [ADR-003: Entra ID Federation](./ADR-003-entra-id-federation.md)
- [GitHub Governance Guide](../../acme-tech/technical/github-governance.md)
