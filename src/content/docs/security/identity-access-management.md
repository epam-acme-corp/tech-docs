---
title: "Identity & Access Management Architecture"
description: "This document defines the centralized Identity and Access Management (IAM) architecture operated by Acme Tech on behalf of all Acme Corporation subsid"
---

# Identity & Access Management Architecture

This document defines the centralized Identity and Access Management (IAM) architecture operated by Acme Tech on behalf of all Acme Corporation subsidiaries. The IAM platform provides a single authoritative identity source, unified authentication, automated provisioning, and policy-driven access controls across the enterprise.

## IAM Architecture Overview

Acme Tech's IAM team (~200 staff across identity engineering, operations, and governance) owns and operates the centralized identity platform serving all six subsidiaries: Acme Retail, Acme Financial Services, Acme Telco, Acme Insurance, Acme Distribution, and Acme Media. The platform provides a consistent security posture while allowing subsidiaries to maintain operational autonomy within defined guardrails.

The architecture centers on a single Microsoft Entra ID tenant (`acmecorp.onmicrosoft.com`) as the authoritative identity source for the entire organization. All downstream systems receive identity data from this tenant via industry-standard federation protocols:

- **GitHub Enterprise (EMU)** — SAML 2.0 for authentication, SCIM 2.0 for provisioning
- **Datadog** — SAML 2.0 for authentication, SCIM 2.0 for role mapping
- **Snowflake** — SAML 2.0 for authentication, SCIM 2.0 for user/role provisioning
- **Azure RBAC** — Native Entra ID integration for subscription and resource-level authorization
- **Azure API Management** — OIDC for developer portal, OAuth 2.0 for API authorization

This hub-and-spoke model ensures that identity lifecycle events (joins, moves, leaves) propagate consistently to every integrated system without manual intervention. For architectural context and the rationale behind this federation approach, refer to [Architecture Overview](../architecture/overview.md) and [ADR-003: Entra ID Federation](../architecture/adr/ADR-003-entra-id-federation.md).

## Entra ID Tenant Architecture

### Tenant Configuration

Acme Corporation operates a single Entra ID tenant licensed at the P2 tier, enabling the full suite of identity protection and governance capabilities:

- **Conditional Access** — Policy-driven access controls based on user, device, location, and risk signals
- **Privileged Identity Management (PIM)** — Just-in-time role activation for administrative access
- **Identity Protection** — Risk-based detection for compromised credentials and anomalous sign-in behavior
- **Access Reviews** — Quarterly automated reviews for group memberships and role assignments

### Directory Structure

The directory is organized using Administrative Units (AUs) mapped to each subsidiary, providing delegated management without cross-subsidiary visibility:

| Administrative Unit | Scope | Delegated Admins |
|---|---|---|
| AU-Retail | Acme Retail users and groups | Retail IT Ops |
| AU-FSI | Acme Financial Services users and groups | FSI IT Ops |
| AU-Telco | Acme Telco users and groups | Telco IT Ops |
| AU-Insurance | Acme Insurance users and groups | Insurance IT Ops |
| AU-Distribution | Acme Distribution users and groups | Distribution IT Ops |
| AU-Media | Acme Media users and groups | Media IT Ops |

### Group Naming Convention

Security groups follow the standardized naming convention `ACM-{subsidiary}-{role}`, enabling consistent mapping across all downstream systems. Representative groups include:

- `ACM-RETAIL-DEVELOPERS` — Retail engineering staff
- `ACM-RETAIL-ADMINS` — Retail platform administrators
- `ACM-FSI-DEVELOPERS` — Financial Services engineering staff
- `ACM-FSI-ADMINS` — Financial Services platform administrators
- `ACM-TECH-PLATFORM-ENGINEERING` — Acme Tech platform team
- `ACM-TECH-SECURITY` — Acme Tech security team

These groups are synchronized to GitHub Enterprise teams via SCIM, Datadog roles via SCIM mapping, and Snowflake roles via automated provisioning. Group membership changes in Entra ID cascade to all connected systems within the provisioning cycle window.

### Guest Access

External partner access uses Entra ID B2B collaboration. Guest accounts are provisioned only for approved partner organizations listed in the cross-tenant access policy. Conditional Access policies restrict guest users to designated applications and enforce MFA at every sign-in regardless of partner tenant policies.

### Hybrid Identity

Acme Insurance maintains a legacy on-premises Active Directory environment synchronized to Entra ID via Entra Connect (formerly Azure AD Connect). This hybrid configuration supports legacy line-of-business applications that have not yet migrated to cloud authentication. The on-premises AD is scheduled for full decommission by Q4 2025, at which point all Insurance identities will be cloud-native. All other subsidiaries operate as cloud-only.

## SSO Configuration

### SAML 2.0 Integrations

SAML-based SSO is configured for applications that do not support OIDC natively:

