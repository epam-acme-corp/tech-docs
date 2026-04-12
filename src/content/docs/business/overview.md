---
title: "Acme Tech — Business Overview"
description: "Acme Tech is the shared technology services subsidiary of Acme Corporation, headquartered in Chicago, Illinois. With approximately 2,500 employees acr"
---

# Acme Tech — Business Overview

Acme Tech is the shared technology services subsidiary of Acme Corporation, headquartered in Chicago, Illinois. With approximately 2,500 employees across platform engineering, security, data, identity, and infrastructure disciplines, Acme Tech operates as the enterprise's central technology backbone — delivering standardized, secure, and scalable platform services that enable all six Acme Corporation subsidiaries to accelerate their digital transformation initiatives.

This document provides a comprehensive overview of Acme Tech's mission, organizational structure, service catalogue, operating model, and strategic direction.

---

## Mission and Purpose

Acme Tech exists to ensure that every subsidiary within Acme Corporation can innovate faster, ship with confidence, and operate at enterprise scale — without each team independently building and maintaining foundational technology capabilities. The subsidiary's mission statement is:

> *"To provide a secure, standardized, and scalable technology platform that empowers Acme Corporation's subsidiaries to focus on business differentiation while Acme Tech delivers the foundational technology they need."*

**Vision:** Acme Tech aspires to be the technology backbone that accelerates digital transformation across the entire Acme Corporation portfolio. By centralizing platform engineering, identity management, security operations, and data infrastructure, Acme Tech eliminates duplication, reduces risk, and enables subsidiaries to move from idea to production faster than they could independently.

**Core Value Proposition:** Subsidiaries retain full autonomy over their business logic, product decisions, and customer-facing innovation. Acme Tech handles everything beneath that layer — source control governance, CI/CD pipelines, identity federation, network isolation, observability, and AI/ML infrastructure. This separation of concerns means a product engineer at Acme Retail can deploy a new microservice without worrying about identity integration, network security, or compliance scanning — Acme Tech has already solved those problems at scale.

The shared services model generates measurable value: consolidated licensing reduces costs by an estimated 30–40% compared to each subsidiary procuring independently; centralized security operations provide a unified vulnerability management posture; and standardized tooling reduces onboarding time for engineers moving between subsidiaries from weeks to days.

---

## Organizational Structure

Acme Tech is led by Group CTO **Marcus Chen**, who reports directly to the Acme Corporation Board of Directors. Six functional teams report to Marcus, each responsible for a distinct domain of the technology platform.

The organizational hierarchy is structured as follows:

```
Group CTO — Marcus Chen
├── Platform Engineering — VP Sarah Okonkwo (~500 staff)
│   └── Developer Experience (~250 staff)
├── Identity & Access Management — Director Amara Osei (~200 staff)
├── Security & Compliance — VP & CISO David Reeves (~300 staff)
├── Data & AI Platform — Head of Data & AI Priya Sharma (~400 staff)
└── Infrastructure — Director James Kowalski (~350 staff)
```

### Platform Engineering

The Platform Engineering team, led by **VP Platform Engineering Sarah Okonkwo**, is the largest team at approximately 500 staff. This team owns the GitHub Enterprise Cloud governance layer, including enterprise and organization design, repository policies, branch protection rulesets, and the Actions runner infrastructure.

Key responsibilities include:
- **GitHub Enterprise governance:** Managing the `acme-corporation` enterprise account, provisioning subsidiary organizations, and enforcing enterprise-level policies (allowed actions lists, Copilot policies, IP allow lists).
- **Repository policies and rulesets:** Defining and maintaining branch protection rules, required status checks, CODEOWNERS enforcement, and merge queue configuration across all organizations.
- **Actions runners:** Operating self-hosted GitHub Actions runners on dedicated Azure Kubernetes Service (AKS) clusters, ensuring runners are patched, scaled, and isolated per subsidiary workload classification.
- **CI/CD pipeline templates:** Publishing and maintaining reusable workflow templates that subsidiaries consume for build, test, security scanning, and deployment pipelines.
- **Inner-source enablement:** Facilitating cross-subsidiary code sharing through internal repository visibility, contribution guidelines, and governance frameworks.

