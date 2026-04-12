---
title: "Incident Management Framework"
description: "Acme Tech's incident management framework ensures rapid detection, coordinated response, clear communication, and blameless retrospectives for all pro"
---

# Incident Management Framework

Acme Tech's incident management framework ensures rapid detection, coordinated response, clear communication, and blameless retrospectives for all production incidents across the shared technology platform and subsidiary systems. The framework applies to every service running in the Acme Corporation production environment.

The primary objectives are to minimize customer and business impact, restore service as rapidly as possible, and prevent recurrence through systematic learning. For the observability platform that powers detection, see [Observability Platform](./observability.md). For SLA targets that define acceptable impact windows, see [SLA Framework](./sla-framework.md). For platform architecture context, see [Architecture Overview](../architecture/overview.md).

---

## Incident Severity Levels

Every incident is classified by severity at declaration. Severity determines response expectations, communication requirements, and stakeholder involvement.

| Severity | Definition | Customer Impact | Acknowledge SLA | Mitigation SLA | Typical Scenarios |
|---|---|---|---|---|---|
| **SEV1** | Revenue-impacting outage or security breach | Direct revenue loss, data exposure, regulatory impact | 15 minutes | 1 hour | Retail checkout completely unavailable; FSI trading engine halted; confirmed data breach |
| **SEV2** | Major service degradation | Significant feature unavailable, multi-subsidiary impact | 30 minutes | 2 hours | API Gateway degraded response times >5s; authentication failures across multiple subsidiaries; Cosmos DB regional failover |
| **SEV3** | Minor impact with workaround | Non-critical feature impaired, single subsidiary | 4 hours | 8 hours | Reporting pipeline delayed; single subsidiary dashboard unavailable; non-critical background job failures |
| **SEV4** | Cosmetic or minimal impact | No direct customer impact | Next business day | Next business day | Dashboard rendering issue; log formatting inconsistency; alert threshold tuning |

Severity can be **upgraded or downgraded** by the Incident Commander at any point based on evolving impact assessment. All severity changes must be documented in the incident timeline with justification.

---

## Incident Commander Rotation

The Incident Commander (IC) owns the lifecycle of every SEV1 and SEV2 incident from declaration through post-incident review.

### IC Pool

The IC pool comprises **12 trained individuals**: 8 from Acme Tech Platform Engineering and 4 from high-criticality subsidiaries (Acme Retail and Acme Financial Services). The rotation operates on a **weekly schedule, Monday to Monday**, with a primary IC and a secondary backup.

### IC Responsibilities

- **Own the incident lifecycle** from declaration to closure and post-incident review scheduling
- **Coordinate response** by assembling the right subject matter experts and assigning roles
- **Make operational decisions** including authorizing emergency changes, approving rollbacks, and activating war rooms
- **Manage communications** ensuring timely stakeholder updates per the communication protocol
- **Ensure post-incident review** is scheduled within 5 business days for SEV1/SEV2

### Training and Qualification

- All ICs complete **annual scenario-based training** that covers declaration, triage, escalation, communication, and closure across multiple incident types.
- New IC candidates **shadow active ICs for a minimum of 4 weeks** (at least 2 incidents) before being added to the primary rotation.
- IC performance is reviewed quarterly by the VP Platform Engineering.

### Escalation Chain

```
On-Call Engineer -> Incident Commander -> VP Platform Engineering -> Group CTO
```

Each escalation tier adds decision-making authority. The Group CTO is engaged only for SEV1 incidents with cross-subsidiary impact or customer data exposure.

---

## Communication Channels

Clear, consistent communication is critical during incidents. The following channels and protocols are used depending on severity.

### Slack

| Channel | Purpose | When Used |
|---|---|---|
| `#incident-active` | Primary coordination channel; bot creates a thread per incident | All severities |
| `#incident-{sev}-{date}-{name}` | Dedicated channel for SEV1/SEV2 incidents | Auto-created by incident bot at declaration; archived after PIR |
| `#{subsidiary}-alerts` | Subsidiary-specific alert notifications | SEV3/SEV4, low-priority items |

The incident Slack bot automatically creates a thread in `#incident-active` when an incident is declared, populating it with severity, impacted services, IC assignment, and links to relevant dashboards.