- **GitHub Enterprise (EMU)** — SAML assertion includes group memberships for team mapping. NameID format is `user.userprincipalname`. Signing certificate managed in Key Vault with 12-month rotation.
- **Snowflake** — SAML assertion includes subsidiary and role attributes. Custom attribute mapping drives warehouse and role assignment at login.
- **Datadog** — SAML assertion maps `ACM-{subsidiary}-{role}` groups to Datadog roles. Auto-provisioning creates Datadog users on first login.

### OIDC Integrations

OIDC is the preferred protocol for Azure-native and custom applications:

- **Azure Kubernetes Service (AKS)** — Entra ID integrated OIDC for kubectl authentication and Kubernetes RBAC
- **Azure API Management Developer Portal** — OIDC sign-in with group-based access to API products
- **Custom Internal Applications** — MSAL-based authentication with app registrations in Entra ID

### Authentication Flow

1. User navigates to target application
2. Application redirects to Entra ID authorization endpoint
3. Entra ID evaluates Conditional Access policies (MFA, device compliance, risk level)
4. User completes authentication (and MFA if required)
5. Entra ID issues SAML assertion or OIDC token containing group claims
6. Application grants access based on group membership and role mapping

### Session Lifetime Policies

| Session Type | Lifetime | Applies To |
|---|---|---|
| Standard user | 8 hours | All non-admin users |
| Administrative user | 4 hours | Users with standing admin roles |
| Privileged (PIM-activated) | 1 hour | Users with JIT-activated privileged roles |
| Refresh token (standard) | 90 days | All users (revoked on termination) |
| Refresh token (admin) | 24 hours | Administrative accounts |

## SCIM Provisioning

### GitHub Enterprise (EMU)

GitHub Enterprise Managed Users (EMU) provisioning is managed entirely through SCIM from Entra ID. Key configuration details:

- **Username Format** — Entra ID UPN prefix with `_acme` suffix (e.g., `jsmith_acme`). This suffix is required by the EMU model and cannot be customized.
- **Group-to-Team Mapping** — Entra ID security groups are mapped to GitHub teams. `ACM-RETAIL-DEVELOPERS` provisions to the `retail-developers` team in the `acme-retail` organization.
- **Provisioning Cycle** — Incremental sync runs every 40 minutes. Full sync is triggered manually when schema changes occur.
- **Known Limitation** — Groups exceeding 500 members experience provisioning delays of up to 2 hours due to Microsoft Graph API pagination. The IAM team is collaborating with Microsoft support to address this through batched delta queries.

### Datadog

Datadog SCIM provisioning maps Entra ID groups to subsidiary-scoped Datadog roles:

| Entra ID Group | Datadog Role | Scope |
|---|---|---|
| `ACM-{subsidiary}-ADMIN` | Datadog Admin | Subsidiary org |
| `ACM-{subsidiary}-DEVELOPERS` | Standard User | Subsidiary org |
| `ACM-{subsidiary}-READONLY` | Read Only | Subsidiary org |
| `ACM-TECH-SECURITY` | Security Admin | Enterprise-wide |

Provisioning cycles run on the same 40-minute cadence as GitHub EMU. Role changes propagate within one cycle.

### Snowflake

Snowflake user provisioning creates accounts mapped to subsidiary-specific virtual warehouses and databases. Row-Level Security (RLS) policies enforce subsidiary data isolation at the query layer, preventing cross-subsidiary data access even for users with broad role assignments. User-to-role mapping follows the same `ACM-{subsidiary}-{role}` convention, with roles translated to Snowflake RBAC roles during provisioning.

### Provisioning Monitoring

SCIM provisioning health is monitored through Azure Monitor with alerts configured for:

- **SCIM Failures** — Any provisioning error triggers a P3 alert to the IAM operations Slack channel
- **Quarantined Applications** — SCIM quarantine status triggers an immediate P2 alert (provisioning halted)
- **Propagation Delays** — Provisioning cycles exceeding 2 hours trigger a P3 alert for investigation
- **Orphaned Accounts** — Weekly reconciliation job identifies accounts in downstream systems without a matching Entra ID identity

## Conditional Access Policies

The following Conditional Access policies enforce the zero-trust security posture across all Acme Corporation cloud applications:

| Policy Name | Target | Conditions | Controls |
|---|---|---|---|
| Require MFA for All Users | All users | All cloud apps | Require MFA (phishing-resistant preferred) |
| Compliant Device for Admin | Admin roles | Azure portal, GitHub Enterprise admin | Require compliant device + MFA |
| Block Legacy Auth | All users | Exchange Online, legacy protocols | Block access |
| Location-Based Restriction | All users (except break-glass) | Sign-in from non-approved countries | Block access |
| Risk-Based MFA | All users | Sign-in risk Medium or High | Require MFA + password change |
| Session Control for Sensitive Apps | All users | Snowflake, Azure portal | Sign-in frequency 4hr, no persistent browser |
| Guest Access Restriction | Guest users | All apps except approved partner apps | Block access |

