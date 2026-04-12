---
title: "ADR-003 — Entra ID as Unified Identity Provider with SCIM Federation"
description: "---"
---

# ADR-003: Entra ID as Unified Identity Provider with SCIM Federation

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2023-07-10 |
| **Deciders** | Marcus Chen (Group CTO), Amara Osei (Director of Identity), David Reeves (VP Security & CISO) |
| **Reviewed by** | Architecture Review Board |

---

## Context

As Acme Corporation consolidated its technology platforms under Acme Tech, establishing a unified identity provider became a prerequisite for all subsequent standardization efforts. Without a single source of truth for user identity, every platform integration (GitHub Enterprise, Datadog, Snowflake, Azure) would require independent user management — creating security gaps during offboarding, inconsistent access controls, and an unmanageable administrative burden.

The Identity & Access Management team evaluated three identity providers against the following requirements:

1. **Native Azure integration:** Acme Corporation has standardized on Microsoft Azure as its cloud platform. The identity provider must integrate natively with Azure RBAC, Azure AD-joined devices, and the Microsoft 365 suite already deployed across all subsidiaries.
2. **SCIM provisioning to GitHub EMU:** GitHub Enterprise Cloud with Enterprise Managed Users (see [ADR-002](./ADR-002-github-enterprise-cloud.md)) requires SCIM-based provisioning from a supported identity provider. The IdP must support GitHub's EMU SCIM integration for automated user lifecycle management.
3. **Conditional Access capabilities:** The enterprise requires policy-driven access controls that can enforce MFA, device compliance, location restrictions, and risk-based step-up authentication — all configurable per subsidiary and per application.
4. **Microsoft 365 compatibility:** All subsidiaries use Microsoft 365 for productivity (Exchange Online, SharePoint, Teams). The IdP must serve as the authoritative identity source for M365 licensing and access.

### Evaluated Options

| Criteria | Microsoft Entra ID (P2) | Okta Workforce Identity | Ping Identity |
|---|---|---|---|
| Azure RBAC integration | Native | Requires federation | Requires federation |
| GitHub EMU SCIM support | Supported (Microsoft tutorial) | Supported | Not officially supported |
| Conditional Access | Native, 100+ signal types | Okta Policies (comparable) | Less mature |
| M365 integration | Native (same tenant) | Requires federation + sync | Requires federation + sync |
| Existing deployment | Already in use (partial) | Not deployed | Not deployed |
| Cost | Included in M365 E5 bundle | Additional per-user cost | Additional per-user cost |

Microsoft Entra ID scored highest due to native Azure and M365 integration, GitHub EMU SCIM support, and the fact that Acme Corporation already operated a partial Entra ID deployment for Microsoft 365 productivity services.

---

## Decision

We will adopt **Microsoft Entra ID P2** as the unified identity provider for all Acme Corporation subsidiaries, with SCIM federation to all platform services.

### Tenant Configuration

- **Tenant:** `acmecorp.onmicrosoft.com`
- **Custom domains:** `acmecorp.com`, `acmeretail.com`, `acmefsi.com`, `acmetelco.com`, `acmeinsurance.com`, `acmedistribution.com`, `acmemedia.com`
- **License:** Microsoft Entra ID P2 (bundled with Microsoft 365 E5 for all subsidiaries)

### SCIM-Provisioned Applications

The following platform services receive automated user and group provisioning via SCIM:

| Application | Protocol | Provisioning Scope | Group Sync |
|---|---|---|---|
| GitHub Enterprise Cloud (EMU) | SCIM 2.0 | All engineering staff | Organization membership, team membership |
| Datadog | SCIM 2.0 | All operations and engineering staff | Role mapping (Admin, Standard, Read-only) |
| Snowflake | SCIM 2.0 | Data engineering and analytics staff | Database role mapping |
| Azure RBAC | Native | All staff | Subscription and resource group role assignments |

SCIM provisioning runs continuously with near-real-time synchronization. When a user is disabled in Entra ID (e.g., during offboarding), their accounts in GitHub, Datadog, and Snowflake are automatically suspended within minutes.

### Conditional Access Policies

Twelve Conditional Access policies enforce security baselines across the enterprise:

| Policy | Target | Controls |
|---|---|---|
| CA-001: Require MFA — All Users | All users, all cloud apps | Require multi-factor authentication |
| CA-002: Require Compliant Device — Admins | Global Admins, Privileged Role Admins | Require Intune-compliant or Entra-joined device |
| CA-003: Block Legacy Authentication | All users, all cloud apps | Block clients using legacy auth protocols (IMAP, POP3, SMTP) |
| CA-004: Require MFA — Azure Management | All users, Azure Management API | Require MFA for Azure portal and CLI operations |
| CA-005: Location-Based Block | All users, all cloud apps | Block sign-ins from countries not on the approved list |
| CA-006: Risk-Based MFA — Medium Risk | All users, all cloud apps | Require MFA when sign-in risk is Medium or above |
| CA-007: Risk-Based Password Change — High Risk | All users | Require password change when user risk is High |
| CA-008: Block Unmanaged Devices — Confidential Apps | All users, FSI and Insurance apps | Require managed device for applications processing confidential data |
| CA-009: Session Lifetime — 12 Hours | All users, all cloud apps | Enforce 12-hour maximum session lifetime with re-authentication |
| CA-010: Require App Protection — Mobile | All users, mobile platforms | Require Intune app protection policy for mobile access |
| CA-011: Require PAW — Production Access | Infrastructure and platform admins | Require Privileged Access Workstation for production environment access |
| CA-012: Require Terms of Use — External Guests | Guest users | Require acceptance of terms of use before accessing internal resources |

