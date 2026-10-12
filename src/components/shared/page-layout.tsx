'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { siteConfig } from '@/config/site';
import { targetChain } from '@/config/wagmi';
import { useIsClient } from '@/hooks/use-is-client';
import { Menu, X, ChevronDown, Copy, Check, LogOut, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Header wallet controls sit on the shared 32px button scale
const networkWarning = 'border-amber-300 bg-amber-100 text-amber-900 hover:border-amber-300 hover:bg-amber-200';
const walletButton = 'border-[#e5e4db] hover:border-[#c8c8c0] hover:bg-[#f0efe6]';

const navItems = [
  { href: '/docs', label: 'DOCS' },
  { href: '/agents', label: 'AGENTS' },
  { href: '/dashboard', label: 'DASHBOARD' },
];

export function PageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const expectedChainId = targetChain.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const mounted = useIsClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const isWrongNetwork = mounted && isConnected && chainId !== expectedChainId;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Auto-trigger network switch when on wrong network
  useEffect(() => {
    if (isWrongNetwork) {
      switchChain({ chainId: expectedChainId });
    }
  }, [isWrongNetwork, switchChain, expectedChainId]);

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === 'injected');
    if (injected) connect({ connector: injected });
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setMobileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Desktop wallet button content
  const renderDesktopWallet = () => {
    if (!mounted) return null;

    if (!isConnected) {
      return (
        <button
          onClick={handleConnect}
          className={buttonClass()}
        >
          Connect wallet
        </button>
      );
    }

    if (isWrongNetwork) {
      return (
        <button
          onClick={() => switchChain({ chainId: expectedChainId })}
          className={buttonClass({ variant: 'secondary', className: networkWarning })}
        >
          <AlertTriangle className="size-3.5" />
          Switch network
        </button>
      );
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-label={`Wallet ${address ?? ''}`}
          className={buttonClass({ variant: 'tonal', className: walletButton })}
        >
          <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#898981] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#e5e4db] rounded-lg overflow-hidden p-1">
            <div className="px-2.5 pt-2 pb-2.5 border-b border-[#f0efe6]">
              <p className="text-[11px] text-[#898981] uppercase tracking-[0.06em] mb-0.5">Connected</p>
              <p className="text-xs font-mono text-[#191918] truncate" title={address}>{address}</p>
            </div>
            <div className="pt-1">
              <button
                onClick={handleCopyAddress}
                className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-[#191918] hover:bg-[#f6f5e9] transition-colors cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-[#3d8b3e]" /> : <Copy className="size-3.5 text-[#898981]" />}
                {copied ? 'Copied!' : 'Copy address'}
              </button>
            </div>
            <div className="border-t border-[#f0efe6] mt-1 pt-1">
              <button
                onClick={() => { disconnect(); setDropdownOpen(false); }}
                className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-[#9a2f1a] hover:bg-[#fbe7e2] transition-colors cursor-pointer"
              >
                <LogOut className="size-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile wallet button content
  const renderMobileWallet = () => {
    if (!mounted) return null;

    if (!isConnected) {
      return (
        <button
          onClick={() => { handleConnect(); setMenuOpen(false); }}
          className={buttonClass({ className: 'mt-4' })}
        >
          Connect wallet
        </button>
      );
    }

    if (isWrongNetwork) {
      return (
        <button
          onClick={() => switchChain({ chainId: expectedChainId })}
          className={buttonClass({ variant: 'secondary', className: cn(networkWarning, 'mt-4') })}
        >
          <AlertTriangle className="size-3.5" />
          Switch network
        </button>
      );
    }

    return (
      <div className="mt-4 relative" ref={mobileDropdownRef} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
          aria-expanded={mobileDropdownOpen}
          aria-label={`Wallet ${address ?? ''}`}
          className={buttonClass({ variant: 'tonal', className: walletButton })}
        >
          <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#898981] transition-transform ${mobileDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {mobileDropdownOpen && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 bg-white border border-[#e5e4db] rounded-lg overflow-hidden p-1 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 pt-2 pb-2.5 border-b border-[#f0efe6]">
              <p className="text-[11px] text-[#898981] uppercase tracking-[0.06em] mb-0.5">Connected</p>
              <p className="text-xs font-mono text-[#191918] truncate" title={address}>{address}</p>
            </div>
            <div className="pt-1">
              <button
                onClick={handleCopyAddress}
                className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-[#191918] hover:bg-[#f6f5e9] transition-colors cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-[#3d8b3e]" /> : <Copy className="size-3.5 text-[#898981]" />}
                {copied ? 'Copied!' : 'Copy address'}
              </button>
            </div>
            <div className="border-t border-[#f0efe6] mt-1 pt-1">
              <button
                onClick={() => { disconnect(); setMenuOpen(false); setMobileDropdownOpen(false); }}
                className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-[#9a2f1a] hover:bg-[#fbe7e2] transition-colors cursor-pointer"
              >
                <LogOut className="size-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fffef2]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#fffef2]">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10 h-[60px] flex items-center justify-between relative">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.svg" alt="" width={112} height={28} unoptimized priority className="h-7 w-auto" />
            <span className="text-[#191918] text-base font-semibold tracking-tight">Verora</span>
          </Link>

          <div className="hidden lg:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`text-sm tracking-[0.02em] transition-colors py-2 ${
                  isActive(item.href)
                    ? 'text-[#191918]'
                    : 'text-[#6a6a65] hover:text-[#191918]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {renderDesktopWallet()}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="lg:hidden p-2 text-[#191918]"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#fffef2] pt-[60px] lg:hidden"
          onClick={() => setMobileDropdownOpen(false)}
        >
          <div className="flex flex-col items-center justify-center h-full gap-6 -mt-16">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className="text-[#191918] text-lg tracking-wide"
              >
                {item.label}
              </Link>
            ))}
            {renderMobileWallet()}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-[60px]">{children}</main>

      {/* Footer */}
      <footer className="py-10 bg-[#fffef2]">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-[#f0efe6]">
            <div className="flex items-center gap-1.5">
              <Image src="/logo.svg" alt="" width={96} height={24} unoptimized className="h-6 w-auto" />
              <span className="text-[#191918] text-sm font-semibold">Verora</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-[#6a6a65]">
              <Link href="/docs" className="hover:text-[#191918] transition-colors">DOCS</Link>
              <Link href="/agents" className="hover:text-[#191918] transition-colors">AGENTS</Link>
              <Link href="/dashboard" className="hover:text-[#191918] transition-colors">DASHBOARD</Link>
              <a href={siteConfig.links.github} className="hover:text-[#191918] transition-colors">GITHUB</a>
            </div>
          </div>
          <div className="pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <p className="text-sm text-[#6a6a65]">
              Copyright &copy; {new Date().getFullYear()} Verora
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6a6a65]">
              <a href={siteConfig.links.terms} className="hover:text-[#191918] transition-colors">Terms of Use</a>
              <a href={siteConfig.links.privacy} className="hover:text-[#191918] transition-colors">Privacy Policy</a>
              <Link href="/brand" className="hover:text-[#191918] transition-colors">Brand</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