### Developer Experience

The Developer Experience team (~250 staff) reports to VP Platform Engineering Sarah Okonkwo and focuses on ensuring that every engineer across Acme Corporation has a productive, consistent, and secure development environment.

Key responsibilities include:
- **GitHub Copilot configuration:** Managing Copilot Business licensing, policy configuration (content exclusions, telemetry settings), and usage analytics across all subsidiary organizations.
- **IDE standards:** Publishing recommended IDE configurations, extensions, and settings profiles to ensure consistency across development teams.
- **Agent distribution:** Packaging, distributing, and maintaining Copilot agent configurations and custom instructions that encode Acme Corporation's coding standards and architectural patterns.
- **Developer onboarding:** Operating golden-path onboarding workflows that provision a new engineer's GitHub EMU account, IDE configuration, Copilot license, and repository access within hours of their Entra ID account activation.

### Identity & Access Management

The Identity & Access Management (IAM) team (~200 staff), led by **Director of Identity Amara Osei**, owns the enterprise identity layer that underpins access to every platform service.

Key responsibilities include:
- **Entra ID federation:** Managing the `acmecorp.onmicrosoft.com` tenant, including directory synchronization, guest access policies, and cross-tenant collaboration settings.
- **SSO and SCIM provisioning:** Operating SAML/OIDC SSO integrations and SCIM-based automatic user provisioning to GitHub Enterprise (EMU), Datadog, Snowflake, and other platform services.
- **Conditional Access policies:** Designing and maintaining the 12 Conditional Access policies that enforce MFA, device compliance, location restrictions, and risk-based authentication across the enterprise.
- **PAT governance:** Enforcing personal access token policies, including maximum 90-day expiration, repository-scoped permissions, and automated rotation reminders.

### Security & Compliance

The Security & Compliance team (~300 staff), led by **VP Security & CISO David Reeves**, ensures that the enterprise technology platform meets regulatory requirements and industry best practices.

Key responsibilities include:
- **GitHub Advanced Security (GHAS) policies:** Operating CodeQL analysis, secret scanning, and Dependabot across all subsidiary organizations with enterprise-level policy enforcement.
- **Custom CodeQL rulesets:** Developing and maintaining Acme-specific CodeQL queries that detect business-logic vulnerabilities, compliance violations, and architectural anti-patterns.
- **Compliance reporting:** Generating audit-ready compliance reports for SOC 2 Type II, PCI DSS (FSI and Retail), HIPAA (Insurance), and SOX controls.
- **Vulnerability management:** Operating the vulnerability lifecycle from detection through remediation, including SLA enforcement (Critical: 24 hours, High: 7 days, Medium: 30 days, Low: 90 days).

### Data & AI Platform

The Data & AI Platform team (~400 staff), led by **Head of Data & AI Priya Sharma**, operates the shared data infrastructure and AI/ML capabilities consumed by subsidiaries.

Key responsibilities include:
- **RAG infrastructure:** Operating the retrieval-augmented generation (RAG) platform built on Azure AI Search (Standard S2) and Azure OpenAI (GPT-4o, ada-002 embeddings), enabling subsidiaries to build knowledge-powered applications.
- **Vector stores:** Managing vector indexes in Azure AI Search and Cosmos DB for semantic search, recommendation engines, and content retrieval workloads.
- **ML model registry:** Operating MLflow on AKS as the centralized model registry where subsidiaries publish, version, and deploy machine learning models.
- **Data governance:** Enforcing data classification, access controls, lineage tracking, and retention policies through Snowflake data governance features and Azure Purview integration.

### Infrastructure

The Infrastructure team (~350 staff), led by **Director of Infrastructure James Kowalski**, operates the foundational cloud infrastructure that all platform services and subsidiary workloads run on.

