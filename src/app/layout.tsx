import type { Metadata } from 'next';
import { Syne, Playfair_Display } from 'next/font/google';
import { RootProvider } from 'pzzadocs/ui';

import './globals.css';
import 'pzzadocs/styles.css';
import { Providers } from './providers';
import { siteConfig } from '@/config/site';
import config from '@/docs.config';

const syne = Syne({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const playfair = Playfair_Display({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: 'summary',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage.url],
  },
  authors: [{ name: "Berke (pzzaworks)", url: "https://pzza.works" }],
  creator: "Berke (pzzaworks)",
  publisher: "Berke (pzzaworks)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${syne.variable} ${playfair.variable} font-sans antialiased`}>
        <RootProvider theme={config.theme} search={config.search}>
          <Providers>{children}</Providers>
        </RootProvider>
      </body>
    </html>
  );
}
