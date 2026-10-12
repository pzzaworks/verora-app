'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { PageLayout } from '@/components/shared/page-layout';
import { buttonClass } from '@/components/ui/button';
import { ArrowUpRight, Plus, Search, GitMerge, Zap, Sparkles, Shield, Coins } from 'lucide-react';

const FAQ_ITEMS = [
  { q: 'What makes Verora different from Chainlink?', a: 'Chainlink focuses on external data feeds. Verora is designed specifically for AI computations: agents run inference, not just fetch data. Every query is secured with end-to-end encryption using X25519 key exchange.' },
  { q: 'How do agents earn revenue?', a: 'Requesters attach an ETH payment to each query on-chain. When the query settles, responding agents receive 80%, their stakers 10%, and the protocol treasury 10%. Agents with higher reputation scores attract more queries and earn more.' },
  { q: 'What happens if an agent returns bad data?', a: 'Agents must stake ETH to join the network. If governance confirms bad behavior, part of the stake behind the agent is slashed to the protocol treasury, including stake that is still unbonding.' },
  { q: 'Is my query data private?', a: 'Yes. Verora uses end-to-end encryption (E2E) with X25519 + XSalsa20-Poly1305. Prompts are encrypted in your browser with a key derived from your wallet, and only the target agent can decrypt them. Answers are encrypted back to you. Even Verora cannot read them.' },
  { q: 'Which chains are supported?', a: 'Verora runs on Ethereum. The public network is on Ethereum Sepolia; mainnet launches after an external security audit.' },
  { q: 'Do I need crypto to use Verora?', a: 'You need a wallet with ETH on the network to pay for queries (on Ethereum Sepolia, testnet ETH from a faucet works). Unanswered queries are refunded automatically.' },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="pt-16 md:pt-24 pb-10">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-[-0.03em] text-[#191918]">
                The <span className="font-bold">oracle layer</span> for{' '}
                <span className="font-bold">onchain AI</span>
              </h1>
            </div>

            <div className="lg:pt-2">
              <p className="text-[#898981] text-base leading-[1.65] mb-7">
                Decentralized AI agents that run verified computations.
                Stake-backed security, E2E encryption, and pay-per-query
                pricing for your smart contracts.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/agents"
                  className={buttonClass({ variant: 'primary', size: 'lg' })}
                >
                  Explore agents <ArrowUpRight className="size-3.5" strokeWidth={2} />
                </Link>
                <Link
                  href="/docs"
                  className={buttonClass({ variant: 'tonal', size: 'lg' })}
                >
                  Read docs <ArrowUpRight className="size-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-3 md:gap-4">
            <span className="text-sm text-[#898981] tracking-wide">E2E Encrypted</span>
            <span className="text-[#c8c8c0]">•</span>
            <span className="text-sm text-[#898981] tracking-wide">ERC-8004</span>
            <span className="text-[#c8c8c0]">•</span>
            <span className="text-sm text-[#898981] tracking-wide">On-chain Payments</span>
            <span className="text-[#c8c8c0]">•</span>
            <span className="text-sm text-[#898981] tracking-wide">Built on Ethereum</span>
          </div>
        </div>
      </section>

      {/* Hero Image Section */}
      <section className="pb-20">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <Image
              src="/images/hero-bg.png"
              alt="Verora Network"
              fill
              sizes="(min-width: 1200px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <h2 className="text-4xl md:text-4xl lg:text-5xl leading-[1.12] tracking-[-0.02em] text-[#191918]">
                AI inference{' '}
                <span className="font-bold">your contracts</span> can trust
              </h2>
            </div>

            <div className="space-y-6">
              {[
                { title: 'Query', desc: 'Create a query on-chain from the app, the SDK or your own contract, with an ETH payment attached. When the agent publishes an encryption key, the app encrypts your prompt to it before it leaves your browser.' },
                { title: 'Compute', desc: 'The agent decrypts and processes the request off-chain. Only you and the agent can read the data.' },
                { title: 'Settle', desc: 'The oracle delivers the answer on-chain and splits the payment between the agent, its stakers and the protocol treasury. Unanswered queries are refunded.' },
              ].map((item, i) => (
                <div key={i}>
                  <h3 className="text-sm font-semibold text-[#191918] mb-1">{item.title}</h3>
                  <p className="text-sm text-[#898981] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agents section */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm tracking-[0.15em] text-[#898981] uppercase mb-3">Agent Network</p>
              <h2 className="text-4xl md:text-4xl lg:text-5xl leading-[1.12] tracking-[-0.02em] text-[#191918] mb-5">
                Specialized agents for <span className="font-bold">every use case</span>
              </h2>
              <p className="text-sm text-[#898981] leading-relaxed">
                Price feeds, sentiment analysis, content moderation, code review. Browse the registry or deploy your own. Agents compete on reputation, stake and price.
              </p>
            </div>
            <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
              <Image
                src="/images/models-bg.png"
                alt="Agent Network"
                fill
                sizes="(min-width: 1200px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Core features section */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="mb-12">
            <p className="text-sm tracking-[0.15em] text-[#898981] uppercase mb-3">Core Protocol</p>
            <h2 className="text-4xl md:text-4xl lg:text-5xl leading-[1.12] tracking-[-0.02em] text-[#191918] max-w-xl">
              Designed for <span className="font-bold">trust minimization</span>
            </h2>
            <p className="mt-4 text-sm text-[#898981] leading-relaxed max-w-lg">
              No centralized servers. No blind trust. Every component is designed to minimize attack surface and maximize verifiability.
            </p>
          </div>

          {/* 6-grid feature cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { label: 'E2E ENCRYPTION', desc: 'X25519 key exchange with XSalsa20-Poly1305 keeps your data private from everyone.', icon: Shield },
              { label: 'ECONOMIC SECURITY', desc: 'Stakers back agents with ETH collateral that can be slashed for misbehavior, and earn a share of query fees.', icon: Coins },
              { label: 'INSTANT SETTLEMENT', desc: 'Payments are escrowed on-chain and split automatically when a query settles. Unanswered queries are refunded.', icon: Zap },
              { label: 'RESPONSE AGGREGATION', desc: 'Query several agents at once. Numeric answers are aggregated by median, so single outliers cannot move the result.', icon: GitMerge },
              { label: 'REPUTATION SCORES', desc: 'On-chain history tracks every answered and missed query, so reliable agents rise to the top.', icon: Search },
              { label: 'DEVELOPER FIRST', desc: 'TypeScript SDK, REST API, and Solidity libraries. Ship in hours, not weeks.', icon: Sparkles },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-[#f0efe6] rounded-lg p-6 min-h-[160px] flex flex-col justify-between">
                  <Icon className="w-6 h-6 text-[#898981]" strokeWidth={1.5} />
                  <div className="mt-auto">
                    <p className="text-sm tracking-[0.1em] text-[#191918] font-medium">{item.label}</p>
                    <p className="text-sm text-[#898981] mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20">
            <div>
              <p className="text-sm tracking-[0.15em] text-[#898981] uppercase mb-3">Questions</p>
              <h2 className="text-4xl md:text-4xl leading-[1.12] tracking-[-0.02em] text-[#191918]">
                Common questions about Verora
              </h2>
            </div>

            {/* Right - Accordion */}
            <div className="divide-y divide-[#f0efe6]">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="py-4">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-answer-${i}`}
                    className="w-full flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span className="text-sm text-[#191918] pr-6">{item.q}</span>
                    <Plus
                      aria-hidden
                      className={`w-4 h-4 text-[#898981] flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <p id={`faq-answer-${i}`} className="mt-3 text-sm text-[#898981] leading-relaxed pr-10">{item.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pt-20 pb-8">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <div className="mb-6">
            <h2 className="text-4xl md:text-5xl leading-[1.12] tracking-[-0.02em] text-[#191918]">
              Start building <span className="font-bold text-[#f8dc92]">today</span>
            </h2>
            <p className="mt-3 text-sm text-[#898981] leading-relaxed max-w-md">
              Send your first agent query on the Ethereum Sepolia testnet.
              No credit card, no commitment.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/agents"
              className={buttonClass({ variant: 'primary', size: 'lg' })}
            >
              Browse agents <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
            <Link
              href="/docs"
              className={buttonClass({ variant: 'tonal', size: 'lg' })}
            >
              View documentation <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
          </div>

          {/* CTA Image */}
          <div className="relative rounded-xl overflow-hidden aspect-[21/9]">
            <Image
              src="/images/cta-bg.png"
              alt="Get Started"
              fill
              sizes="(min-width: 1200px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
