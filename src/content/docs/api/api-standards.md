---
title: "REST API Design Standards"
description: "This document defines the mandatory REST API design standards for all services published through the Acme Corporation API Gateway. These standards app"
---

# REST API Design Standards

This document defines the mandatory REST API design standards for all services published through the Acme Corporation API Gateway. These standards apply to every subsidiary and shared platform API. Adherence is enforced through automated Spectral linting in CI pipelines and manual review during the API onboarding process.

For the gateway architecture and product structure, see [API Gateway Architecture](./gateway-overview.md). For the broader platform context, see [Architecture Overview](../architecture/overview.md).

---

## Resource Naming Conventions

APIs must follow consistent resource naming to ensure discoverability and predictability across the Acme Corporation API estate.

### Rules

- **Plural nouns**: Collection endpoints use plural nouns (`/customers`, `/orders`, `/policies`).
- **Kebab-case**: Multi-word resource names use kebab-case (`/order-items`, `/payment-methods`).
- **No verbs**: Resource paths must not contain verbs. Use HTTP methods to express actions. Incorrect: `/getCustomers`. Correct: `GET /customers`.
- **Nested resources**: Parent-child relationships are expressed through nesting. A customer's orders: `GET /customers/{customerId}/orders`. Nesting must not exceed three levels; deeper relationships should be modeled as top-level resources with query filters.
- **Identifiers**: Path parameters use camelCase (`{customerId}`, `{orderId}`).

### URI Structure

```
https://api.acmecorp.internal/{subsidiary}/{service}/v{major}/{resource}
```

For instance:
```
https://api.acmecorp.internal/retail/bookstore/v1/products
https://api.acmecorp.internal/fsi/accounts/v2/transactions
https://api.acmecorp.internal/distribution/logistics/v1/shipments/{shipmentId}/tracking-events
```

---

## HTTP Methods

All APIs must use standard HTTP methods with their defined semantics.

| Method | Semantics | Idempotent | Safe | Request Body |
|---|---|---|---|---|
| `GET` | Retrieve resource(s) | Yes | Yes | No |
| `POST` | Create resource or trigger action | No | No | Yes |
| `PUT` | Full replacement of resource | Yes | No | Yes |
| `PATCH` | Partial update of resource | No | No | Yes |
| `DELETE` | Remove resource | Yes | No | No |
| `HEAD` | Same as GET without response body | Yes | Yes | No |
| `OPTIONS` | Describe communication options | Yes | Yes | No |

`PUT` requests must include the complete resource representation. Partial updates must use `PATCH` with [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7386) (`application/merge-patch+json`) or [JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) (`application/json-patch+json`).

---

## Status Codes

APIs must return appropriate HTTP status codes. The following codes are approved for use across the platform.

| Code | Meaning | When to Use |
|---|---|---|
| `200 OK` | Success | Successful GET, PUT, PATCH |
| `201 Created` | Resource created | Successful POST that creates a resource. Must include `Location` header. |
| `204 No Content` | Success, no body | Successful DELETE or PUT/PATCH with no response body |
| `400 Bad Request` | Malformed request | Unparseable JSON, missing required headers |
| `401 Unauthorized` | Authentication failure | Missing, expired, or invalid token |
| `403 Forbidden` | Authorization failure | Valid token but insufficient scopes or roles |
| `404 Not Found` | Resource not found | Requested resource does not exist |
| `409 Conflict` | State conflict | Duplicate creation, concurrent modification (optimistic locking) |
| `422 Unprocessable Entity` | Validation failure | Well-formed request but business rule violations |
| `429 Too Many Requests` | Rate limit exceeded | Must include `Retry-After` header |
| `500 Internal Server Error` | Server error | Unhandled exception. Must not expose internal details. |
| `503 Service Unavailable` | Temporarily unavailable | Backend unhealthy, circuit breaker open. Include `Retry-After`. |

Services must not return status codes outside this list without prior approval from the API governance team.

---

## Pagination

All collection endpoints returning potentially unbounded result sets must implement **cursor-based pagination**.

### Query Parameters

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `cursor` | string | — | — | Opaque cursor from a previous response |
| `limit` | integer | 20 | 100 | Number of items per page |

### Response Headers

| Header | Description |
|---|---|
| `X-Total-Count` | Total number of matching resources (if calculable without performance impact) |
| `Link` | RFC 8288 links with `rel="next"` and `rel="prev"` |

### Response Body

Paginated responses return an array of resources at the top level. Pagination metadata is conveyed exclusively through headers, not through a wrapping envelope. The `nextCursor` and `previousCursor` values are included as query parameters in the `Link` header URLs.

