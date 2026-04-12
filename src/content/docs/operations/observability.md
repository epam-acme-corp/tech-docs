---
title: "Observability Platform"
description: "Acme Tech operates a unified observability platform built on **Datadog Enterprise** that serves all six subsidiaries and the shared technology platfor"
---

# Observability Platform

Acme Tech operates a unified observability platform built on **Datadog Enterprise** that serves all six subsidiaries and the shared technology platform. The platform provides application performance monitoring (APM), centralized log management, infrastructure metrics, Real User Monitoring (RUM), synthetic monitoring, and security monitoring in a single pane of glass.

This document describes the agent deployment model, logging standards, metric naming conventions, dashboard hierarchy, alerting framework, and cost optimization strategy. For platform architecture context, see [Architecture Overview](../architecture/overview.md). For incident response procedures, see [Incident Management](./incident-management.md). For SLA targets that drive alerting thresholds, see [SLA Framework](./sla-framework.md).

---

## Platform Capabilities

The Datadog Enterprise tier provides the following capabilities across the Acme Corporation technology estate:

| Capability | Description |
|---|---|
| **APM with Distributed Tracing** | End-to-end request tracing across microservices, API Gateway, databases, and external calls |
| **Log Management** | Centralized log ingestion, indexing, and search with 15-day hot retention |
| **Infrastructure Metrics** | Host, container, and Kubernetes metrics with unlimited custom metrics |
| **Real User Monitoring (RUM)** | Browser and mobile session replay, performance metrics, error tracking |
| **Synthetic Monitoring** | Proactive endpoint and workflow monitoring from global locations |
| **Security Monitoring** | Threat detection, SIEM integration, compliance signal generation |
| **Network Performance Monitoring (NPM)** | Cross-service and cross-VNet traffic analysis |

All subsidiaries share a single Datadog organization with role-based access control enforcing subsidiary-level data isolation. Teams see only the services and infrastructure they own unless granted cross-subsidiary visibility.

---

## Agent Deployment Model

Datadog agents are deployed using a layered model to capture metrics, traces, and logs from every tier of the platform.

### DaemonSet Agent

The **Datadog Agent** runs as a Kubernetes DaemonSet on every node in all AKS clusters. The DaemonSet agent collects:

- Host-level metrics (CPU, memory, disk, network)
- Container metrics (resource utilization, restarts, OOM kills)
- APM traces received from application sidecars
- Container logs from stdout/stderr

The agent is deployed via Helm chart (`datadog/datadog`) with a standardized `values.yaml` maintained in the `acme-tech/infrastructure` repository. Configuration overrides per subsidiary are applied through Helm value overlays.

### Application Tracing Sidecars

Each application service includes the appropriate Datadog tracing library for its runtime:

| Runtime | Library | Instrumentation |
|---|---|---|
| Java | `dd-java-agent` | JVM agent auto-instrumentation |
| Python | `ddtrace` | `ddtrace-run` wrapper or programmatic |
| Node.js | `dd-trace-js` | `require('dd-trace').init()` at entry point |
| .NET | `dd-trace-dotnet` | CLR profiler auto-instrumentation |
| Go | `dd-trace-go` | Manual instrumentation with `tracer.Start()` |

All tracing libraries are configured to propagate context using both **W3C Trace Context** (`traceparent` header) and **Datadog** (`x-datadog-trace-id`, `x-datadog-parent-id` headers) formats. Services must not strip or modify these headers.

### Cluster Agent

A **Datadog Cluster Agent** runs as a single-replica Deployment in each AKS cluster. It provides:

- Kubernetes state metrics (pod status, deployment health, node conditions)
- Horizontal Pod Autoscaler (HPA) integration for custom metric-based scaling
- External metrics for KEDA-based event-driven autoscaling
- Kubernetes event collection for audit and troubleshooting

### Network Performance Monitoring

**NPM** is enabled on the DaemonSet agents deployed in the hub VNet. It captures flow-level data for cross-subsidiary traffic, enabling the operations team to visualize service dependencies, detect network bottlenecks, and identify anomalous traffic patterns.

### PaaS Log Collection

Logs from Azure PaaS services that do not run the Datadog agent are ingested via **Azure Event Hub**:

| Source | Log Types |
|---|---|
| Azure API Management | Request logs, error logs, gateway diagnostics |
| Azure Cosmos DB | Query metrics, throttling events, diagnostic logs |
| Azure Key Vault | Access audit logs, certificate operations |
| Microsoft Entra ID | Sign-in logs, audit logs, risky sign-in detections |