Policies are reviewed quarterly by the IAM governance board. Changes require a change request approved by both the IAM team lead and the CISO. Emergency policy modifications follow the incident response escalation path documented in the security operations runbook.

## PAT Governance

Personal Access Tokens (PATs) for GitHub Enterprise are governed by strict organizational policies to minimize credential sprawl:

- **Maximum Lifetime** — 90 days. Tokens are limited to fine-grained PATs only; classic PATs are blocked at the enterprise level.
- **Scope Restrictions** — Tokens must be scoped to specific repositories. Organization-wide PATs are prohibited by enterprise policy.
- **Approval Workflow** — PATs intended for CI/CD pipelines require approval from the repository CODEOWNERS and the subsidiary platform lead.
- **Quarterly Audit** — The IAM team runs quarterly PAT audits. Tokens unused for more than 30 days are flagged for revocation, and owners receive automated notifications.
- **Service Accounts** — Machine-to-machine authentication must use Entra ID service principals or managed identities. Personal PATs are not permitted for service workloads. GitHub Actions pipelines use OIDC-based Workload Identity Federation to authenticate to Azure, eliminating stored secrets entirely.

## Service Principal Management

Service principals are the authorized method for application and pipeline authentication to Azure resources. Governance requirements include:

- **Dedicated Principals** — Each application or pipeline receives a dedicated service principal. Sharing service principals across applications or pipelines is prohibited.
- **Certificate-Based Authentication** — Production service principals must use certificate credentials. Client secrets are permitted only for non-production environments and expire after 30 days.
- **Key Vault Integration** — Certificates are stored and managed in Azure Key Vault. Standard certificates have a 90-day validity with automated rotation triggered at 60 days.
- **Workload Identity Federation** — GitHub Actions workflows authenticate to Azure using OIDC-based Workload Identity Federation. Subject claims are scoped to specific repositories and environments, preventing cross-repository token reuse.
- **Ownership Tracking** — Every service principal has a documented owner (team and individual). The IAM team runs a monthly scan for orphaned service principals (no owner or no sign-in activity in 90 days) and initiates decommission workflows.

## Emergency Break-Glass Accounts

Two cloud-only emergency access accounts are maintained for scenarios where normal authentication is unavailable (Entra ID outage, Conditional Access misconfiguration, MFA service disruption):

- **Account Type** — Cloud-only (not federated), excluded from all Conditional Access policies
- **Storage** — Credentials stored in sealed envelopes within physical safes at Chicago HQ (primary) and Denver DR site (secondary)
- **Password Policy** — 32-character randomly generated passwords, rotated quarterly by the CISO and VP of Platform Engineering jointly
- **Monitoring** — Azure Monitor P1 (critical) alert fires on any sign-in activity from either break-glass account. Alerts route to the security operations on-call pager and the CISO direct.
- **Testing** — Monthly authentication tests are conducted during a scheduled maintenance window to verify account functionality and alert triggering. Tests are logged in the IAM operations audit trail.

## Identity Lifecycle Management

### Joiner Process

1. HR records new hire in Workday with subsidiary, department, role, and start date
2. Azure Logic App integration detects Workday event and creates Entra ID account in the appropriate Administrative Unit
3. Dynamic group rules assign the user to `ACM-{subsidiary}-{role}` groups based on Workday attributes
4. SCIM provisioning propagates identity to GitHub EMU, Datadog, and Snowflake
5. User receives onboarding email with self-service password reset and MFA registration instructions
6. Full provisioning completes within 2 hours of the Workday record activation

### Mover Process

1. Manager initiates role change or subsidiary transfer in Workday
2. Logic App detects attribute change and updates Entra ID profile and Administrative Unit assignment
3. Dynamic group rules recalculate, adding new group memberships and scheduling removal of previous groups
4. Access review is triggered for the user's manager to confirm the new access scope is appropriate
5. A 14-day grace period maintains previous access to allow knowledge transfer and project handoff
6. After the grace period, previous group memberships are revoked and downstream systems update via SCIM

### Leaver Process

1. HR processes termination in Workday (voluntary or involuntary)
2. Logic App immediately disables the Entra ID account (within 15 minutes of Workday event)
3. All active sessions and refresh tokens are revoked
4. GitHub EMU account is suspended (repositories and contributions preserved)
5. Datadog and Snowflake access is revoked via SCIM de-provisioning
6. Account enters 30-day soft-delete retention period for legal hold and audit purposes
7. After retention period, account and associated data are permanently deleted

For involuntary terminations flagged by HR, step 2 executes within 5 minutes via a priority automation path, and the security operations team is notified for potential forensic review.

---

*For the overall platform architecture, see [Architecture Overview](../architecture/overview.md). For the decision record on Entra ID as the identity provider, see [ADR-003: Entra ID Federation](../architecture/adr/ADR-003-entra-id-federation.md). For role-based access controls, see [Access Policies](./access-policies.md).*
