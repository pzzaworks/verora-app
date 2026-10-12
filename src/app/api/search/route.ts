import { NextResponse } from 'next/server';
import { source } from '@/lib/source';

/** Search index consumed by the docs search dialog. */
export async function GET() {
  const index = await source.getSearchIndex();
  return NextResponse.json(index, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
