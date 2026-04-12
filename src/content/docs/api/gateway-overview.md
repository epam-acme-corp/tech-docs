---
title: "API Gateway Architecture"
description: "Acme Tech operates the enterprise API Gateway as the single entry point for all cross-subsidiary and external API communication across Acme Corporatio"
---

# API Gateway Architecture

Acme Tech operates the enterprise API Gateway as the single entry point for all cross-subsidiary and external API communication across Acme Corporation. The gateway is built on Azure API Management (APIM) Premium tier and serves as the backbone for centralized authentication, rate limiting, analytics, self-service onboarding, and full API lifecycle management.

This document describes the gateway deployment topology, product structure, authentication flows, rate limiting tiers, versioning strategy, monitoring integration, and the developer portal. For the broader platform architecture, see [Architecture Overview](../architecture/overview.md). For identity and token policies, see [Identity and Access Management](../security/identity-access-management.md).

---

## Azure API Management Deployment

The API Gateway runs on Azure API Management Premium tier, deployed in internal Virtual Network mode within a dedicated subnet of the hub VNet. Internal VNet mode ensures that the management plane and gateway endpoints are reachable only from within the corporate network by default, while public-facing APIs are exposed through Azure Application Gateway with Web Application Firewall (WAF) v2 in front.

### Regional Topology

| Region | Role | Scale Units | Approx. Capacity |
|---|---|---|---|
| East US 2 | Primary | 3 | ~15,000 req/sec |
| West US 2 | Secondary | 3 | ~15,000 req/sec |

Azure Traffic Manager provides DNS-based failover between regions. Under normal operation, all traffic routes to East US 2. If health probes detect degradation in the primary region (three consecutive failures at 30-second intervals), Traffic Manager redirects traffic to West US 2 within approximately 60 seconds. The combined deployment supports approximately 30,000 requests per second in aggregate under normal load.

### Custom Domains and TLS

| Domain | Audience | Exposure |
|---|---|---|
| `api.acmecorp.internal` | Internal subsidiary consumers | Hub VNet only |
| `api.acmecorp.com` | External partners and public consumers | Application Gateway + WAF |

TLS certificates for both domains are stored in Azure Key Vault and automatically rotated 30 days before expiration. APIM references the Key Vault certificate via managed identity. All traffic requires TLS 1.2 or higher; TLS 1.0 and 1.1 are blocked at the Application Gateway level.

### Backend Configuration

Backend services are registered per subsidiary. Each backend entry includes:

- **Base URL**: The internal Kubernetes Ingress or Azure service endpoint.
- **Health Probes**: APIM sends HTTP GET requests to each backend's `/healthz` endpoint every 30 seconds. Backends failing three consecutive probes are marked unhealthy and removed from the active pool.
- **Circuit Breaker**: Implemented via APIM policy expressions. When a backend returns five consecutive 5xx responses within a 60-second window, the circuit opens for 30 seconds, returning 503 Service Unavailable to callers. After the cooldown period, the circuit transitions to half-open, allowing a single probe request through before fully closing.

---

## API Product Structure

APIM organizes APIs into **products**, which map directly to subsidiary domains. Each product groups logically related APIs and enforces product-level policies (rate limits, authentication scopes, and subscription requirements).

### Subsidiary Products

| Product | APIs Included | Primary Consumers |
|---|---|---|
| **retail-apis** | BookStore API, Inventory API, Customer API, Order API | Acme Retail frontends, partner integrations |
| **fsi-apis** | Account API, Transaction API, Compliance Reporting API | Acme Financial Services, regulators |
| **telco-apis** | Network Management API, Billing API, Customer Portal API | Acme Telco operations, self-service portals |
| **insurance-apis** | Policy API, Claims API | Acme Insurance portals (limited scope — Claims API is under active legacy modernization) |
| **distribution-apis** | Logistics API, Warehouse API, Tracking API | Acme Distribution WMS, carrier integrations |
| **media-apis** | Content API, Streaming API, Publishing API | Acme Media CMS, mobile apps, CDN orchestration |

