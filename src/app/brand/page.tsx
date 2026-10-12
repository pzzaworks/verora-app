'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PageLayout } from '@/components/shared/page-layout';
import { buttonClass } from '@/components/ui/button';
import { Check, Copy, Download } from 'lucide-react';

function ColorCard({ name, hex, textColor = 'text-white' }: { name: string; hex: string; textColor?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer group"
      onClick={handleCopy}
    >
      <div
        className="h-32 flex items-end p-4 relative"
        style={{ backgroundColor: hex }}
      >
        <div className={`${textColor} flex items-center justify-between w-full`}>
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-sm opacity-80 font-mono">{hex}</p>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoDownload({ variant, bg, src }: { variant: string; bg: string; src: string }) {
  return (
    <div className={`${bg} rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px]`}>
      <Image src={src} alt={`Verora Logo ${variant}`} width={256} height={64} unoptimized className="h-16 w-auto mb-6" />
      <div className="flex gap-2">
        <a
          href={src}
          download={`verora-logo-${variant.toLowerCase()}.svg`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Download className="w-3 h-3" /> SVG
        </a>
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <PageLayout>
      <div className="py-6 md:py-8">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          {/* Header */}
          <div className="mb-16">
            <p className="text-sm tracking-[0.15em] text-[#898981] uppercase mb-3">Brand</p>
            <h1 className="text-4xl md:text-5xl leading-[1.12] tracking-[-0.02em] text-[#191918] mb-4">
              Brand Kit
            </h1>
            <p className="text-sm text-[#898981] max-w-xl leading-relaxed">
              Official brand assets for Verora. Use these guidelines to maintain consistency
              when representing our brand.
            </p>
          </div>

          {/* Logo Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-semibold text-[#191918] mb-2">Logo</h2>
            <p className="text-sm text-[#898981] mb-8 max-w-lg">
              The Verora logo consists of an abstract &quot;V&quot; mark that represents verification and trust.
              Always maintain clear space around the logo.
            </p>

            <h3 className="text-sm font-medium text-[#191918] mb-4">Logo Mark</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <LogoDownload variant="Dark" bg="bg-[#fffef2] border border-[#e5e4db]" src="/logo.svg" />
              <LogoDownload variant="Light" bg="bg-[#191918] text-white" src="/logo-white.svg" />
            </div>

            <h3 className="text-sm font-medium text-[#191918] mb-4">Full Logo</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <LogoDownload variant="Full Dark" bg="bg-[#fffef2] border border-[#e5e4db]" src="/logo-full.svg" />
              <LogoDownload variant="Full Light" bg="bg-[#191918] text-white" src="/logo-full-white.svg" />
            </div>

            <div className="bg-[#f0efe6] rounded-xl p-6">
              <h3 className="text-base font-medium text-[#191918] mb-3">Usage Guidelines</h3>
              <ul className="space-y-2 text-sm text-[#898981]">
                <li>• Maintain minimum clear space equal to the height of the &quot;V&quot; mark</li>
                <li>• Do not stretch, rotate, or distort the logo</li>
                <li>• Do not add effects like shadows or gradients</li>
                <li>• Use dark logo on light backgrounds, light logo on dark backgrounds</li>
                <li>• Minimum size: 24px height for digital, 10mm for print</li>
              </ul>
            </div>
          </section>

          {/* Colors Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-semibold text-[#191918] mb-2">Colors</h2>
            <p className="text-sm text-[#898981] mb-8 max-w-lg">
              Our color palette is warm and approachable, with cream backgrounds and amber accents
              that convey trust and innovation.
            </p>

            <h3 className="text-sm font-medium text-[#191918] mb-4">Primary Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <ColorCard name="Cream" hex="#fffef2" textColor="text-[#191918]" />
              <ColorCard name="Amber" hex="#f8dc92" textColor="text-[#191918]" />
              <ColorCard name="Charcoal" hex="#191918" textColor="text-white" />
              <ColorCard name="Gray" hex="#898981" textColor="text-white" />
            </div>

            <h3 className="text-sm font-medium text-[#191918] mb-4">Secondary Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <ColorCard name="Light Gray" hex="#f0efe6" textColor="text-[#191918]" />
              <ColorCard name="Border" hex="#e5e4db" textColor="text-[#191918]" />
              <ColorCard name="Muted" hex="#c8c8c0" textColor="text-[#191918]" />
              <ColorCard name="Amber Hover" hex="#e5c97f" textColor="text-[#191918]" />
            </div>

            <div className="bg-[#f0efe6] rounded-xl p-6">
              <h3 className="text-base font-medium text-[#191918] mb-3">Color Usage</h3>
              <ul className="space-y-2 text-sm text-[#898981]">
                <li>• <strong className="text-[#191918]">Cream (#fffef2)</strong>: Primary background color</li>
                <li>• <strong className="text-[#191918]">Amber (#f8dc92)</strong>: CTAs, highlights, and accents</li>
                <li>• <strong className="text-[#191918]">Charcoal (#191918)</strong>: Primary text and dark elements</li>
                <li>• <strong className="text-[#191918]">Gray (#898981)</strong>: Secondary text and descriptions</li>
              </ul>
            </div>
          </section>

          {/* Typography Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-semibold text-[#191918] mb-2">Typography</h2>
            <p className="text-sm text-[#898981] mb-8 max-w-lg">
              We use Syne for headings and UI elements, providing a modern and distinctive look.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#fffef2] border border-[#e5e4db] rounded-xl p-6">
                <p className="text-sm text-[#898981] uppercase tracking-wider mb-4">Primary Font</p>
                <p className="text-5xl font-semibold text-[#191918] leading-none mb-4">Syne</p>
                <p className="text-sm text-[#898981] mb-4">
                  Used for headings, navigation, buttons, and UI elements.
                </p>
                <div className="space-y-2 text-[#191918]">
                  <p className="text-sm font-normal">Regular 400</p>
                  <p className="text-sm font-medium">Medium 500</p>
                  <p className="text-sm font-semibold">Semibold 600</p>
                  <p className="text-sm font-bold">Bold 700</p>
                </div>
              </div>

              <div className="bg-[#fffef2] border border-[#e5e4db] rounded-xl p-6">
                <p className="text-sm text-[#898981] uppercase tracking-wider mb-4">Code Font</p>
                <p className="text-5xl font-semibold text-[#191918] leading-none mb-4 font-mono">Mono</p>
                <p className="text-sm text-[#898981] mb-4">
                  Used for code snippets, technical content, and data.
                </p>
                <div className="space-y-2 text-[#191918] font-mono">
                  <p className="text-sm">const client = createVeroraClient();</p>
                  <p className="text-sm">0x1234...5678</p>
                  <p className="text-sm">npm install @verora/sdk</p>
                </div>
              </div>
            </div>

            <div className="bg-[#f0efe6] rounded-xl p-6">
              <h3 className="text-base font-medium text-[#191918] mb-3">Type Scale</h3>
              <div className="space-y-4">
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-[#898981] w-20">48px</span>
                  <span className="text-5xl font-semibold text-[#191918] leading-none">Heading 1</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-[#898981] w-20">36px</span>
                  <span className="text-4xl font-semibold text-[#191918] leading-none">Heading 2</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-[#898981] w-20">24px</span>
                  <span className="text-2xl font-semibold text-[#191918] leading-none">Heading 3</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-[#898981] w-20">15px</span>
                  <span className="text-sm text-[#191918]">Body text for paragraphs and descriptions</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-[#898981] w-20">13px</span>
                  <span className="text-sm text-[#191918]">Small text, buttons, and labels</span>
                </div>
              </div>
            </div>
          </section>

          {/* Spacing Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-semibold text-[#191918] mb-2">Spacing & Layout</h2>
            <p className="text-sm text-[#898981] mb-8 max-w-lg">
              Consistent spacing creates visual harmony. We use a 4px base grid.
            </p>

            <div className="grid grid-cols-4 md:grid-cols-8 gap-4 mb-8">
              {[4, 8, 12, 16, 20, 24, 32, 40].map((size) => (
                <div key={size} className="text-center">
                  <div
                    className="bg-[#f8dc92] rounded mx-auto mb-2"
                    style={{ width: size, height: size }}
                  />
                  <p className="text-sm text-[#898981] font-mono">{size}px</p>
                </div>
              ))}
            </div>

            <div className="bg-[#f0efe6] rounded-xl p-6">
              <h3 className="text-base font-medium text-[#191918] mb-3">Border Radius</h3>
              <div className="flex flex-wrap gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#191918] rounded-md mb-2" />
                  <p className="text-sm text-[#898981]">6px - Small</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#191918] rounded-lg mb-2" />
                  <p className="text-sm text-[#898981]">8px - Default</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#191918] rounded-xl mb-2" />
                  <p className="text-sm text-[#898981]">12px - Large</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#191918] rounded-full mb-2" />
                  <p className="text-sm text-[#898981]">Full - Circle</p>
                </div>
              </div>
            </div>
          </section>

          {/* Download Section */}
          <section className="bg-[#191918] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-2xl font-semibold text-white mb-3">Download Brand Assets</h2>
            <p className="text-sm text-white/70 mb-6 max-w-md mx-auto">
              Get all brand assets in one package including logos in various formats.
            </p>
            <a
              href="/verora-brand-kit.zip"
              download="verora-brand-kit.zip"
              className={buttonClass({ variant: 'primary', size: 'lg' })}
            >
              <Download className="size-3.5" aria-hidden />
              Download brand kit
            </a>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
