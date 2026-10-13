const DEFAULT_SITE_URL = 'https://veroraprotocol.com';

/** Public origin of the app; NEXT_PUBLIC_SITE_URL overrides it (e.g. for staging). Trailing slashes are dropped. */
function resolveSiteUrl(value: string | undefined): string {
  if (!value) return DEFAULT_SITE_URL;
  try {
    return new URL(value).origin;
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an absolute URL, e.g. https://veroraprotocol.com');
  }
}

export const siteConfig = {
  name: 'Verora',
  description: 'Decentralized AI Oracle Network',
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  /** Square brand mark used for Open Graph and Twitter cards */
  ogImage: { url: '/verora-app.png', width: 1024, height: 1024, alt: 'Verora' },
  links: {
    github: 'https://github.com/pzzaworks/verora-sdk',
    docs: '/docs',
    terms: 'https://pzza.works/terms-conditions',
    privacy: 'https://pzza.works/privacy-policy',
  },
  navItems: [
    { name: 'Home', href: '/' },
    { name: 'Agents', href: '/agents' },
    { name: 'Stake', href: '/stake' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Docs', href: '/docs' },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
