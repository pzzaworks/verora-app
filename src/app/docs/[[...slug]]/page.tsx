import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'pzzadocs/ui';
import config from '@/docs.config';
import { buildDocMetadata } from '@/lib/doc-metadata';
import { source } from '@/lib/source';

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const pages = await source.getPages();
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const page = await source.getPage(slug);

  if (!page) {
    return {};
  }

  return buildDocMetadata(page);
}

export default async function Page({ params }: DocsPageProps) {
  const { slug = [] } = await params;
  const page = await source.getPage(slug);

  if (!page) {
    notFound();
  }

  const [tree, neighbours] = await Promise.all([source.getPageTree(), source.getNeighbours(slug)]);

  return (
    <DocsPage
      toc={page.toc}
      tree={tree}
      url={page.url}
      neighbours={neighbours}
      full={page.full}
      lastModified={page.lastModified}
      editUrl={config.editUrl?.(page)}
      markdownUrl={config.llm.enabled ? config.llm.markdownPath(page.url) : undefined}
      siteUrl={config.siteUrl}
    >
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>{page.content}</DocsBody>
    </DocsPage>
  );
}
