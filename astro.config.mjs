import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://epam-acme-corp.github.io',
  base: '/tech-docs',
  integrations: [
    starlight({
      title: 'Acme Tech Docs',
      social: {
        github: 'https://github.com/epam-acme-corp/tech-docs',
      },
      components: {
        SiteTitle: './src/components/OPCOSelector.astro',
      },
      sidebar: [
        {
          label: 'Overview',
          autogenerate: { directory: 'business' },
        },
        {
          label: 'Architecture',
          items: [
            {
              label: 'Overview',
              autogenerate: { directory: 'architecture', collapsed: true },
            },
            {
              label: 'ADRs',
              autogenerate: { directory: 'architecture/adr' },
            },
          ],
        },
        {
          label: 'Technical',
          autogenerate: { directory: 'technical' },
        },
        {
          label: 'API',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Data',
          autogenerate: { directory: 'data' },
        },
        {
          label: 'Operations',
          autogenerate: { directory: 'operations' },
        },
        {
          label: 'Security',
          autogenerate: { directory: 'security' },
        },
      ],
    }),
  ],
});
