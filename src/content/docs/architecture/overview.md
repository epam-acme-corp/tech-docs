---
title: "Acme Tech — Platform Architecture Overview"
description: "This document describes the platform architecture that Acme Tech operates on behalf of all Acme Corporation subsidiaries. It covers the architecture v"
---

# Acme Tech — Platform Architecture Overview

This document describes the platform architecture that Acme Tech operates on behalf of all Acme Corporation subsidiaries. It covers the architecture vision, design principles, technology stack, integration patterns, security posture, and resilience strategy. This is the authoritative reference for how the shared technology platform is structured and why specific architectural decisions were made.

For business context on Acme Tech's mission and organizational structure, see the [Business Overview](../business/overview.md).

---

## Architecture Vision

The Acme Tech platform architecture exists to provide a **secure, scalable, and standardized foundation** upon which all six Acme Corporation subsidiaries build and operate their business applications. The architecture must balance two competing forces: the need for enterprise-wide consistency in security, identity, and infrastructure; and the need for subsidiary autonomy in technology choices, deployment cadences, and product innovation.

**Design Philosophy:** Subsidiary autonomy within guardrails. The platform provides opinionated defaults (golden paths) for common patterns — deploying a containerized application, provisioning a database, integrating with the API gateway — while allowing subsidiaries to diverge when business requirements demand it. Divergence requires an Architecture Decision Record (ADR) and Architecture Review Board (ARB) approval.

**Architecture Review Board (ARB):** The ARB meets bi-weekly and includes the Group CTO (Marcus Chen), VP Platform Engineering (Sarah Okonkwo), VP Security & CISO (David Reeves), Head of Data & AI (Priya Sharma), Director of Infrastructure (James Kowalski), and rotating representatives from two subsidiary engineering teams. The ARB reviews and approves all ADRs, evaluates new technology proposals, and adjudicates architectural disputes.

All significant architectural decisions are documented as ADRs in the `acme-tech/architecture-decisions` repository, using the standard template that captures context, decision, consequences, and status. ADRs referenced in this document include:
- [ADR-001: Hub-Spoke Network Architecture](./adr/ADR-001-hub-spoke-network.md)
- [ADR-002: GitHub Enterprise Cloud Standardization](./adr/ADR-002-github-enterprise-cloud.md)
- [ADR-003: Entra ID Federation](./adr/ADR-003-entra-id-federation.md)

---

## Design Principles

The following principles govern all architectural decisions within the Acme Tech platform. Each principle is non-negotiable unless an ADR explicitly documents an exception.

### API-First

All inter-service and cross-subsidiary communication must occur through well-defined APIs. Direct database access across service boundaries is prohibited. APIs are published through Azure API Management (APIM) with OpenAPI 3.1 specifications. Every API must have a registered product in APIM, an assigned subscription key scope, and published documentation in the APIM developer portal.

Rationale: API-first ensures loose coupling between services, enables independent deployment, and provides a natural enforcement point for authentication, rate limiting, and analytics.

### Zero Trust

No network location, device, or user identity is implicitly trusted. Every request must be authenticated and authorized at the application layer, regardless of network origin. Conditional Access policies in Entra ID enforce multi-factor authentication, device compliance, and risk-based step-up authentication. All PaaS services are accessed through Private Endpoints — no public endpoints are exposed for any production workload.

Rationale: The traditional perimeter-based security model is insufficient for a multi-subsidiary enterprise operating across Azure regions. Zero trust shifts the trust boundary to the identity and application layer, where it can be enforced consistently.

### Infrastructure as Code

All infrastructure is defined in Terraform, stored in Git repositories, and deployed through GitHub Actions pipelines. Manual provisioning through the Azure portal is prohibited for any environment above development sandboxes. Drift detection runs daily via scheduled GitHub Actions workflows, and any configuration drift triggers an alert in PagerDuty and an automatic remediation pull request.

Rationale: Infrastructure as code ensures that every environment is reproducible, auditable, and version-controlled. It eliminates configuration drift, enables peer review of infrastructure changes, and provides a complete audit trail for compliance.

### Everything as Code

The "as code" principle extends beyond infrastructure to encompass policies, security rules, Conditional Access configurations, alerting rules, documentation, and operational runbooks. Every operational artifact lives in a Git repository, is reviewed through a pull request, and is deployed through a CI/CD pipeline.

Rationale: When everything is code, everything benefits from version control, peer review, automated testing, and audit trails. This is foundational to achieving SOC 2 and PCI DSS compliance requirements around change management.

### Cattle Not Pets

