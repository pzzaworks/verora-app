import type { Metadata } from 'next';
import type { PageData } from 'pzzadocs';
import { siteConfig } from '@/config/site';

/**
 * Metadata for a documentation page built from its frontmatter. The canonical
 * always points at the `/docs/*` URL on the public site.
 */
export function buildDocMetadata(page: PageData): Metadata {
  const description = page.description ?? '';
  const canonical = `${siteConfig.url}${page.url}`;
  const ogTitle = `${page.title} | ${siteConfig.name} Documentation`;

  return {
    title: page.title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: 'article',
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: 'summary',
      images: [siteConfig.ogImage.url],
      title: ogTitle,
      description,
    },
  };
}