### Status Page

**status.acmecorp.com** is the customer-facing status page for SEV1 and SEV2 incidents. It is integrated with Datadog and supports:

- **Component-level status**: Individual service health (Operational, Degraded Performance, Partial Outage, Major Outage)
- **Incident updates**: Timeline of investigation progress, impact scope, and resolution
- **Subscriber notifications**: Email and webhook notifications to registered subscribers

The Comms Lead (or IC in the absence of a Comms Lead) is responsible for updating the status page within 15 minutes of SEV1 declaration and every 30 minutes thereafter.

### Stakeholder Email

| Severity | Recipients | Cadence |
|---|---|---|
| **SEV1** | VPs, subsidiary CTOs, Group CTO | Declaration, hourly updates, resolution |
| **SEV2** | Subsidiary CTO(s) of impacted business units | Declaration, resolution |
| **SEV3/SEV4** | No email escalation | — |

Email templates are maintained in the `acme-tech/incident-templates` repository. Templates cover declaration, status update, and resolution notifications with pre-defined fields for impact, timeline, and next steps.

### War Room Activation

For SEV1 incidents, a **Microsoft Teams war room** is activated within 15 minutes of declaration. For extended incidents lasting more than 4 hours, an in-person war room is convened at Acme Corporation's Chicago headquarters (8th floor, Incident Response Center).

---

## Post-Incident Review Process

Post-Incident Reviews (PIRs) are the primary mechanism for learning from incidents and driving systemic improvements.

### Requirements

| Severity | PIR Required | Deadline |
|---|---|---|
| SEV1 | Mandatory | Within 5 business days |
| SEV2 | Mandatory | Within 5 business days |
| SEV3 | Optional (IC discretion) | Within 10 business days |
| SEV4 | Not required | — |

### PIR Document Structure

All PIR documents are stored in the `acme-tech/incident-reviews` repository using a standardized template:

| Section | Content |
|---|---|
| **Summary** | One-paragraph description of the incident, severity, duration, and impact |
| **Timeline** | Minute-by-minute chronological record from detection to resolution |
| **Root Cause** | Analysis using the 5 Whys technique, identifying contributing factors |
| **Impact** | Quantified customer and business impact (users affected, revenue impact, SLO budget consumed) |
| **Action Items** | Specific, assigned, time-bound corrective actions tracked as GitHub Issues |
| **Lessons Learned** | Systemic observations about processes, tools, or architecture |

### Blameless Culture

All PIRs follow a **blameless** approach. The review focuses on systemic conditions, not individual actions. The guiding question is: *"What conditions in our systems, processes, and tools allowed this to happen?"* — never *"Who caused this?"*

PIR meetings are 60 minutes, facilitated by the IC, and recorded for team members who cannot attend. Attendance is mandatory for the on-call engineer, IC, and service owners of impacted systems.

---

## Runbook Repository Structure

Runbooks provide step-by-step guidance for diagnosing and resolving known failure modes.

### Location and Naming

- **Location**: `{service-repo}/docs/runbooks/`
- **Naming Convention**: `{symptom-or-procedure}.md` (e.g., `high-latency.md`, `database-failover.md`, `certificate-renewal.md`)

### Required Sections

Every runbook must include:

| Section | Description |
|---|---|
| **Symptom** | Observable behavior that triggers this runbook (alert name, error message, dashboard anomaly) |
| **Diagnostic Steps** | Ordered investigation steps with specific commands, queries, and dashboard links |
| **Resolution** | Step-by-step remediation procedure |
| **Escalation** | When and how to escalate if resolution steps fail |
| **Related Resources** | Links to Datadog dashboards, alerts, architecture diagrams, and related runbooks |

### Runbook Linking

All Datadog monitors must include a `runbook_url` tag that links directly to the relevant runbook. When an alert fires, the on-call engineer can immediately access the applicable diagnostic procedure.

### Staleness Detection

A scheduled GitHub Action scans all runbooks across service repositories and generates alerts for any runbook whose `last-modified` date exceeds **6 months**. Stale runbooks are flagged to the owning team for review and update. Runbooks that remain stale for 9 months are escalated to the subsidiary engineering lead.

---

