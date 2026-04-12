---
title: "Platform Engineering"
description: "This document describes the platform engineering capabilities operated by Acme Tech, providing foundational infrastructure, CI/CD compute, reusable mo"
---

# Platform Engineering

This document describes the platform engineering capabilities operated by Acme Tech, providing foundational infrastructure, CI/CD compute, reusable modules, and golden-path tooling for all Acme Corporation subsidiaries.

## Platform Engineering Mission

Acme Tech's Platform Engineering team provides the foundational infrastructure layer that enables all six subsidiaries to build, deploy, and operate their applications at enterprise scale. The team operates as an internal platform provider, treating subsidiary engineering teams as customers.

### Core Responsibilities

- **CI/CD Compute** — Self-hosted GitHub Actions runner infrastructure on AKS, serving all subsidiary pipelines
- **Infrastructure-as-Code Modules** — Private Terraform module library for standardized, secure Azure resource provisioning
- **Azure Landing Zones** — Subscription vending, management group hierarchy, and Azure Policy governance
- **Pipeline Templates** — Reusable GitHub Actions workflow templates enforcing organizational standards
- **FinOps** — Cost management, budgeting, rightsizing recommendations, and chargeback reporting

### Golden Paths with Escape Hatches

Platform Engineering provides opinionated golden paths for common infrastructure and deployment patterns. These golden paths represent the recommended, fully supported approach for provisioning resources and deploying workloads. Subsidiaries are encouraged to adopt golden paths for faster time-to-production and reduced operational burden.

When a subsidiary has a legitimate technical requirement that cannot be met by an existing golden path, an escape hatch process allows deviation. Escape hatches require a written justification, a security review, and an accepted operational responsibility agreement. The subsidiary assumes operational ownership of any custom infrastructure that diverges from golden-path patterns. For architectural context, see [Architecture Overview](../architecture/overview.md).

## Self-Hosted GitHub Actions Runners on AKS

### Architecture

All GitHub Actions workflow jobs execute on self-hosted runners deployed to a dedicated AKS cluster in the Acme Tech hub subscription. The cluster uses Actions Runner Controller (ARC) to provision ephemeral runner pods. Each job receives a fresh pod that is destroyed after completion, ensuring a clean execution environment and preventing cross-job contamination.

The runner infrastructure is shared across all subsidiaries. Runner groups provide resource isolation and access controls to ensure subsidiaries receive appropriate compute resources without interference.

### Runner Groups

| Runner Group | Image | Resources | Access | Use Case |
|---|---|---|---|---|
| `acme-default` | Ubuntu 22.04 | 4 vCPU / 16 GB RAM | All subsidiaries | Standard CI/CD workloads (build, test, lint, deploy) |
| `acme-large` | Ubuntu 22.04 | 8 vCPU / 32 GB RAM | Requires platform team approval | Resource-intensive builds (large monorepos, integration test suites) |
| `acme-gpu` | Ubuntu 22.04 + CUDA | NVIDIA T4 GPU | Data & AI team only | ML model training, GPU-accelerated testing |
| `acme-windows` | Windows Server 2022 | 4 vCPU / 16 GB RAM | Acme Insurance (primary) | .NET Framework builds, Windows-specific testing (legacy migration) |

### Autoscaling

Runner pod scaling is managed by KEDA (Kubernetes Event-Driven Autoscaling) using GitHub webhook events as the scale trigger:

- **Scale-to-Zero** — Runner groups scale to zero pods when no jobs are queued, minimizing idle compute costs
- **Maximum Scale** — Each runner group scales to a maximum of 200 concurrent pods
- **Scale Trigger** — GitHub `workflow_job` webhook events trigger pod creation within 15 seconds of job queue
- **Cooldown** — Pods are terminated 30 seconds after job completion

### Security Controls

- **Namespace Isolation** — Each runner group operates in a dedicated Kubernetes namespace with Network Policies preventing cross-namespace traffic
- **Network Policies** — Runner pods can reach only the Kubernetes API server, Azure Firewall egress endpoint, and internal DNS
- **Azure Firewall Egress** — All outbound traffic routes through Azure Firewall with explicit allowlisting for: GitHub Packages, npm registry, NuGet.org, PyPI, Docker Hub mirror (Azure Container Registry cache), and Azure service endpoints
- **Managed Identity** — Runner pods authenticate to Azure using AKS workload identity (Entra ID federated tokens), eliminating stored credentials
- **No Privileged Containers** — Runner pods execute as non-root with read-only root filesystem where possible

### Maintenance Schedule

| Activity | Frequency | Process |
|---|---|---|
| Runner image rebuild | Weekly (Tuesday) | Automated pipeline updates base OS packages, language runtimes, and tooling |
| ARC Helm chart update | Monthly | Platform team reviews changelog, tests in staging cluster, promotes to production |
| AKS node OS patching | Automated (Azure managed) | Node image auto-upgrade channel set to `NodeImage` |
| Kubernetes version upgrade | Quarterly | Staged rollout: dev then staging then production with 1-week soak per stage |