Services must return results in a stable, deterministic order when paginating. Default sort order must be documented in the OpenAPI specification.

---

## Filtering and Sorting

### Filtering

Collection endpoints support filtering via query parameters using the bracket notation:

```
GET /v1/orders?filter[status]=shipped&filter[created_at][gte]=2024-01-01T00:00:00Z
```

| Operator | Syntax | Description |
|---|---|---|
| `eq` | `?filter[field]=value` | Equal (default when no operator specified) |
| `ne` | `?filter[field][ne]=value` | Not equal |
| `gt` | `?filter[field][gt]=value` | Greater than |
| `lt` | `?filter[field][lt]=value` | Less than |
| `gte` | `?filter[field][gte]=value` | Greater than or equal |
| `lte` | `?filter[field][lte]=value` | Less than or equal |
| `in` | `?filter[field][in]=a,b,c` | Value in set |
| `contains` | `?filter[field][contains]=value` | Substring match (case-insensitive) |

Multiple filters are combined with AND logic. If OR logic is needed, it must be implemented as a dedicated search endpoint (`POST /v1/orders/search`) with a request body.

### Sorting

Sorting is controlled via the `sort` query parameter:

```
GET /v1/products?sort=-created_at,name
```

- Ascending: `?sort=field`
- Descending: `?sort=-field` (prefix with hyphen)
- Multiple fields: comma-separated, applied in order

---

## Error Response Format

All error responses must conform to [RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807).

### Structure

```json
{
  "type": "https://api.acmecorp.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/v1/customers/registration",
  "traceId": "abc123-def456-ghi789",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "code": "INVALID_FORMAT"
    }
  ]
}
```

### Field Definitions

| Field | Required | Description |
|---|---|---|
| `type` | Yes | Resolvable URI identifying the error type. Must return a human-readable description when dereferenced. |
| `title` | Yes | Short, human-readable summary |
| `status` | Yes | HTTP status code |
| `detail` | Yes | Human-readable explanation specific to this occurrence |
| `instance` | Yes | URI reference identifying the specific occurrence |
| `traceId` | Yes | Distributed trace identifier. Must correlate with Datadog APM traces. |
| `errors` | Conditional | Array of field-level errors. Required for 400 and 422 responses. |

The `traceId` field is mandatory for all error responses. It must match the trace ID propagated through the `x-datadog-trace-id` header or the W3C `traceparent` header. This enables operations teams to correlate error responses with distributed traces in [Datadog](../operations/observability.md).

---

## OpenAPI Specification Requirements

All APIs must be documented with an **OpenAPI 3.1** specification.

### Storage and Governance

- Specifications are stored in the service repository under `docs/openapi.yaml`.
- Every pull request that modifies the specification triggers the **Spectral linter** with the Acme Corporation custom ruleset (`@acmecorp/spectral-ruleset`). The linter validates naming conventions, required fields, error response schemas, pagination patterns, and security definitions.
- On merge to the `main` branch, a CI pipeline automatically publishes the updated specification to the APIM developer portal.

### Required Sections

Every OpenAPI specification must include:

| Section | Purpose |
|---|---|
| `info` | Title, version, description, contact, license |
| `servers` | Production, staging, development URLs |
| `paths` | All operations with request/response schemas, descriptions, and status codes |
| `components/schemas` | Reusable data models with field descriptions and validation constraints |
| `components/securitySchemes` | OAuth 2.0 and API key definitions |
| `components/parameters` | Shared query parameters (pagination, filtering, sorting) |

All schemas must include `description` fields for every property. Enum values must be documented. Nullable fields must be explicitly marked.

---

## Request and Response Conventions

### Content Type

All APIs accept and return **JSON** (`application/json`) exclusively. XML is not supported. Services that need to handle binary content (file uploads, image retrieval) must use `multipart/form-data` for uploads and return the binary content with the appropriate MIME type.

### Timestamps and Dates

- **Timestamps**: UTC, ISO 8601 format with timezone designator: `2024-01-15T14:30:00Z`. Unix epoch timestamps are not permitted.
- **Dates**: ISO 8601 date format: `2024-01-15`.

### Identifiers

All resource identifiers exposed in API responses must be **UUID v4**. Sequential database identifiers (auto-increment integers) must never be exposed to API consumers. Internal database IDs can be used for backend processing but must be mapped to UUIDs at the API boundary.

### Null Handling

Fields with null values must be **omitted** from response payloads rather than included with a null value. The exception is `PATCH` operations, where explicitly sending `null` for a field indicates that the field should be cleared.

### Response Structure