Infrastructure components are treated as disposable and replaceable. AKS nodes are ephemeral and auto-scaled. No configuration is applied manually to running instances. Containers are immutable — built once, promoted through environments. Stateless application design is the default; state is externalized to managed services (Cosmos DB, Azure SQL, Snowflake).

Rationale: Treating infrastructure as cattle eliminates single points of failure, enables horizontal scaling, and simplifies disaster recovery. When any component can be destroyed and recreated automatically, the blast radius of failures is dramatically reduced.

### Observe Everything

Every application, service, and infrastructure component must emit structured logs (JSON format), distributed traces (OpenTelemetry-compatible), and application metrics. Datadog is the single pane of glass for observability across the entire enterprise. Dashboards, alerts, and SLO monitors are defined as code and stored in the `acme-tech/observability-config` repository.

Rationale: You cannot operate what you cannot observe. Consistent observability practices across all subsidiaries enable rapid incident response, capacity planning, and performance optimization. A single observability platform eliminates the tool fragmentation that previously hindered cross-subsidiary incident investigation.

---

## Platform Architecture Overview

The platform architecture consists of five foundational layers: networking, compute, identity, data, and observability. Each layer is described below with references to the ADRs that formalized the architectural decisions.

### Hub-Spoke Network

The network architecture follows an Azure Landing Zones pattern with a hub-spoke Virtual Network (VNet) topology, as documented in [ADR-001](./adr/ADR-001-hub-spoke-network.md).

The **hub VNet** (10.0.0.0/16) resides in the central Acme Tech subscription and hosts shared network services:
- **Azure Firewall** — centralized egress filtering with threat intelligence and FQDN-based rules
- **Azure Bastion** — secure administrative access to VMs without public IP exposure
- **Azure Private DNS Zones** — centralized DNS resolution for all Private Endpoints
- **VPN/ExpressRoute Gateway** — connectivity to on-premises data centers (Acme Insurance, Acme Telco)

Each subsidiary operates in a dedicated **spoke VNet** peered to the hub:
- Acme Retail: 10.1.0.0/16
- Acme Financial Services: 10.2.0.0/16
- Acme Telco: 10.3.0.0/16
- Acme Insurance: 10.4.0.0/16
- Acme Distribution: 10.5.0.0/16
- Acme Media: 10.6.0.0/16

VNet peering is configured spoke-to-hub only. Spoke-to-spoke traffic routes through the hub Azure Firewall, enabling centralized traffic inspection and policy enforcement. Network Security Groups (NSGs) enforce microsegmentation within each spoke.

### Compute

Azure Kubernetes Service (AKS) is the primary compute platform, running Kubernetes v1.29+. The compute topology includes:

- **Shared platform cluster:** Hosts Acme Tech internal services (observability agents, platform APIs, MLflow, internal tooling). Runs in the hub VNet.
- **Dedicated subsidiary clusters:** Each subsidiary with containerized workloads receives a dedicated AKS cluster in their spoke VNet. This provides workload isolation, independent scaling, and subsidiary-specific RBAC.
- **CI/CD runner cluster:** A dedicated AKS cluster hosts self-hosted GitHub Actions runners, isolated from application workloads. Runners are ephemeral (scale-to-zero with KEDA) and re-created for each workflow run.

All clusters use Azure CNI for networking, Azure Disk/Files for persistent storage, and Azure Key Vault for secret injection via CSI driver.

### Identity

Microsoft Entra ID serves as the unified identity provider for the entire enterprise, as documented in [ADR-003](./adr/ADR-003-entra-id-federation.md).

The Entra ID tenant (`acmecorp.onmicrosoft.com`) federates identity to all platform services through SAML, OIDC, and SCIM protocols:
- **GitHub Enterprise Cloud (EMU):** SCIM provisioning creates and manages `_acme` suffixed accounts. Users authenticate via Entra ID SSO.
- **Datadog:** SAML SSO with SCIM group synchronization for role mapping.
- **Snowflake:** SAML SSO with Entra ID group-based role mapping.
- **Azure RBAC:** Native Entra ID integration for all Azure resource access.

Twelve Conditional Access policies enforce security baselines including mandatory MFA, device compliance for administrative access, legacy authentication blocking, location-based restrictions, and risk-based step-up authentication. Privileged Identity Management (PIM) provides just-in-time (JIT) activation for administrative roles with time-limited access windows.

### Data

The data architecture spans analytical, operational, and AI/ML workloads:

- **Snowflake (Enterprise tier):** Primary analytical data warehouse. Each subsidiary has a dedicated Snowflake database with row-level security. Cross-subsidiary data sharing is enabled through Snowflake Secure Data Shares for approved use cases.
- **Azure AI Search (Standard S2):** Vector and keyword search infrastructure powering the RAG platform. Indexes are partitioned per subsidiary with dedicated query quotas.
- **Azure OpenAI (GPT-4o, ada-002):** Inference and embedding services provisioned in Acme Tech's subscription with managed identity access from subsidiary applications.
- **Azure Cosmos DB (Serverless):** Platform metadata store for service catalogues, configuration data, and event sourcing.
- **MLflow (on AKS):** Centralized model registry where subsidiaries register, version, stage, and deploy machine learning models.

### Observability

Datadog Enterprise is the single observability platform for the entire Acme Corporation group:

- **APM:** Distributed tracing across all microservices with automatic service discovery and dependency mapping.
- **Logs:** Structured JSON log ingestion from all AKS clusters, Azure services, and GitHub Actions workflows. Log pipelines normalize formats and apply PII redaction.
- **Metrics:** Infrastructure and application metrics with 15-second granularity. Custom dashboards are defined as code in Terraform.
- **Synthetic monitoring:** Endpoint availability checks for all external-facing APIs and applications.
- **Alerting:** Multi-tier alerting with PagerDuty integration. Critical alerts page on-call engineers immediately; warning alerts create tickets in the subsidiary's issue tracker.

---

## Technology Stack

The following table provides the complete technology stack operated by Acme Tech:

| Layer | Technology | Version / Tier | Purpose |
|---|---|---|---|
| Source Control | GitHub Enterprise Cloud | EMU | Code hosting, governance, inner-source |
| CI/CD | GitHub Actions | Self-hosted on AKS | Build, test, deploy pipelines |
| Identity | Microsoft Entra ID | P2 | SSO, MFA, Conditional Access, SCIM |
| Networking | Azure Virtual Networks | Hub-spoke | Isolation, connectivity, microsegmentation |
| Compute | Azure Kubernetes Service | v1.29+ | Container orchestration, workload isolation |
| API Management | Azure API Management | Premium (internal VNet) | Gateway, rate limiting, developer portal |
| IaC | Terraform | v1.7+ | Infrastructure provisioning and drift detection |
| Observability | Datadog | Enterprise | APM, logs, metrics, RUM, synthetic monitoring |
| Data Warehouse | Snowflake | Enterprise | Analytical workloads, data sharing |
| Search | Azure AI Search | Standard S2 | Vector and keyword search for RAG |
| AI/ML Inference | Azure OpenAI | GPT-4o, ada-002 | Inference and embeddings |
| ML Ops | MLflow | OSS on AKS | Model registry, experiment tracking |
| Metadata | Azure Cosmos DB | Serverless | Platform metadata, configuration |
| Secrets | Azure Key Vault | Premium (HSM-backed) | Certificates, secrets, encryption keys |
| DNS | Azure Private DNS Zones | — | Internal name resolution for Private Endpoints |
| Alerting | PagerDuty | Business | Incident routing, on-call management |
| Firewall | Azure Firewall | Premium | Centralized egress filtering, threat intelligence |
| Container Registry | Azure Container Registry | Premium (geo-replicated) | Container image hosting |

---

## Integration Patterns

The platform supports five primary integration patterns for cross-service and cross-subsidiary communication.

### API Gateway Pattern

All synchronous cross-boundary communication routes through Azure API Management (APIM), deployed in the hub VNet with internal mode (no public endpoint). APIs are secured with OAuth 2.0 client credentials flow, with tokens issued by Entra ID. Each subsidiary registers as an APIM product, and access is controlled through subscription keys and RBAC.

API versioning follows the `v{major}` URI prefix convention (e.g., `/v2/orders`). Breaking changes require a new major version, and deprecated versions receive a 12-month sunset notice.

### Event-Driven Pattern

Asynchronous communication uses Apache Kafka through Azure Event Hubs (Kafka-compatible endpoint). Events follow the CloudEvents specification. Topic naming follows the convention: `{subsidiary}.{domain}.{event-type}.v{version}` — for instance, `retail.orders.order-placed.v2`.

Subsidiaries own their event schemas, published to a central schema registry. Consumer groups are namespaced per consuming subsidiary to enable independent offset management.

### Shared Data Pattern

Cross-subsidiary analytical data sharing uses Snowflake Secure Data Shares. Data producers publish curated datasets with documented schemas and SLAs. Row-level security policies ensure that consumers only access data they are authorized to view. All data shares require approval from both the producing and consuming subsidiary's data stewards.

### Platform API Pattern