Key responsibilities include:
- **Azure Landing Zones:** Maintaining the hub-spoke network architecture with centralized hub VNet (10.0.0.0/16) and peered spoke VNets per subsidiary, as defined in [ADR-001](../architecture/adr/ADR-001-hub-spoke-network.md).
- **Terraform module library:** Publishing and maintaining a curated library of Terraform modules that subsidiaries consume for provisioning Azure resources with pre-configured security, networking, and tagging policies.
- **Private networking:** Operating Azure Private Endpoints, Private DNS Zones, and Azure Firewall to ensure no PaaS service exposes a public endpoint.
- **Shared compute:** Managing AKS clusters for platform services and providing dedicated AKS clusters for subsidiaries that require isolated compute.
- **BCDR:** Operating business continuity and disaster recovery capabilities, including multi-region failover (Primary: East US 2, Secondary: West US 2) with RPO < 1 hour and RTO < 4 hours for Tier 1 services.

---

## Service Catalogue

Acme Tech provides the following platform services to Acme Corporation subsidiaries:

| Service Area | Capabilities Provided | Consuming Subsidiaries |
|---|---|---|
| GitHub Enterprise | Org provisioning, repo policies, branch protection, rulesets, Actions runners | All 6 subsidiaries |
| Identity & SSO | Entra ID federation, SCIM provisioning, Conditional Access, MFA | All 6 subsidiaries |
| CI/CD Platform | Self-hosted runners (AKS), reusable workflow templates, OIDC for Azure | All 6 subsidiaries |
| API Gateway | Azure API Management, rate limiting, API analytics, developer portal | Retail, FSI, Telco, Distribution |
| Data & AI | RAG infrastructure, vector stores, embedding services, model registry | Retail, FSI, Media |
| Observability | Datadog APM/logs/metrics, dashboards, alerting, PagerDuty integration | All 6 subsidiaries |
| Infrastructure | Terraform modules, Azure Landing Zones, private networking, AKS clusters | All 6 subsidiaries |
| Security Tools | GHAS, CodeQL, secret scanning, Dependabot, compliance dashboards | All 6 subsidiaries |

All services are delivered through self-service portals, automated provisioning workflows, and published golden-path documentation. Subsidiaries request new resources through GitHub Issues in the `acme-tech/platform-requests` repository, and provisioning is handled via Terraform automation triggered by approved pull requests.

---

## Key Stakeholders

| Role | Name | Responsibility |
|---|---|---|
| Group CTO | Marcus Chen | Overall technology strategy and subsidiary alignment |
| VP Platform Engineering | Sarah Okonkwo | GitHub Enterprise, CI/CD, developer experience |
| VP Security & CISO | David Reeves | Security operations, compliance, vulnerability management |
| Head of Data & AI | Priya Sharma | Data infrastructure, AI/ML platform, RAG services |
| Director of Infrastructure | James Kowalski | Azure infrastructure, networking, compute, BCDR |
| Director of Identity | Amara Osei | Entra ID, SSO, SCIM, Conditional Access |

---

## Operating Model

Acme Tech operates under a **centralized governance with subsidiary autonomy** model. The central principle is that subsidiaries retain full ownership of their business logic, product roadmaps, and engineering staffing — while Acme Tech provides the guardrails, platforms, and shared services that ensure consistency, security, and cost efficiency.

**Shared Services Model:** All foundational technology capabilities are delivered as shared services. Subsidiaries consume these services through well-defined APIs, self-service portals, and infrastructure-as-code modules rather than building their own.

**Enablement-First Approach:** Acme Tech prioritizes enablement over enforcement. Every mandatory policy is accompanied by an automated implementation — golden-path templates, pre-configured modules, and self-service provisioning workflows. Engineers should never need to read a 50-page policy document to do the right thing; the tooling encodes the policy.

**Governance Tiers:**
- **Mandatory:** Security policies, identity federation, network isolation, GHAS scanning. These are non-negotiable and enforced at the enterprise level.
- **Recommended:** CI/CD workflow templates, observability dashboards, Terraform modules, Copilot configurations. Subsidiaries are strongly encouraged to adopt these but may customize.
- **Optional:** Specific frameworks, languages, testing tools, and development practices. Subsidiaries choose what works best for their teams.

---

## Technology Strategy

Acme Tech's technology strategy is built on four pillars:

**1. Standardization onto Common Platforms:** The enterprise has standardized on GitHub Enterprise Cloud (EMU) for source control and CI/CD, Microsoft Azure for cloud infrastructure, Entra ID for identity, and Datadog for observability. This reduces vendor sprawl, simplifies procurement, and enables engineers to move between subsidiaries without retraining.

**2. Modernization Enablement:** Subsidiaries at lower maturity levels (Insurance at Level 0, Distribution at Level 1) receive dedicated modernization support, including migration tooling, training programs, and phased adoption roadmaps. The goal is to bring every subsidiary to at least Level 2 within 18 months.

**3. AI-Native Development:** Copilot is deployed as the default coding assistant across all subsidiary organizations. Agent-based workflows automate routine tasks like PR review, documentation generation, and dependency updates. RAG-powered knowledge retrieval connects engineers to institutional knowledge through natural language queries.

**4. Everything-as-Code:** Infrastructure, policies, security rules, and documentation are all managed as code in Git repositories, reviewed through pull requests, and deployed through CI/CD pipelines. This ensures auditability, reproducibility, and version control for every operational change.

---

## Subsidiary Relationships

Each Acme Corporation subsidiary has a distinct relationship with Acme Tech based on their current technology maturity level and service consumption patterns:

- **Acme Retail (Level 3 — Integrated):** The most mature consumer of Acme Tech services. Heavy adoption of API Gateway for e-commerce APIs, Data & AI for personalization and demand forecasting, and full CI/CD pipeline integration with automated deployments to production.
- **Acme Financial Services (Level 3 — Integrated):** Highest security and compliance requirements across the enterprise (PCI DSS, SOX, FCA regulations). Consumes all security and compliance services, with additional controls including customer-managed encryption keys and dedicated AKS clusters.
- **Acme Telco (Level 2 — Standardized):** Primary consumer of infrastructure services due to large-scale network operations. Currently migrating from self-hosted GitLab to GitHub Enterprise Cloud and adopting standardized CI/CD pipelines.
- **Acme Insurance (Level 0 — Initial):** Largest modernization challenge. Legacy on-premises systems with SVN-based version control and Jenkins CI. Heaviest reliance on Acme Tech for migration guidance, tooling, and training as they transition to modern platforms.
- **Acme Distribution (Level 1 — Managed):** Recently completed Azure migration and is in active growth phase for platform service adoption. Transitioning from Bitbucket to GitHub Enterprise and adopting Terraform modules for infrastructure provisioning.
- **Acme Media (Level 2 — Standardized):** Heavy consumer of Data & AI platform services for content operations including content recommendation, search, and metadata enrichment. Strong adoption of RAG infrastructure for internal knowledge management.

For a complete view of the Acme Corporation group structure, see the [Corporate Overview](../corporate/overview.md).

---

## Budget and Cost Allocation

Acme Tech operates under a **consumption-based chargeback model** where subsidiaries pay for the platform services they consume. Costs are allocated based on measurable consumption metrics — GitHub Actions runner minutes, AKS compute hours, Datadog host counts, Snowflake credits, and API Management call volumes.

**Quarterly Reviews:** Finance and technology leadership from each subsidiary meet quarterly with Acme Tech to review consumption trends, forecast upcoming demand, and adjust allocations. These reviews ensure transparency and prevent unexpected cost surprises.

**Investment Priorities (FY2025):**
- **Platform modernization (40%):** Continued migration support for lower-maturity subsidiaries, AKS version upgrades, Terraform module expansion, and self-service portal enhancements.
- **Security & compliance (25%):** GHAS rollout completion, custom CodeQL ruleset development, compliance automation for SOC 2 / PCI DSS / HIPAA, and zero-trust network enhancements.
- **AI/ML capabilities (20%):** RAG infrastructure scaling, Azure OpenAI capacity expansion, MLflow platform hardening, and Copilot adoption programs.
- **Operational excellence (15%):** Observability improvements, incident response automation, documentation quality, and developer satisfaction initiatives.

Total Acme Tech operating budget is reviewed annually by the Acme Corporation Board and allocated proportionally based on the investment priorities above. Subsidiary-specific project costs (e.g., Acme Insurance legacy migration) are funded separately through dedicated transformation budgets.