## Change Management

All changes to production systems follow the Acme Tech change management process. The Change Advisory Board (CAB) meets **weekly on Tuesday at 10:00 AM Central Time**.

### Change Categories

| Category | Approval | Requirements | Rollback |
|---|---|---|---|
| **Standard** | Pre-approved (no CAB) | Low-risk, well-understood changes matching pre-approved templates | Automated rollback via deployment pipeline |
| **Normal** | CAB review required | Implementation plan, rollback plan, test evidence, scheduled change window | Documented rollback procedure, tested in staging |
| **Emergency** | CAB bypass (IC authorization) | Required for active SEV1/SEV2 resolution | Retrospective CAB review within 2 business days |

### Risk Scoring

Every normal change is assigned a risk score based on four dimensions:

| Dimension | Score Range | Criteria |
|---|---|---|
| **Services Affected** | 1-5 | Number of services impacted by the change |
| **Data Changes** | 0-3 | Schema migration, data transformation, or data deletion involved |
| **Infrastructure Changes** | 0-3 | Network, compute, storage, or security group modifications |
| **Blast Radius** | 1-5 | Number of subsidiaries potentially impacted |

Changes with a **total risk score exceeding 10** require VP Platform Engineering approval in addition to CAB review.

### Change Windows

Standard maintenance windows are **Tuesday and Thursday, 10:00 PM - 2:00 AM Central Time**. These windows are selected to minimize overlap with peak business hours across all subsidiaries and time zones.

Emergency changes can be executed at any time with IC authorization.

### Freeze Periods

Subsidiary-specific freeze periods prohibit non-emergency changes to protect business-critical operations:

| Subsidiary | Freeze Period | Rationale |
|---|---|---|
| **Acme Retail** | Black Friday through Cyber Monday (extended to full Thanksgiving week) | Peak retail revenue period |
| **Acme Financial Services** | Last 5 business days of each fiscal quarter | Quarter-end financial processing and reporting |
| **Acme Insurance** | Annual open enrollment period (November 1 - December 15) | Peak policy enrollment volume |

During freeze periods, only emergency changes authorized by both the IC and the subsidiary CTO are permitted.

---

## War Room Protocols for SEV1

SEV1 incidents activate a structured war room with defined roles, cadence, and decision authority.

### Activation

The war room is activated within **15 minutes** of SEV1 declaration. The IC is responsible for activation.

### War Room Roles

| Role | Responsibility | Assigned By |
|---|---|---|
| **Incident Commander** | Facilitates the war room, makes operational decisions, authorizes actions | On-call rotation |
| **Scribe** | Documents the real-time timeline, decisions, and action items | IC assigns |
| **Comms Lead** | Manages stakeholder email updates and status page | IC assigns |
| **Tech Lead** | Leads technical investigation, coordinates diagnostic and remediation efforts | IC assigns (typically the senior on-call from the impacted service) |
| **SMEs** | Provide domain expertise for specific components or subsidiaries | IC pages as needed |

### Communication Cadence

| Channel | Frequency |
|---|---|
| Internal war room sync | Every 15 minutes |
| External status page update | Every 30 minutes |
| Stakeholder email | Every 60 minutes |

### IC Authority

The Incident Commander has the authority to:

- Page any team or individual across the organization
- Approve emergency changes without CAB review
- Authorize service rollbacks
- Declare all-hands for the impacted subsidiary

The following actions require **VP Platform Engineering approval**:

- Communications regarding customer data exposure to external parties
- Engagement of external vendor support (Azure, Datadog, third-party consultants)
- Extension of change freeze periods beyond the original scope

### Incident Closure

A SEV1 incident is declared **resolved** when the primary impact is mitigated and the service has maintained **30 minutes of stability** (all SLIs within normal thresholds). After closure, the impacted service enters a **24-hour monitoring status** with heightened alert sensitivity (P3 thresholds lowered to P2) to detect any recurrence.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — Platform architecture and service topology
- [Observability Platform](./observability.md) — Monitoring, alerting, and dashboard access
- [SLA Framework](./sla-framework.md) — SLA tiers and error budget policies
- [API Gateway Architecture](../api/gateway-overview.md) — Gateway health monitoring and circuit breakers
