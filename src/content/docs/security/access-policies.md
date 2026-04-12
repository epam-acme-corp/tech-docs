---
title: "Access Policies & RBAC Model"
description: "This document defines the Role-Based Access Control (RBAC) model, access tiers, and authorization policies enforced across all Acme Corporation platfo"
---

# Access Policies & RBAC Model

This document defines the Role-Based Access Control (RBAC) model, access tiers, and authorization policies enforced across all Acme Corporation platforms. These policies implement the principle of least privilege and ensure subsidiary-scoped access by default.

## RBAC Model Overview

Role-Based Access Control is the primary authorization model across every platform operated by Acme Tech. All access grants follow three foundational principles:

1. **Least Privilege** — Users receive the minimum permissions required for their role. Broad access is never granted by default.
2. **Subsidiary Scoping** — Access is scoped to the user's subsidiary unless a cross-subsidiary business justification is approved and documented.
3. **Just-in-Time Elevation** — Privileged access is not standing. Administrative roles are activated through PIM with a time-bound window and approval chain.

RBAC assignments are derived from Entra ID group memberships, which are provisioned through the identity lifecycle process documented in [Identity & Access Management Architecture](./identity-access-management.md). For the architectural rationale, see [Architecture Overview](../architecture/overview.md) and [ADR-003: Entra ID Federation](../architecture/adr/ADR-003-entra-id-federation.md).

## Azure Subscription RBAC

### Subscription Model

Each subsidiary operates within a dedicated Azure subscription, providing billing isolation, policy boundaries, and RBAC scoping. Acme Tech maintains a shared subscription for hub networking, shared services, and platform tooling.

| Subscription | Owner |
|---|---|
| acme-tech-platform | Acme Tech Platform Engineering |
| acme-retail-prod | Acme Retail |
| acme-fsi-prod | Acme Financial Services |
| acme-telco-prod | Acme Telco |
| acme-insurance-prod | Acme Insurance |
| acme-distribution-prod | Acme Distribution |
| acme-media-prod | Acme Media |

### Role Assignments

| Azure Role | Assigned To | Scope | Notes |
|---|---|---|---|
| Owner | Acme Tech Platform Engineering | Subscription | Restricted to the Platform Engineering team; no subsidiary team holds Owner |
| Contributor | Subsidiary platform teams | Resource Group | Scoped to resource groups within the subsidiary's subscription |
| Reader | Compliance and audit teams | Cross-subscription | Read-only access for regulatory audits and compliance reviews |
| `AKS Deployment Operator` (custom) | Acme FSI DevOps team | FSI AKS clusters | Custom role granting deployment permissions without cluster admin rights. Created to satisfy FSI regulatory requirements for separation of duties |

### Elevation Process

Standing Contributor or Owner assignments are prohibited for individual users. All privileged Azure roles are activated through PIM with the following requirements:

- Business justification required at activation
- Maximum activation window: 8 hours
- Approval required for Owner role (approved by VP Platform Engineering)
- Contributor activations are self-service with audit logging

## GitHub Organization Roles

### Enterprise Roles

| Role | Assigned To | Count | Responsibilities |
|---|---|---|---|
| Enterprise Owner | VP Platform Engineering, VP Security | 2 | Enterprise settings, billing, audit log, EMU configuration |
| Enterprise Member | All provisioned EMU users | ~4,500 | Base access, visible membership |

### Organization Roles

| Role | Assigned To | Max Per Org | Responsibilities |
|---|---|---|---|
| Org Owner | Subsidiary CTO + Lead Architect | 5 | Org settings, repository creation, team management |
| Team Maintainer | Team leads | Per team | Team membership, repository access for the team |
| Member | Standard developers | Unlimited | Repository access based on team membership |
| Outside Collaborator | External contributors | As approved | Time-limited access, 90-day review cycle, restricted to named repositories |

Outside Collaborators are reviewed every 90 days by the sponsoring team lead. Access is automatically revoked if the review is not completed within 7 days of the review notification. All Outside Collaborator accounts are excluded from SCIM provisioning and managed through a dedicated request workflow.

## API Gateway Access Tiers

Azure API Management enforces three access tiers for API consumers, each with distinct authentication, rate limiting, and approval requirements:

| Tier | Use Case | Authentication | Rate Limit | Approval |
|---|---|---|---|---|
| Tier 1 — Internal | Subsidiary-to-subsidiary API calls | OAuth 2.0 client credentials (Entra ID) | Gold (10,000 req/min) | Self-service portal, platform team approval |
| Tier 2 — Partner | Approved external partner integrations | API key + OAuth 2.0 | Silver (1,000 req/min) | Business owner + security review |
| Tier 3 — Public | Public-facing APIs | API key (subscription required) | Bronze (100 req/min) | API product owner approval |

### Tier 1 — Internal

Internal APIs are consumed exclusively by Acme Corporation subsidiaries. Authentication uses OAuth 2.0 client credentials flow with Entra ID service principals. Each consuming application receives a dedicated service principal scoped to the specific API product. Self-service registration is available through the APIM developer portal, with automatic approval for standard APIs and platform team approval for sensitive data APIs.

### Tier 2 — Partner

Partner APIs are exposed to approved external organizations under contractual agreements. Authentication requires both an API subscription key and an OAuth 2.0 bearer token issued by the partner's identity provider (federated via Entra ID B2B). Each partner integration requires business owner sponsorship and a security review before activation.

### Tier 3 — Public

Public APIs are available to any registered consumer. Authentication requires an API subscription key obtained through the public developer portal. Rate limits are enforced at the Bronze tier by default, with upgrades available upon review.

## Data Platform Access

### Snowflake

Snowflake access is governed by Row-Level Security (RLS) policies that enforce subsidiary data isolation at the query layer. Each subsidiary's data resides in dedicated databases with RLS policies preventing cross-subsidiary reads unless explicitly granted through a data sharing agreement approved by both subsidiary data owners.

### Azure AI Search

Index-level isolation separates subsidiary content. Each subsidiary maintains dedicated search indexes for their domain data. A shared corporate index contains cross-subsidiary reference data (product catalogs, organizational data) accessible to all authenticated users. Index-level RBAC is enforced through API key scoping and Entra ID authentication.

### Cosmos DB

Partition key design enforces subsidiary data isolation at the storage layer. Each subsidiary's data uses a subsidiary-scoped partition key. Cross-partition queries are restricted to administrative service principals operated by the Acme Tech data platform team. Application-level service principals are scoped to their subsidiary's partition key range.

## Privileged Access Workstations

Administrative operations on sensitive platforms require Privileged Access Workstations (PAWs):

**Required for:**
- Entra ID tenant administration
- Azure subscription Owner or Contributor operations
- GitHub Enterprise Owner operations
- Snowflake ACCOUNTADMIN operations

**PAW Configuration:**
- Intune-enrolled and Autopilot-provisioned
- Application allowlisting (only approved management tools permitted)
- Web browsing restricted to Azure portal, GitHub, and approved management consoles
- USB storage devices disabled via device configuration policy
- Endpoint Detection and Response (EDR) with enhanced telemetry

**Access Controls:**
- PAW access is activated through PIM with a maximum 8-hour session
- Multi-factor authentication required at PAW login and again at PIM activation
- All PAW sessions are logged to the central audit pipeline with 90-day retention

---

*For identity provisioning and SSO details, see [Identity & Access Management Architecture](./identity-access-management.md). For the overall platform architecture, see [Architecture Overview](../architecture/overview.md).*
