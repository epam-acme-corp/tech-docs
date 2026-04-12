---
title: "SLA Framework"
description: "Acme Tech maintains formal Service Level Agreements (SLAs) for all shared platform services consumed by the six Acme Corporation subsidiaries. SLAs ar"
---

# SLA Framework

Acme Tech maintains formal Service Level Agreements (SLAs) for all shared platform services consumed by the six Acme Corporation subsidiaries. SLAs are tiered based on the criticality of each subsidiary's operations and any applicable regulatory requirements. Each SLA is backed by measurable Service Level Objectives (SLOs) and Service Level Indicators (SLIs) that are continuously monitored.

This document defines the SLA tiers, SLO targets, error budget policy, measurement methodology, and reporting cadence. For the observability platform that powers SLI measurement, see [Observability Platform](./observability.md). For the incident response process triggered by SLO breaches, see [Incident Management](./incident-management.md). For platform architecture context, see [Architecture Overview](../architecture/overview.md).

---

## SLA Tiers

Subsidiaries are assigned to one of three SLA tiers based on business criticality, regulatory obligations, and revenue impact.

| Tier | Availability Target | Permitted Downtime (Annual) | Assigned Subsidiaries | Rationale |
|---|---|---|---|---|
| **Tier 1** | 99.99% | ~52 minutes/year | Acme Financial Services, Acme Insurance | Subject to financial and insurance regulatory requirements; outages carry direct compliance risk and potential fines |
| **Tier 2** | 99.95% | ~4.4 hours/year | Acme Retail, Acme Telco | High-revenue, customer-facing operations where downtime directly impacts revenue and customer satisfaction |
| **Tier 3** | 99.9% | ~8.8 hours/year | Acme Distribution, Acme Media | Business-critical but not subject to external regulatory requirements; greater tolerance for planned maintenance |

SLA tier assignments are reviewed annually during the Q4 planning cycle. A subsidiary may request an upgrade to a higher tier with written business justification and budget approval, as higher tiers require additional infrastructure redundancy and on-call coverage.

---

## SLO Definitions

Each SLA tier is backed by specific SLO targets across four dimensions.

### Availability

Availability is measured as the percentage of successful health check responses over a calendar month.

| Tier | Monthly SLO |
|---|---|
| Tier 1 | 99.99% |
| Tier 2 | 99.95% |
| Tier 3 | 99.9% |

A health check is considered successful when the service responds with HTTP 200 within the configured timeout (5 seconds for Tier 1, 10 seconds for Tier 2/3).

### Latency

| Tier | p95 Latency | p99 Latency |
|---|---|---|
| Tier 1 | <= 200 ms | <= 500 ms |
| Tier 2 | <= 300 ms | <= 800 ms |
| Tier 3 | <= 500 ms | <= 1,500 ms |

Latency is measured at the API Gateway for the complete request lifecycle (gateway ingress to backend response to gateway egress). Client-side network latency is excluded.

### Error Rate

All tiers share the same error rate SLO:

- **< 0.1% server errors (5xx responses)** per calendar month

Client errors (4xx) are excluded from the error rate SLO as they typically reflect caller-side issues rather than platform reliability.

### Throughput

| Tier | Sustained Throughput |
|---|---|
| Tier 1 | 10,000 requests/sec |
| Tier 2 | 5,000 requests/sec |
| Tier 3 | 1,000 requests/sec |

Throughput SLOs represent the minimum sustained capacity the platform guarantees for each tier. Burst capacity above the sustained threshold is available but not guaranteed during peak concurrent load from multiple subsidiaries.

---

## Error Budget Policy

Error budgets translate SLO targets into a concrete allowance of unreliability per measurement period. The budget provides teams with a quantitative framework for balancing feature velocity against reliability investment.

### Budget Calculation

Error budget is calculated as: **(1 - SLO target) x total minutes in the measurement period**.

For a 30-day month (43,200 minutes):

| Tier | SLO | Monthly Error Budget |
|---|---|---|
| Tier 1 | 99.99% | 4.32 minutes |
| Tier 2 | 99.95% | 21.6 minutes |
| Tier 3 | 99.9% | 43.2 minutes |

### Budget Exhaustion Policy (0% Remaining)

When a subsidiary's error budget is fully exhausted within the current measurement period, the following measures take effect immediately:

1. **Deployment freeze**: All non-reliability deployments are suspended for services consumed by the affected subsidiary. Only changes that directly improve reliability (bug fixes, scaling, failover improvements) are permitted.
2. **Engineering reallocation**: The subsidiary's platform engineering allocation is dedicated to reliability work until the budget recovers.
3. **Mandatory post-mortem**: Every incident that consumed error budget during the period must have a completed post-incident review with assigned action items.
4. **Recovery gate**: The deployment freeze remains in effect until the error budget recovers to at least **25%** of the monthly allowance (calculated on a rolling 30-day window).