### Privileged Identity Management (PIM)

All administrative roles use just-in-time (JIT) activation through Entra ID Privileged Identity Management:

- **Eligible assignments:** Administrators are assigned roles as "eligible" rather than "active." They must explicitly activate the role when needed.
- **Activation duration:** Maximum 8 hours per activation. Extensions require re-approval.
- **Approval workflow:** Critical roles (Global Administrator, Privileged Role Administrator) require approval from a second administrator before activation.
- **Audit logging:** All PIM activations are logged and forwarded to Datadog for security monitoring and anomaly detection.

### PAT Governance

Personal Access Token (PAT) policies for GitHub Enterprise:

- **Maximum lifetime:** 90 days. Tokens exceeding 90 days are automatically blocked by enterprise policy.
- **Required scope:** Tokens must be scoped to the minimum repositories and permissions required. Enterprise-wide tokens are prohibited for non-service accounts.
- **Rotation reminders:** Automated notifications are sent 14 days and 3 days before token expiration.
- **Service account tokens:** Managed through Entra ID service principals with OIDC federation where possible, falling back to scoped fine-grained PATs with 90-day rotation for integrations that do not support OIDC.

### Break-Glass Accounts

Two break-glass (emergency access) accounts are maintained outside the Conditional Access policy framework:

- Stored in a physical safe at Acme Tech headquarters in Chicago, IL.
- Credentials are split between two senior leaders (Group CTO and VP Security & CISO).
- Accounts are excluded from all Conditional Access policies to ensure access during identity system outages.
- Login activity is monitored with immediate PagerDuty alerts on any authentication event.

---

## Consequences

### Positive

- **Native Azure integration:** Entra ID provides seamless, zero-configuration integration with Azure RBAC, Azure Key Vault, AKS managed identities, and all Azure PaaS services. No federation bridges or synchronization agents are required.
- **Single MFA experience:** All users authenticate through a single MFA flow regardless of the target application (GitHub, Datadog, Snowflake, Azure, M365). This reduces MFA fatigue and support tickets compared to per-application MFA.
- **Unified audit trail:** All authentication events, Conditional Access evaluations, PIM activations, and SCIM provisioning events flow into a single audit log, which is forwarded to Datadog for centralized security monitoring and correlation.
- **Risk-based authentication:** Entra ID P2's Identity Protection engine evaluates sign-in risk signals (unfamiliar location, impossible travel, anomalous token, leaked credentials) and automatically enforces step-up authentication or blocks, reducing the burden on the security operations team.
- **Automated lifecycle management:** SCIM provisioning ensures that when an employee is onboarded or offboarded in the HR system (which triggers Entra ID provisioning), their access to GitHub, Datadog, Snowflake, and all Azure resources is automatically granted or revoked.

### Negative

- **Microsoft platform dependency:** Adopting Entra ID as the sole identity provider deepens the enterprise's dependency on the Microsoft ecosystem. Migrating to an alternative IdP in the future would be a major undertaking requiring re-integration of every SCIM-provisioned application and migration of all Conditional Access policies.
- **SCIM group synchronization delays:** SCIM group synchronization to GitHub EMU can experience propagation delays of up to 40 minutes for large group changes (e.g., onboarding a cohort of new engineers). During this window, users may have Entra ID access but not yet have their GitHub organization membership.
- **Conditional Access policy complexity:** Twelve Conditional Access policies with overlapping scopes, exclusions, and conditions are difficult to reason about holistically. Policy interactions can produce unexpected access denials that are challenging to troubleshoot.

### Mitigations

- **Quarterly Conditional Access review:** The Identity & Access Management team conducts a quarterly review of all Conditional Access policies using Entra ID's "What If" analysis tool to identify policy conflicts, coverage gaps, and unintended interactions.
- **Automated SCIM testing:** A nightly integration test validates SCIM provisioning and deprovisioning across GitHub, Datadog, and Snowflake by creating a test user in Entra ID and verifying that the account appears (and is subsequently removed) in each downstream application.
- **Break-glass accounts:** Two emergency access accounts (described above) provide access to the Entra ID tenant even during identity infrastructure failures, ensuring that the enterprise is never locked out of its own systems.
- **SCIM delay documentation:** The Developer Experience onboarding documentation clearly communicates expected SCIM propagation times so that new engineers understand that GitHub access may take up to 60 minutes after Entra ID account activation.

---

## Related Documents

- [Platform Architecture Overview](../overview.md)
- [ADR-001: Hub-Spoke Network Architecture](./ADR-001-hub-spoke-network.md)
- [ADR-002: GitHub Enterprise Cloud Standardization](./ADR-002-github-enterprise-cloud.md)
- [Identity & Access Management Guide](../../acme-tech/security/identity-access-management.md)
