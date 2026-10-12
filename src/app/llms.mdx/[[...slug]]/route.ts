import { source } from '@/lib/source';

export const revalidate = false;

interface RouteContext {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const pages = await source.getPages();
  return pages.map((page) => ({ slug: page.slug }));
}

/** Raw Markdown for one page. Reached through the `/docs/<slug>.mdx` rewrite in next.config.ts. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { slug = [] } = await context.params;
  const markdown = await source.getMarkdown(slug);

  if (!markdown) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