### Low Budget Policy (< 25% Remaining)

When the error budget drops below 25%, precautionary measures activate:

1. **Increased review rigor**: All deployments to affected services require an additional Acme Tech platform engineer as a reviewer.
2. **Daily SLO check-in**: A brief daily stand-up (15 minutes) reviews the current SLO status and any planned changes.
3. **Lowered risk threshold**: The change management risk score threshold for VP approval is reduced from >10 to **>7**.

---

## Measurement Methodology

SLIs are measured using a combination of synthetic monitoring and Real User Monitoring (RUM) to provide both contractual and experiential perspectives.

### Synthetic Monitoring

Datadog Synthetic probes execute health checks against every service endpoint covered by an SLA.

| Parameter | Configuration |
|---|---|
| **Frequency** | Every 60 seconds |
| **Probe Locations** | East US, West US, EU West |
| **Protocol** | HTTPS GET to the service health endpoint |
| **Success Criteria** | HTTP 200 within timeout (5s Tier 1, 10s Tier 2/3) |
| **Availability Calculation** | (Successful probes / Total probes) x 100% per calendar month |

Synthetic monitoring results form the **contractual basis** for SLA compliance reporting. If a probe fails from one location but succeeds from the other two, the check is recorded as successful (majority rule). If probes fail from two or more locations simultaneously, the check is recorded as a failure.

### Real User Monitoring

Datadog RUM is deployed on customer-facing applications for Acme Retail, Acme Media, and the Acme Financial Services client portal. RUM captures:

- **Page load time** (Largest Contentful Paint, First Input Delay, Cumulative Layout Shift)
- **Interaction latency** (time from user action to visual response)
- **JavaScript error rate** (unhandled exceptions in the browser)
- **API call performance** (XHR/Fetch timings correlated with backend traces)

RUM data serves as a **supplementary quality signal** that provides the real end-user experience perspective. RUM metrics inform reliability prioritization and user experience improvements but are not used for contractual SLA calculations.

### Exclusions

The following periods are excluded from SLA availability calculations:

- **Planned maintenance**: Maximum 4 hours per month, pre-announced at least 72 hours in advance to all affected subsidiary operations teams. Maintenance windows are scheduled during the approved change windows (Tuesday/Thursday 10:00 PM - 2:00 AM CT).
- **Force majeure**: Azure regional outages confirmed by Microsoft Azure status page, natural disasters, or events beyond reasonable control. Force majeure exclusions require mutual written agreement between Acme Tech and the affected subsidiary.

---

## Reporting Cadence

SLA and SLO performance is reported at four cadences to ensure visibility from operational teams through executive leadership.

### Weekly

Real-time Datadog dashboards provide continuous SLO visibility. An **automated summary email** is generated every Monday at 08:00 AM Central Time and distributed to subsidiary operations leads. The weekly report includes:

- Current availability percentage vs. target
- Error budget remaining (absolute and percentage)
- Top 3 latency contributors
- Active incidents impacting the SLO

### Monthly

A formal monthly report is delivered to subsidiary CTOs and the VP Platform Engineering by the 5th business day of each month. The report covers:

- Availability vs. target (with daily breakdown)
- Latency p95/p99 trends
- Error rate by service
- Error budget consumed (with incident correlation)
- Incidents contributing to budget burn
- Action items from post-incident reviews

### Quarterly

The quarterly executive review is presented to the Group CTO and subsidiary CTOs. Content includes:

- Three-month SLA compliance trends across all tiers
- Risk assessment for upcoming quarters (planned migrations, capacity concerns)
- Investment recommendations for reliability improvements
- SLA tier adjustment proposals (if any)
- FinOps cost allocation for observability and redundancy infrastructure

### Annual

The annual SLA review and renewal occurs during Q4 planning. Each subsidiary and Acme Tech jointly review:

- Full-year SLA performance
- Tier assignment appropriateness
- SLO target revisions (tightening or relaxing based on business evolution)
- Budget implications of tier changes
- Contractual language updates

Any tier adjustments take effect at the start of the following fiscal year.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — Platform architecture and redundancy design
- [Observability Platform](./observability.md) — Datadog monitoring, Synthetic probes, and RUM configuration
- [Incident Management](./incident-management.md) — Incident severity levels and response SLAs
- [API Gateway Architecture](../api/gateway-overview.md) — Gateway rate limiting and health monitoring
