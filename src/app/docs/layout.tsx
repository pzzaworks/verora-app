import type { ReactNode } from 'react';
import { DocsLayout } from 'pzzadocs/ui';
import config from '@/docs.config';
import { source } from '@/lib/source';

// The docs section has its own header and sidebar from the framework, so the
// site PageLayout header and footer are intentionally not rendered here.
export default async function DocsSectionLayout({ children }: { children: ReactNode }) {
  const tree = await source.getPageTree();

  return (
    <DocsLayout tree={tree} config={config}>
      {children}
    </DocsLayout>
  );
}
