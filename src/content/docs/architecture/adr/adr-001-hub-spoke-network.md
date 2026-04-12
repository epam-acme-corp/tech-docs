---
title: "ADR-001 — Hub-Spoke Network Architecture for Multi-Subsidiary Isolation"
description: "---"
---

# ADR-001: Hub-Spoke Network Architecture for Multi-Subsidiary Isolation

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2023-06-15 |
| **Deciders** | Marcus Chen (Group CTO), James Kowalski (Director of Infrastructure), David Reeves (VP Security & CISO) |
| **Reviewed by** | Architecture Review Board |

---

## Context

Acme Corporation operates six subsidiaries — Acme Retail, Acme Financial Services, Acme Telco, Acme Insurance, Acme Distribution, and Acme Media — each with distinct security requirements, compliance obligations, and operational profiles. As the enterprise consolidated onto Microsoft Azure, a critical networking decision was required: how to provide each subsidiary with appropriate network isolation while still enabling efficient access to shared platform services operated by Acme Tech.

Three options were evaluated:

1. **Flat network (single VNet):** All subsidiaries and shared services operate in a single Azure Virtual Network with subnet-level isolation via Network Security Groups (NSGs). This approach minimizes complexity but creates an unacceptable blast radius — a compromised workload in one subsidiary could potentially reach resources belonging to another. Regulatory requirements for Acme Financial Services (PCI DSS network segmentation) and Acme Insurance (HIPAA access controls) made this option non-viable.

2. **Fully isolated networks (no peering):** Each subsidiary operates in a completely isolated VNet with no direct connectivity to other subsidiaries or shared services. While this provides maximum isolation, it eliminates the ability to share platform services efficiently. Every subsidiary would need its own DNS infrastructure, firewall, identity services, and observability endpoints — defeating the purpose of Acme Tech's shared services model.

3. **Hub-spoke network (Azure Landing Zones):** A central hub VNet hosts shared platform services, and each subsidiary operates in a dedicated spoke VNet peered to the hub. This balances isolation with shared service access, aligns with Microsoft's Azure Landing Zones reference architecture, and satisfies regulatory segmentation requirements.

---

## Decision

We will implement an **Azure Landing Zones hub-spoke Virtual Network topology** with the following structure:

### Hub VNet (Acme Tech)

The hub VNet (CIDR: **10.0.0.0/16**) resides in the central Acme Tech Azure subscription and hosts all shared network services:

- **Azure Firewall (Premium)** — Centralized egress filtering with threat intelligence, IDPS, TLS inspection for non-sensitive traffic, and FQDN-based application rules. Deployed in a dedicated `AzureFirewallSubnet` with zone redundancy across all three availability zones.
- **Azure Bastion** — Secure RDP/SSH access to virtual machines without public IP exposure. All administrative access to VMs routes through Bastion.
- **Azure Private DNS Zones** — Centralized DNS resolution for all Private Endpoints across the enterprise. Private DNS Zones are linked to each spoke VNet, enabling subsidiaries to resolve Private Endpoint FQDNs without maintaining their own DNS infrastructure.
- **VPN/ExpressRoute Gateway** — Hybrid connectivity to on-premises data centers (Acme Insurance legacy systems, Acme Telco network operations centers) via ExpressRoute circuits with redundant connections.
- **Shared platform services** — API Management (internal mode), container registries, shared AKS clusters, and Key Vault instances that serve cross-subsidiary functions.

### Spoke VNets (Per Subsidiary)

Each subsidiary receives a dedicated spoke VNet in its own Azure subscription with a /16 CIDR allocation:

| Subsidiary | Spoke VNet CIDR | Azure Subscription |
|---|---|---|
| Acme Retail | 10.1.0.0/16 | `acme-retail-prod` |
| Acme Financial Services | 10.2.0.0/16 | `acme-fsi-prod` |
| Acme Telco | 10.3.0.0/16 | `acme-telco-prod` |
| Acme Insurance | 10.4.0.0/16 | `acme-insurance-prod` |
| Acme Distribution | 10.5.0.0/16 | `acme-distribution-prod` |
| Acme Media | 10.6.0.0/16 | `acme-media-prod` |