An Azure Function processes Event Hub messages and forwards them to the Datadog Logs API with appropriate tags (`source`, `subsidiary`, `environment`).

---

## Logging Standards

All application services must emit structured JSON logs to stdout. The Datadog DaemonSet agent collects these logs and forwards them to the Datadog Log Management platform.

### Required Fields

| Field | Type | Description |
|---|---|---|
| `timestamp` | ISO 8601 | Event time in UTC (`2024-01-15T14:30:00.123Z`) |
| `service` | string | Service name matching the Datadog `service` tag |
| `level` | string | Log severity: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` |
| `message` | string | Human-readable event description |
| `traceId` | string | Datadog distributed trace ID for request correlation |
| `spanId` | string | Current span ID within the trace |
| `subsidiary` | string | Owning subsidiary (`retail`, `fsi`, `telco`, `insurance`, `distribution`, `media`) |
| `environment` | string | Deployment environment: `production`, `staging`, `development` |
| `correlationId` | string | Business transaction identifier for cross-service correlation |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `userId` | string | Hashed or tokenized user identifier (never raw PII) |
| `requestId` | string | Unique identifier for the inbound HTTP request |
| `errorCode` | string | Application-specific error code |
| `duration_ms` | number | Operation duration in milliseconds |

### Log Levels

| Level | Usage | Production Enabled |
|---|---|---|
| `DEBUG` | Detailed diagnostic information | No — disabled in production |
| `INFO` | Normal operational events (request handled, job completed) | Yes |
| `WARN` | Handled anomalies (retry succeeded, fallback activated, approaching threshold) | Yes |
| `ERROR` | Operation failure requiring investigation (unhandled exception, dependency timeout) | Yes |
| `FATAL` | Unrecoverable failure requiring immediate attention (data corruption, out-of-memory) | Yes |

### PII Protection

Raw personally identifiable information (PII) must never appear in log messages. Customer identifiers must be hashed or tokenized before logging. The Datadog **Sensitive Data Scanner** is configured with rules to detect and redact email addresses, phone numbers, Social Security numbers, and credit card numbers. Scanner matches trigger a `pii_detected` security signal for the owning subsidiary's security team.

---

## Metric Naming Conventions

Custom application metrics must follow a consistent naming convention to ensure discoverability and enable cross-subsidiary aggregation.

### Naming Pattern

```
{subsidiary}.{service}.{metric_name}
```

For instance: `retail.bookstore.request_total`, `fsi.accounts.request_duration_seconds`, `telco.billing.active_connections`.

### Metric Types

| Type | Use Case | Aggregation |
|---|---|---|
| Counter | Monotonically increasing values (requests, errors) | Rate, sum |
| Gauge | Point-in-time values (connections, queue depth) | Avg, min, max |
| Histogram | Distribution of values (latency, payload size) | p50, p75, p95, p99 |

### Required Standard Metrics

Every service must emit the following metrics:

| Metric | Type | Tags |
|---|---|---|
| `request_total` | Counter | `status`, `method`, `endpoint` |
| `request_duration_seconds` | Histogram | `method`, `endpoint` |
| `error_total` | Counter | `error_type`, `endpoint` |
| `active_connections` | Gauge | `connection_type` |

### Governance

Custom metrics beyond the required set must follow the naming convention and are subject to review by the observability team. **High-cardinality tags** — tags with more than 1,000 unique values (e.g., raw user IDs, full URLs, request bodies) — are prohibited because they cause metric explosion and cost overruns. Tag cardinality is monitored, and violations trigger automated alerts to the owning team.

---

## Dashboard Hierarchy

Datadog dashboards are organized in a four-level hierarchy to serve different audiences and use cases.

### Hierarchy

| Level | Audience | Content |
|---|---|---|
| **Executive** | Group CTO, subsidiary CTOs, VP Engineering | Aggregate SLO compliance (red/yellow/green), error budget burn rate, monthly trends |
| **Subsidiary** | Subsidiary engineering leads, operations teams | Per-subsidiary health: availability, latency p95, error rate, deployment frequency, active incidents |
| **Service** | Service owners, on-call engineers | Per-service deep dive: request rate, latency distribution, error breakdown, resource utilization, recent deployments |
| **Component** | Platform engineers, SREs | Infrastructure: AKS cluster health, node pool utilization, persistent volume status, database performance |

### Naming Convention

Dashboard names follow the pattern:

```
[{Level}] {Subsidiary} — {Name}
```

For instance:
- `[Executive] Acme Corporation — SLO Overview`
- `[Subsidiary] Retail — Service Health`
- `[Service] Retail — BookStore API`
- `[Component] Platform — AKS East US 2`

### Access Control

Executive dashboards are visible to all authenticated users. Subsidiary dashboards are restricted to the owning subsidiary's teams and Acme Tech platform engineers. Service and component dashboards follow team-level RBAC.

---

## Alerting Framework

The alerting framework defines severity levels, response expectations, notification routing, and alert lifecycle management.

### Severity Levels

| Severity | Response Time | Trigger Criteria | Notification Channels |
|---|---|---|---|
| **P1 (Critical)** | 15 min acknowledge | Service down, data loss risk, security breach | PagerDuty page (on-call + backup), Slack `#incident-active`, VP Engineering email |
| **P2 (High)** | 30 min acknowledge | Major degradation, error rate >5%, SLO breach imminent | PagerDuty page (on-call), Slack `#incident-active` |
| **P3 (Medium)** | 4 hr (business hours) | Minor degradation, elevated latency, non-critical dependency failure | Slack `#{subsidiary}-alerts`, team lead email |
| **P4 (Low)** | Next business day | Cosmetic issue, minor anomaly, informational threshold | Slack `#{subsidiary}-alerts` |

