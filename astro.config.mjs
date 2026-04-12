import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://epam-acme-corp.github.io',
  base: '/tech-docs',
  integrations: [
    starlight({
      title: 'Acme Tech Docs',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/epam-acme-corp/tech-docs',
        },
      ],
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'Business Overview', slug: 'business/overview' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Platform Architecture', slug: 'architecture/overview' },
            {
              label: 'ADRs',
              items: [
                { label: 'ADR-001: Hub-Spoke Network', slug: 'architecture/adr/adr-001-hub-spoke-network' },
                { label: 'ADR-002: GitHub Enterprise Cloud', slug: 'architecture/adr/adr-002-github-enterprise-cloud' },
                { label: 'ADR-003: Entra ID Federation', slug: 'architecture/adr/adr-003-entra-id-federation' },
              ],
            },
          ],
        },
        {
          label: 'Technical',
          items: [
            { label: 'Platform Engineering', slug: 'technical/platform-engineering' },
            { label: 'Developer Experience', slug: 'technical/developer-experience' },
            { label: 'GitHub Governance', slug: 'technical/github-governance' },
            { label: 'Copilot Governance', slug: 'technical/copilot-governance' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'Gateway Overview', slug: 'api/gateway-overview' },
            { label: 'API Standards', slug: 'api/api-standards' },
          ],
        },
        {
          label: 'Data',
          items: [
            { label: 'Platform Overview', slug: 'data/platform-overview' },
            { label: 'RAG Architecture', slug: 'data/rag-architecture' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Observability', slug: 'operations/observability' },
            { label: 'Incident Management', slug: 'operations/incident-management' },
            { label: 'SLA Framework', slug: 'operations/sla-framework' },
          ],
        },
        {
          label: 'Security',
          items: [
            { label: 'Identity & Access Management', slug: 'security/identity-access-management' },
            { label: 'Access Policies', slug: 'security/access-policies' },
          ],
        },
      ],
    }),
  ],
});