### Peering and Routing

- **VNet peering** is configured from each spoke to the hub (spoke-to-hub). Spoke-to-spoke peering is **not** enabled by default.
- **Spoke-to-spoke traffic** that must transit (approved cross-subsidiary integrations) routes through the hub Azure Firewall, which inspects and logs all traffic.
- **User-Defined Routes (UDRs)** on each spoke's subnets direct default traffic (0.0.0.0/0) to the Azure Firewall in the hub for egress inspection.
- **NSGs** are applied to every subnet in both hub and spoke VNets, enforcing deny-by-default with explicit allow rules for required traffic flows.

### Private Endpoints

All Azure PaaS services (Key Vault, Storage Accounts, Cosmos DB, Azure AI Search, Event Hubs, Azure SQL) are accessed exclusively through **Private Endpoints** deployed in the appropriate VNet. Private DNS Zones in the hub provide name resolution, ensuring that PaaS FQDN lookups resolve to private IP addresses rather than public endpoints.

### IP Address Management

IP address allocation is managed centrally by the Acme Tech Infrastructure team using an automated IPAM solution integrated with Terraform. Subnet requests are submitted via pull request to the `acme-tech/network-config` repository, where automated validation ensures no CIDR overlap before merging.

---

## Consequences

### Positive

- **Strong subsidiary isolation:** Each subsidiary operates in its own VNet and Azure subscription, providing network-level isolation that satisfies PCI DSS (Acme FSI), HIPAA (Acme Insurance), and general security best practices.
- **Centralized security enforcement:** All egress traffic routes through the hub Azure Firewall, enabling consistent threat detection, FQDN filtering, and traffic logging across the enterprise.
- **Simplified DNS management:** Centralized Private DNS Zones eliminate the need for each subsidiary to manage their own DNS infrastructure for Private Endpoint resolution.
- **Compliance-friendly architecture:** The clear network segmentation maps directly to compliance control requirements, simplifying audit evidence collection and reporting.
- **Scalable IP planning:** /16 CIDR allocations per subsidiary provide 65,536 addresses each, accommodating significant growth without re-addressing.

### Negative

- **Routing complexity:** UDRs, NSGs, and firewall rules across seven VNets create operational complexity. Misconfigured routes can cause connectivity issues that are difficult to diagnose.
- **Hub as potential bottleneck:** All spoke-to-spoke traffic and egress traffic routes through the hub Azure Firewall, which could become a throughput bottleneck under heavy load.
- **VNet peering costs:** While VNet peering within the same Azure region is low-cost, data transfer across peered VNets incurs charges that scale with traffic volume.
- **IP planning discipline required:** CIDR allocations must be planned carefully to avoid overlaps, especially as new subnets are provisioned within each spoke.

### Mitigations

- **Azure Firewall high availability:** Firewall is deployed across three availability zones with auto-scaling to handle traffic spikes. Throughput is monitored in Datadog with alerts at 70% capacity.
- **Automated IPAM:** Terraform-based IP address management with automated validation prevents CIDR conflicts and maintains a centralized source of truth for all network allocations.
- **Hub sized for growth:** The hub VNet /16 allocation and firewall SKU (Premium) are sized to accommodate projected enterprise growth through 2027 without architectural changes.
- **Network monitoring:** Datadog Network Performance Monitoring provides real-time visibility into traffic flows, latency, and packet loss across all peered VNets.

---

## Related Documents

- [Platform Architecture Overview](../overview.md)
- [ADR-002: GitHub Enterprise Cloud Standardization](./ADR-002-github-enterprise-cloud.md)
- [ADR-003: Entra ID Federation](./ADR-003-entra-id-federation.md)