Responses must return the resource directly without an envelope wrapper. Correct:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Acme Widget",
  "status": "active"
}
```

Collection responses return a JSON array. Pagination metadata is conveyed through the `X-Total-Count` and `Link` headers, not through a response body wrapper.

---

## API Security Standards

### Transport Security

- **TLS 1.3** is required for all API communication. TLS 1.2 is accepted only with a documented exception approved by the Acme Tech security team. TLS 1.0 and 1.1 are blocked at the gateway.
- **Mutual TLS (mTLS)** is required for all service-to-service communication involving Acme Financial Services and Acme Insurance APIs. mTLS is optional but recommended for other subsidiaries.

### JWT Validation

The gateway validates every JWT for the following required claims:

| Claim | Validation |
|---|---|
| `iss` | Must match the Acme Corporation Entra ID tenant issuer URL |
| `aud` | Must equal `api://acmecorp-apim` |
| `exp` | Must not be expired (clock skew tolerance: 60 seconds) |
| `sub` | Must be present |
| `subsidiary` | Must match a registered subsidiary |
| `roles` | Must include at least one role authorized for the target API |

### CORS Policy

Cross-Origin Resource Sharing is denied by default. Allowed origins are configured per API product and restricted to registered application domains. Credentials (`Access-Control-Allow-Credentials: true`) are permitted only for first-party frontends hosted on `*.acmecorp.com` domains.

### Input Validation

All inbound requests are validated against the published OpenAPI schema at the gateway level. Unexpected fields not defined in the schema are rejected with a 400 Bad Request response. Additionally, APIM policies apply SQL injection and cross-site scripting (XSS) pattern detection on all string inputs.

---

## Async API Patterns

For event-driven communication, Acme Corporation uses **Azure Event Hubs** with the Kafka protocol as the enterprise event backbone.

### Topic Naming

Event topics follow a hierarchical naming convention:

```
{subsidiary}.{domain}.{event-type}.v{version}
```

For instance:
- `retail.orders.order-placed.v1`
- `fsi.accounts.balance-updated.v2`
- `distribution.logistics.shipment-dispatched.v1`

### Event Envelope

All events must conform to the [CloudEvents 1.0](https://cloudevents.io/) specification:

```json
{
  "specversion": "1.0",
  "type": "com.acmecorp.retail.orders.order-placed",
  "source": "/retail/orders-service",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "time": "2024-01-15T14:30:00Z",
  "datacontenttype": "application/json",
  "subsidiary": "retail",
  "data": { }
}
```

The `id` field must be globally unique (UUID v4). The `time` field must be UTC ISO 8601. The `subsidiary` extension attribute identifies the originating business unit.

### Schema Registry

**Azure Schema Registry** with Avro serialization is mandatory for all event payloads. Schemas are validated on publish; any event that does not conform to the registered schema is rejected by the Event Hub producer. All schema evolution must maintain **backward compatibility** — consumers built against an older schema version must be able to deserialize events produced with a newer version.

### Ordering Guarantees

Events are partitioned by **entity ID** (e.g., `customerId`, `orderId`). This guarantees that all events for a given entity are delivered in order within a partition. Cross-entity ordering is not guaranteed and must not be relied upon.

---

## API Lifecycle Management

Every API progresses through a defined lifecycle.

| Stage | Visibility | Behavior |
|---|---|---|
| **Draft** | Staging only | Under development, not available for production consumption |
| **Published** | Production | Actively supported, accepting subscriptions |
| **Deprecated** | Production | Functional but marked for retirement. `Sunset` HTTP header included in responses. New subscriptions blocked. |
| **Retired** | Removed | Returns `410 Gone` for all requests. |

### Deprecation Rules

- **Non-breaking changes** (additive fields, new optional parameters, additional endpoints) do not require a new version. They are released as APIM revisions.
- **Breaking changes** (field removal, type changes, semantic alterations, required field additions) require a **new major version** (e.g., `/v1/` to `/v2/`). The previous version must remain operational for a minimum of **six months** after the deprecation date.
- Consumers are notified of deprecation through the developer portal, the `Sunset` response header (RFC 8594), direct email to subscription owners, and announcements in the `#api-changes` Slack channel.
- A retired API endpoint returns `410 Gone` with a response body directing consumers to the replacement version. A minimum **30-day notice** is provided before retirement.

---

## Related Documentation

- [API Gateway Architecture](./gateway-overview.md) — Deployment topology, products, and rate limiting
- [Architecture Overview](../architecture/overview.md) — Platform architecture context
- [Observability](../operations/observability.md) — Datadog APM and trace correlation
- [Identity and Access Management](../security/identity-access-management.md) — OAuth and Entra ID configuration