### Shared Products

| Product | APIs Included | Purpose |
|---|---|---|
| **platform-apis** | Identity API, Observability API, Infrastructure Status API | Cross-cutting platform services consumed by all subsidiaries |
| **analytics-apis** | Snowflake Query API, Reporting API | Centralized analytics and business intelligence access |

### Subscription Model

A consuming subsidiary must subscribe to the relevant product before calling any API within it. Each subscription issues a **subscription key** that must be passed in the `Ocp-Apim-Subscription-Key` header. In addition, every request must include a valid **OAuth 2.0 bearer token** issued by Entra ID. The subscription key identifies the consuming application; the OAuth token authenticates and authorizes the caller. Subscriptions are managed through the developer portal or via Terraform for infrastructure-as-code workflows.

---

## Authentication Flow

All API traffic through the gateway is authenticated. The gateway supports three distinct authentication flows depending on the caller type.

### Service-to-Service (S2S)

Internal services communicating across subsidiaries use the **OAuth 2.0 Client Credentials** grant. The calling service obtains a token from Microsoft Entra ID using its managed identity or registered application credentials. The APIM `validate-jwt` inbound policy verifies:

- **Issuer** (`iss`): Must match the Acme Corporation Entra ID tenant.
- **Audience** (`aud`): Must equal `api://acmecorp-apim`.
- **Expiration** (`exp`): Token must not be expired.
- **Scopes**: The token's `scp` or `roles` claim must include the scope mapped to the target product (e.g., `retail-apis.read`, `fsi-apis.write`).

### User-Facing Applications

Web and mobile applications serving end users authenticate via **OAuth 2.0 Authorization Code with PKCE**. The frontend redirects the user to the Entra ID authorization endpoint; upon successful authentication, the application exchanges the authorization code for an access token. The APIM `validate-jwt` policy extracts the `subsidiary` and `roles` claims from the token to enforce fine-grained authorization.

### External Partner Access

External partners authenticate using a combination of **API key** and **OAuth 2.0 Client Credentials**. The API key is issued during partner onboarding and is tied to a specific product subscription. The OAuth token provides identity and scope. Rate limiting policies are applied per API key to prevent abuse. Partners are provisioned in a dedicated Entra ID application registration with restricted scopes.

### Token Validation Failures

Any request with an invalid, expired, or missing token receives an **HTTP 401 Unauthorized** response formatted according to [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807). The response includes the `type`, `title`, `status`, `detail`, and `traceId` fields to assist with debugging. See [API Standards](./api-standards.md) for the full error response format.

---

## Rate Limiting Tiers

The gateway enforces rate limiting at the subscription level to protect backend services and ensure fair usage across consumers.

| Tier | Rate Limit | Daily Quota | Use Case |
|---|---|---|---|
| **Bronze** | 100 req/min | 10,000/day | External partners, sandbox environments |
| **Silver** | 1,000 req/min | 500,000/day | Standard subsidiary-to-subsidiary communication |
| **Gold** | 10,000 req/min | 5,000,000/day | High-throughput workloads (Retail checkout, FSI order execution) |
| **Platinum** | Custom | Custom | Critical infrastructure (Identity API, Observability API) |

**Defaults**: External partner subscriptions are assigned Bronze. Internal subsidiary subscriptions default to Silver. Gold requires written approval from the consuming subsidiary's engineering lead and the Acme Tech platform team. Platinum is reserved for platform-critical services and is not available for general subscription.

When a consumer exceeds their rate limit, the gateway returns **HTTP 429 Too Many Requests** with a `Retry-After` header indicating the number of seconds until the limit resets. A **burst allowance** of 2x the per-minute rate is permitted for windows of up to 10 seconds to accommodate legitimate traffic spikes.

---

## API Versioning Strategy

All APIs published through the gateway follow URL path versioning:

```
https://api.acmecorp.internal/retail/bookstore/v1/products
https://api.acmecorp.internal/retail/bookstore/v2/products
```

### Lifecycle Stages

| Stage | Description |
|---|---|
| **Draft** | API under development, accessible in staging only |
| **Published** | API available in production, actively supported |
| **Deprecated** | API still functional, `Sunset` header included, no new subscriptions |
| **Retired** | API removed, returns 410 Gone |

APIM **revisions** are used for non-breaking changes (adding optional fields, new endpoints). Revisions do not change the version number and are transparent to consumers.

**Breaking changes** — such as removing a field, changing a data type, or altering response structure — require a new major version (e.g., `/v1/` to `/v2/`). The previous version must remain available for a minimum of **six months** after the deprecation announcement. Consumers are notified via the developer portal, email, and Slack `#api-changes`.

---

## Analytics and Monitoring

The API Gateway is instrumented for comprehensive observability.

### APIM Built-In Analytics

Azure APIM provides built-in analytics covering request volume, response latency, error rates, and cache hit ratios per API and per product. These metrics are accessible in the Azure portal and via the APIM analytics API.

### Datadog Integration

APIM diagnostic logs and metrics are streamed to **Datadog** via Azure Event Hub. The Acme Tech observability team maintains custom Datadog dashboards for each subsidiary, providing real-time visibility into:

- **Request rate** (req/sec) per API and product
- **Latency** at p50, p95, and p99 percentiles
- **Error rate** (4xx and 5xx) per API
- **Rate limit violations** (429 responses)

### Alerting

| Priority | Condition | Action |
|---|---|---|
| **P1** | Gateway unreachable from any region | PagerDuty page, Slack `#incident-active` |
| **P2** | Error rate >5% for any product sustained 5 minutes | PagerDuty page, Slack `#incident-active` |
| **P3** | Rate limit violations >10% of traffic for any subscription | Slack `#{subsidiary}-alerts`, subscription owner notified |

For the full alerting framework and escalation procedures, see [Observability](../operations/observability.md) and [Incident Management](../operations/incident-management.md).

---

## Developer Portal

The API Gateway includes a self-service developer portal for API discovery, testing, and subscription management.

### Portal URLs

| Portal | URL | Audience |
|---|---|---|
| Internal | `portal.api.acmecorp.internal` | Acme Corporation subsidiary developers |
| External | `portal.api.acmecorp.com` | External partners and third-party integrators |

### Features

- **Auto-Generated Documentation**: OpenAPI specifications published to APIM are automatically rendered as interactive API reference pages, complete with request/response structures, authentication requirements, and status codes.
- **Interactive Testing**: Developers can execute API calls directly from the portal using their subscription key and OAuth token.
- **Subscription Management**: Create applications, subscribe to products, rotate subscription keys, and view usage quotas.
- **Usage Analytics**: Per-subscription dashboards showing request volume, error rates, and quota consumption.

### Onboarding Workflow

1. **Register**: Developer signs in with Entra ID (internal) or completes the partner registration form (external).
2. **Create Application**: Define the application name, description, and target environment.
3. **Subscribe to Products**: Select the required API products. Internal subscriptions are auto-approved. External subscriptions require manual review by the Acme Tech API governance team (SLA: 2 business days).
4. **Receive Credentials**: Subscription keys are generated immediately upon approval. OAuth client credentials are provisioned via the Identity API.

### API Catalog

The portal provides a searchable API catalog with filtering by subsidiary, domain, version, and lifecycle stage. Each catalog entry links to the full OpenAPI specification, authentication guide, rate limit tier, and changelog.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — Platform architecture and network topology
- [Identity and Access Management](../security/identity-access-management.md) — Entra ID configuration and token policies
- [API Standards](./api-standards.md) — REST design standards and error response format
- [Observability](../operations/observability.md) — Datadog integration and monitoring
- [Incident Management](../operations/incident-management.md) — Escalation procedures for gateway incidents
