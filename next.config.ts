import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

function origin(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL);
const rpcOrigin = origin(process.env.NEXT_PUBLIC_RPC_URL);

/**
 * Content Security Policy. Network access is limited to the app, the Verora API, and the configured RPC
 * (plus https for wallets and chain public RPCs). Next.js needs inline scripts for hydration; the dev
 * server additionally needs eval and websocket HMR.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Images only from the app and the API (which hosts agent icons and banners); other agent image hosts fall back to a monogram
  `img-src 'self' data: blob:${apiOrigin ? ` ${apiOrigin}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${apiOrigin ? ` ${apiOrigin}` : ''}${rpcOrigin ? ` ${rpcOrigin}` : ''}${isDev ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  // shiki loads grammars dynamically; keep it out of the server bundle.
  serverExternalPackages: ['shiki'],
  // The docs content is read at request time, so make the tracing explicit
  // for the standalone output.
  outputFileTracingIncludes: {
    '/docs/[[...slug]]': ['./content/docs/**/*'],
    '/llms.mdx/[[...slug]]': ['./content/docs/**/*'],
    '/api/search': ['./content/docs/**/*'],
    '/sitemap.xml': ['./content/docs/**/*'],
  },
  async redirects() {
    return [
      { source: '/legal/terms', destination: 'https://pzza.works/terms-conditions', permanent: true },
      { source: '/legal/:page(privacy|cookies)', destination: 'https://pzza.works/privacy-policy', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/docs.mdx', destination: '/llms.mdx' },
      { source: '/docs/:path*.mdx', destination: '/llms.mdx/:path*' },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