### Auto-Escalation

P1 alerts that are not acknowledged within the defined windows escalate automatically:

| Time Since Alert | Escalation Target |
|---|---|
| 5 minutes | Incident Commander on-call |
| 15 minutes | VP Platform Engineering |
| 30 minutes | Subsidiary CTO |

### Alerts-as-Code

All Datadog monitors are defined as **Terraform resources** stored in the `acme-tech/infrastructure` repository. Changes to alert definitions follow the standard pull request review process. Direct creation of monitors in the Datadog UI is permitted for temporary investigation but must be codified in Terraform within 5 business days or deleted.

### Alert Fatigue Mitigation

The observability team conducts a **quarterly alert review** across all subsidiaries. Alerts that fire more than 10 times per week without resulting in actionable investigation are flagged as noisy and must be adjusted (threshold tuned, condition refined, or downgraded). The target signal-to-noise ratio is **>80%** — at least 80% of alerts should result in a meaningful human action.

### On-Call Rotation

**PagerDuty** manages on-call schedules for each subsidiary and the shared platform team. On-call follows a **follow-the-sun** model across three regions:

| Region | Coverage (UTC) | Teams |
|---|---|---|
| US (Chicago) | 14:00 – 22:00 | Acme Tech Platform, Retail, FSI |
| EU (London) | 06:00 – 14:00 | Acme Tech EU, Telco, Media |
| APAC (Singapore) | 22:00 – 06:00 | Acme Tech APAC, Distribution, Insurance |

---

## Cost Optimization

Datadog costs are managed centrally by Acme Tech with **chargeback to each subsidiary** based on usage.

### Log Collection Reduction

High-volume services implement log collection reduction to control ingestion costs:

- **INFO** logs: Collected at 10% in production (tail-based collection retains 100% of logs belonging to traces with errors)
- **WARN**, **ERROR**, **FATAL** logs: Always ingested at 100%

This strategy achieves approximately **70% reduction** in log volume for high-throughput services while preserving complete visibility into anomalous behavior.

### Metric Retention

| Retention Period | Granularity | Use Case |
|---|---|---|
| 15 days | Raw (10-second resolution) | Active investigation, real-time dashboards |
| 15 months | Aggregated (1-hour granularity) | Trend analysis, capacity planning, SLO reporting |

### Custom Metrics Budget

Each subsidiary is allocated a custom metrics budget based on its service count and SLA tier. Monthly usage is tracked in the FinOps report. Overages are flagged to the subsidiary engineering lead and included in the quarterly cost review with the Group CTO.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — Platform architecture and infrastructure topology
- [Incident Management](./incident-management.md) — Incident response procedures and severity definitions
- [SLA Framework](./sla-framework.md) — SLA tiers, SLOs, and error budgets
- [API Gateway Architecture](../api/gateway-overview.md) — Gateway monitoring and alerting