### Monitoring and Alerting

Runner infrastructure health is monitored through Datadog with the following alert thresholds:

| Metric | Threshold | Severity | Response |
|---|---|---|---|
| Job queue depth | > 50 queued jobs for > 5 min | P3 | Investigate scaling, check KEDA logs |
| Pod failure rate | > 5% of jobs in 30-min window | P2 | Page platform on-call, check node health |
| Cluster CPU utilization | > 80% sustained for 15 min | P2 | Scale node pool, review resource requests |
| Node NotReady | Any node NotReady > 3 min | P2 | Automated cordon + drain, alert platform on-call |

## Terraform Module Library

### Private Registry

Acme Tech operates a private Terraform module registry backed by GitHub releases in the `acme-tech` organization. All modules follow HashiCorp's standard module structure and are published as versioned GitHub releases consumed via the `source` block in Terraform configurations.

### Module Catalog

| Module | Description | Current Version |
|---|---|---|
| `terraform-azurerm-vnet` | Virtual network with subnets, NSGs, route tables, and hub peering. Supports hub-spoke topology. | v3.2.1 |
| `terraform-azurerm-aks` | AKS cluster with Entra ID integration, workload identity, CNI overlay networking, and Defender for Containers. | v4.1.0 |
| `terraform-azurerm-storage` | Storage account with private endpoints, lifecycle policies, immutability for compliance, and diagnostic settings. | v2.5.3 |
| `terraform-azurerm-keyvault` | Key Vault with RBAC authorization, private endpoint, soft-delete, purge protection, and diagnostic logging. | v2.3.0 |
| `terraform-azurerm-apim` | API Management instance with VNet integration, custom domains, and named value configuration. | v3.0.2 |
| `terraform-azurerm-cosmosdb` | Cosmos DB account with partition key configuration, automatic failover, and backup policies. | v2.1.4 |
| `terraform-azurerm-ai-search` | Azure AI Search service with private endpoint, managed identity, and index management hooks. | v1.4.0 |
| `terraform-azurerm-openai` | Azure OpenAI Service with model deployment, content filtering, and managed identity authentication. | v1.2.1 |

### Versioning and Consumption

All modules follow Semantic Versioning (SemVer). Consumers must pin to a minor version (e.g., `~> 3.2`) to receive patch updates automatically while avoiding breaking changes. Every release includes a detailed changelog documenting additions, changes, deprecations, and migration instructions.

### Automated Testing

Every module PR triggers an automated test suite built with Terratest (Go):

1. **Unit Tests** — Validate Terraform plan output for expected resource configurations
2. **Integration Tests** — Deploy resources to a dedicated test subscription, validate connectivity and configuration, then tear down
3. **Compliance Tests** — Verify Azure Policy compliance for deployed resources

Tests execute on the `acme-default` runner group. Integration tests run against an isolated test subscription with a 4-hour TTL for all resources.

### Contribution Process

Subsidiaries are encouraged to contribute modules or enhancements:

1. Contributor opens a PR against the module repository in `acme-tech`
2. Platform Engineering reviews within 2 business days
3. Security review is required for modules that manage network, identity, or encryption resources
4. Approved PRs are merged and a new release is tagged
5. Module consumers receive update notifications via the `#platform-modules` Slack channel

## Azure Landing Zones

### Management Group Hierarchy

```
Acme Corporation (Tenant Root)
├── Platform
│   ├── Acme Tech (hub networking, shared services)
│   ├── Identity (Entra ID management)
│   └── Management (Log Analytics, Automation)
├── Landing Zones
│   ├── Acme Retail
│   ├── Acme FSI
│   ├── Acme Telco
│   ├── Acme Insurance
│   ├── Acme Distribution
│   └── Acme Media
└── Sandbox
```

The hierarchy follows the Azure Cloud Adoption Framework landing zone architecture. Each subsidiary's management group contains production and non-production subscriptions. The Platform management group hosts shared infrastructure operated by Acme Tech. The Sandbox management group provides isolated experimentation environments with relaxed policies and strict budget limits.

### Azure Policy Assignments

Policies are assigned at the management group level to enforce governance guardrails:

| Policy | Effect | Scope | Purpose |
|---|---|---|---|
| Require resource tags | Deny | Landing Zones | Enforce `cost-center`, `subsidiary`, `environment`, `owner` tags |
| Deny public IP addresses | Deny | Landing Zones | Prevent accidental public exposure |
| Require HTTPS / TLS 1.2+ | Deny | All (except Sandbox) | Enforce transport encryption |
| Require Private Endpoints | Audit to Deny | Landing Zones | Phase out public endpoints for PaaS services |
| Audit unencrypted storage | Audit | All | Detect storage accounts without encryption at rest |
| Enforce allowed VM SKUs | Deny | Landing Zones | Restrict to cost-approved and security-hardened VM sizes |
| Deny non-approved regions | Deny | All | Restrict deployments to East US 2 and Central US (primary/DR) |

### Subscription Vending

New subsidiary subscriptions are provisioned through an automated Terraform-based vending pipeline:

1. Subsidiary requests a new subscription via the platform self-service portal
2. Platform team reviews and approves the request
3. Terraform pipeline creates the subscription under the appropriate management group
4. Automated post-provisioning configures: VNet with hub peering, default NSG rules, route table with Azure Firewall as next hop, standard resource groups (`rg-{subsidiary}-{env}-{purpose}`), RBAC role assignments, diagnostic settings forwarding to central Log Analytics
5. Subsidiary team receives access credentials and onboarding documentation

## CI/CD Pipeline Templates

### Reusable Workflow Library

Acme Tech maintains a library of reusable GitHub Actions workflows in the `acme-tech/.github` repository. Subsidiaries consume these workflows using the `uses` directive:

```yaml
uses: acme-tech/.github/.github/workflows/terraform-plan-apply.yml@v2
```

### Available Templates

| Template | Purpose | Key Steps |
|---|---|---|
| `terraform-plan-apply.yml` | Infrastructure provisioning | Terraform init, validate, plan (PR comment), apply (on merge) |
| `docker-build-push.yml` | Container image builds | Docker build, Trivy scan, push to Azure Container Registry |
| `dotnet-build-test.yml` | .NET application CI | Restore, build, test, publish artifacts |
| `node-build-test.yml` | Node.js application CI | npm ci, lint, test, build |
| `python-build-test.yml` | Python application CI | pip install, lint (ruff), test (pytest), build wheel |
| `deploy-aks.yml` | Kubernetes deployment | Helm lint, template, deploy to AKS (blue-green with canary) |

### Required Security Workflow

The `security-scan.yml` workflow is mandatory on every pull request across all organizations. It executes:

- **CodeQL** — Static analysis for the repository's detected languages
- **Secret Scanning** — Validates no secrets are present in the changeset
- **Dependency Review** — Flags new dependencies with known vulnerabilities

This workflow cannot be skipped or overridden. It is enforced as a required status check at the enterprise level.

### Actions Allowlist

Only actions from trusted namespaces are permitted: `actions/*`, `github/*`, and `acme-tech/*`. Any third-party action requires a formal request via the `acme-tech/actions-allowlist` repository. Requests must include a security justification, and approved actions must be pinned by SHA (not by tag) to prevent supply-chain attacks. For governance details, see [GitHub Governance](./github-governance.md) and [ADR-002: GitHub Enterprise Cloud](../architecture/adr/ADR-002-github-enterprise-cloud.md).

## Infrastructure Provisioning Workflow

The end-to-end infrastructure provisioning workflow follows a GitOps model:

1. **Branch** — Engineer creates a feature branch with Terraform configuration changes
2. **Plan** — Pull request triggers `terraform plan`, and the plan output is posted as a PR comment for review
3. **Review** — Two approvals required: one from the Platform Engineering team and one from the requesting subsidiary team
4. **Apply** — Merge to `main` triggers `terraform apply` with the approved plan file
5. **Validation** — Post-apply smoke tests verify resource health and connectivity
6. **Drift Detection** — Nightly scheduled pipeline runs `terraform plan` against all state files. Drift is reported to the `#infra-drift` Slack channel for investigation

State files are stored in Azure Storage with blob versioning and soft-delete enabled. State locking uses Azure Storage blob leases to prevent concurrent modifications.

## Cost Management and FinOps

### Budget Management

Monthly cost budgets are configured for each subsidiary subscription with three-tier alerting:

| Threshold | Action |
|---|---|
| 80% of budget | Email notification to subsidiary finance contact and platform team |
| 90% of budget | Slack alert to `#finops-alerts`, subsidiary leadership notified |
| 100% of budget | P3 incident created, spending review meeting scheduled within 24 hours |

### Cost Allocation

Resource tagging is enforced by Azure Policy (deny on missing tags). Required tags include:

- `cost-center` — Subsidiary billing code
- `subsidiary` — Owning subsidiary name
- `environment` — prod, staging, dev, sandbox
- `owner` — Responsible team or individual

Tags feed into the central FinOps dashboard (Power BI connected to Azure Cost Management exports) for chargeback reporting.

### Optimization Practices

- **Quarterly Rightsizing** — Azure Advisor recommendations are reviewed quarterly. Underutilized VMs and databases are rightsized or deallocated.
- **Reserved Instances** — 3-year Reserved Instances are purchased for predictable steady-state workloads (AKS node pools, SQL databases). Current RI coverage targets 70% of compute spend.
- **Savings Plans** — Azure Savings Plans cover variable workloads that do not fit RI patterns.
- **Anomaly Detection** — Datadog cost monitors alert on spend increases exceeding 20% week-over-week for any subsidiary subscription. Alerts route to the FinOps team and subsidiary platform lead.

---

*For the overall platform architecture, see [Architecture Overview](../architecture/overview.md). For GitHub Enterprise configuration decisions, see [ADR-002: GitHub Enterprise Cloud](../architecture/adr/ADR-002-github-enterprise-cloud.md). For GitHub governance policies, see [GitHub Governance](./github-governance.md).*