Acme Tech exposes internal platform APIs for programmatic access to identity services (user provisioning, group management), observability (dashboard creation, alert configuration), and infrastructure (resource provisioning, cost reporting). These APIs are documented in the internal developer portal and secured with Entra ID managed identity authentication.

### GitOps Pattern

Infrastructure and application deployments follow a GitOps workflow. Changes are proposed as Git pull requests, reviewed by the appropriate team, and merged to trigger automated deployment. Terraform changes are applied through GitHub Actions with plan/apply stages and manual approval gates for production. Kubernetes application deployments use ArgoCD, which continuously reconciles the desired state in Git with the actual cluster state.

---

## Security Architecture

Security is layered across network, application, data, and identity domains.

### Network Security

- **Azure Firewall** in the hub VNet inspects and filters all egress traffic with FQDN-based rules and threat intelligence feeds.
- **Network Security Groups (NSGs)** enforce microsegmentation within each spoke VNet, restricting traffic to only the ports and protocols required by each workload.
- **Private Endpoints** ensure that all PaaS services (Key Vault, Storage, Cosmos DB, AI Search, SQL, Event Hubs) are accessed over the Microsoft backbone network, never over the public internet.
- **No public endpoints** are exposed for any production workload. External traffic enters through Azure Front Door or Application Gateway with WAF, which routes to internal services via Private Link.

### Application Security

- **GitHub Advanced Security (GHAS)** is enabled across all organizations with CodeQL code scanning, secret scanning with push protection, and Dependabot automated dependency updates.
- **Custom CodeQL rulesets** detect Acme-specific patterns including hardcoded configuration values, direct database access across service boundaries, and missing authentication middleware.
- **OWASP Top 10** vulnerabilities are addressed through CodeQL rules, container image scanning (Trivy), and runtime protection (Datadog Application Security Monitoring).

### Data Security

- **Encryption at rest:** AES-256 encryption for all data stores. Customer-managed keys (CMK) via Azure Key Vault are required for Acme Financial Services and Acme Insurance workloads that process regulated data.
- **Encryption in transit:** TLS 1.3 is required for all service-to-service communication. TLS 1.2 is the minimum; older protocols are blocked at the firewall.
- **Data classification:** All data is classified as Public, Internal, Confidential, or Restricted. Classification drives encryption, access control, retention, and audit requirements.

### Identity Security

- **Zero-trust Conditional Access:** All authentication requests are evaluated against 12 Conditional Access policies that enforce MFA, device compliance, location restrictions, and sign-in risk assessments.
- **Privileged Access Workstations (PAWs):** Administrative access to production environments requires a compliant PAW with hardware-bound credentials.
- **Just-In-Time (JIT) access:** Privileged Identity Management (PIM) requires administrators to activate roles for time-limited windows (maximum 8 hours) with approval workflows and audit logging.

---

## Scalability and Resilience

The platform is designed for enterprise-scale workloads with multi-region resilience for critical services.

### Multi-Region Strategy

- **Primary region:** East US 2 — all production workloads and platform services.
- **Secondary region:** West US 2 — active-passive failover for Tier 1 services (identity, API gateway, core databases).
- **Tier classification:** Tier 1 (business-critical, multi-region), Tier 2 (important, single-region with backup), Tier 3 (standard, single-region).

### Compute Scaling

- **AKS cluster autoscaler** adjusts node count based on pending pod resource requests, with minimum and maximum node bounds set per subsidiary cluster.
- **KEDA (Kubernetes Event-Driven Autoscaler)** scales workloads based on external metrics — Kafka consumer lag, Azure Queue depth, HTTP request rate, and custom Datadog metrics.
- **GitHub Actions runners** scale to zero during idle periods and burst to handle CI/CD demand spikes during peak development hours.

### Database Resilience

- **Snowflake** multi-cluster warehousing provides auto-scaling for concurrent analytical queries. Time Travel enables point-in-time recovery up to 90 days.
- **Cosmos DB** multi-region writes enable active-active database access across East US 2 and West US 2 for Tier 1 metadata stores.
- **Azure AI Search** geo-replication maintains synchronized indexes across regions for RAG workload continuity.

### BCDR Targets

| Tier | RPO | RTO | Backup Frequency | Failover |
|---|---|---|---|---|
| Tier 1 | < 1 hour | < 4 hours | Continuous replication | Automatic |
| Tier 2 | < 4 hours | < 8 hours | Hourly snapshots | Manual |
| Tier 3 | < 24 hours | < 24 hours | Daily backups | Manual |

Disaster recovery runbooks are maintained in the `acme-tech/dr-runbooks` repository and tested quarterly through tabletop exercises and annual full-failover drills.
