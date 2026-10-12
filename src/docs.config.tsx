import { defineConfig } from 'pzzadocs';
import { siteConfig } from '@/config/site';

// Docs configuration consumed by the content source (`lib/source.ts`), the
// root provider, and the docs route layouts.
const config = defineConfig({
  title: siteConfig.name,
  description:
    'Decentralized AI Agent Oracle Protocol. Smart contracts are the source of truth, every query is end-to-end encrypted, and your wallet is your identity - no API keys needed.',
  logo: { src: '/logo.svg', alt: siteConfig.name, width: 24, height: 24 },
  contentDir: 'content/docs',
  baseUrl: '/docs',
  siteUrl: siteConfig.url,
  nav: {
    links: [
      { text: 'Documentation', href: '/docs', activePrefix: '/docs' },
      { text: 'Agents', href: '/agents' },
      { text: 'Dashboard', href: '/dashboard' },
    ],
    github: siteConfig.links.github,
  },
  search: { enabled: true },
  // No page uses TeX, so the math pipeline (and its stylesheet) stays off.
  math: { enabled: false },
  lastModified: 'git',
});

export default config;
