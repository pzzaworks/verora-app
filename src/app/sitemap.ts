import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { source } from '@/lib/source';

/** Public pages worth indexing; wallet-specific pages (dashboard, registration) are left out */
const STATIC_ROUTES: ReadonlyArray<{ path: string; changeFrequency: 'daily' | 'monthly' | 'yearly'; priority: number }> = [
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  { path: '/agents', changeFrequency: 'daily', priority: 0.8 },
  { path: '/brand', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await source.getPages();

  return [
    ...STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
      url: path === '/' ? siteConfig.url : `${siteConfig.url}${path}`,
      changeFrequency,
      priority,
    })),
    ...docs.map((page) => ({
      url: `${siteConfig.url}${page.url}`,
      lastModified: page.lastModified,
      changeFrequency: 'weekly' as const,
      priority: page.url === '/docs' ? 0.9 : 0.6,
    })),
  ];
}
