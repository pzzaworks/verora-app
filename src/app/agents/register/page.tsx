'use client';

import Image from 'next/image';
import { useIsClient } from '@/hooks/use-is-client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect, useWriteContract, usePublicClient } from 'wagmi';
import { type Hex } from 'viem';
import toast from 'react-hot-toast';
import { PageLayout } from '@/components/shared/page-layout';
import { Button } from '@/components/ui/button';
import { Wallet, Check, Camera, X, Link as LinkIcon } from 'lucide-react';
import { AGENT_REGISTRY_ABI, CONTRACT_ADDRESSES } from '@/config/contracts';
import { targetChain } from '@/config/wagmi';
import { generateAgentKeyPair } from '@/lib/encryption';
import { useApiSession } from '@/hooks/use-session';
import { useIsWrongNetwork } from '@/hooks/use-network';
import { api } from '@/lib/api';

const MAX_ICON_SIZE = 256 * 1024;
const MAX_BANNER_SIZE = 512 * 1024;
// The API only hosts raster images (no SVG), verified by magic bytes server-side
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
// AgentRegistry limits (MAX_ENDPOINT_LENGTH, MAX_CAPABILITIES, MAX_CAPABILITY_LENGTH)
const MAX_ENDPOINT_LENGTH = 512;
const MAX_CAPABILITIES = 32;
const MAX_CAPABILITY_LENGTH = 64;
// API metadata limit for the optional website (https only)
const MAX_WEBSITE_LENGTH = 256;

export default function RegisterAgentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const wrongNetwork = useIsWrongNetwork();
  const publicClient = usePublicClient();
  const { signIn } = useApiSession();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [website, setWebsite] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [encryptionSecretKey, setEncryptionSecretKey] = useState<string | null>(null);
  const mounted = useIsClient();

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === 'injected');
    if (injected) connect({ connector: injected });
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const max = type === 'icon' ? MAX_ICON_SIZE : MAX_BANNER_SIZE;
    if (file.size > max) { setError(`Max ${max / 1024}KB`); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setError('Use a PNG, JPEG, GIF, or WebP image'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'icon') setIcon(reader.result as string);
      else setBanner(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!address || !name || !description || !endpoint) return;
    setLoading(true);
    setError(null);

    try {
      // The agent key pair is generated locally; only the public key is published. The operator
      // configures the secret key on the agent server so it can read encrypted queries.
      const encryptionKeys = generateAgentKeyPair();

      // Metadata (with images) is hosted by the API and referenced on-chain by a short URI
      const token = await signIn();
      const { uri: metadataURI } = await api.uploadMetadata(token, {
        name,
        description,
        publicKey: encryptionKeys.publicKey,
        ...(websiteUrl ? { website: websiteUrl } : {}),
        ...(icon ? { icon } : {}),
        ...(banner ? { banner } : {}),
      });

      // No TEE attestation is submitted from the browser
      const attestation = '0x' as Hex;

      // Send on-chain transaction
      const hash = await writeContractAsync({
        chainId: targetChain.id,
        address: CONTRACT_ADDRESSES.agentRegistry,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [endpoint, capList, attestation, metadataURI],
      });

      setTxHash(hash);
      setEncryptionSecretKey(encryptionKeys.secretKey);
      toast.success('Transaction submitted! Waiting for confirmation...');

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        if (receipt.status !== 'success') throw new Error('Registration transaction reverted');
      }

      setSuccess(true);
      toast.success('Agent registered on-chain!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const capList = capabilities.split(',').map(c => c.trim()).filter(c => c.length > 0);
  // Mirrors the AgentRegistry limits so an invalid registration fails here instead of reverting on-chain
  const capabilitiesValid = capList.length <= MAX_CAPABILITIES && capList.every(c => c.length <= MAX_CAPABILITY_LENGTH);
  const endpointValid = /^https?:\/\/\S+$/i.test(endpoint) && endpoint.length <= MAX_ENDPOINT_LENGTH;
  const websiteUrl = website.trim();
  // The API only accepts https websites up to MAX_WEBSITE_LENGTH characters
  const websiteValid = websiteUrl === '' || (/^https:\/\/\S+$/i.test(websiteUrl) && websiteUrl.length <= MAX_WEBSITE_LENGTH);
  const isValid = name.trim().length >= 3 && description.trim().length >= 10 && endpointValid && capabilitiesValid && websiteValid;

  if (!mounted || !isConnected) {
    return (
      <PageLayout>
        <div className="py-6 md:py-8">
          <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
            <h1 className="text-2xl leading-[1.1] tracking-[-0.02em] text-[#191918] font-bold mb-6">Register Agent</h1>
            <div className="bg-white border border-[#e5e4db] rounded-xl py-16 text-center">
              <Wallet className="w-6 h-6 text-[#c8c8c0] mx-auto mb-3" strokeWidth={1.5} />
              <h2 className="text-base font-semibold text-[#191918] mb-1">Connect your wallet</h2>
              <p className="text-sm text-[#898981] mb-5">Connect to register an AI agent on-chain. You will need ETH on {targetChain.name} for gas.</p>
              <Button onClick={handleConnect}>Connect wallet</Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (success) {
    return (
      <PageLayout>
        <div className="py-6 md:py-8">
          <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
            <div className="bg-white border border-[#e5e4db] rounded-xl py-16 text-center">
              <Check className="w-6 h-6 text-emerald-600 mx-auto mb-3" />
              <h1 className="text-base font-semibold text-[#191918] mb-1">Agent Registered On-Chain!</h1>
              <p className="text-sm text-[#898981] mb-2">It is now listed in the agent registry and can receive paid queries.</p>
              {txHash && (
                <p className="text-sm text-[#6a6a65] font-mono">
                  tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>

            {/* Encryption Secret Key - must be saved by the operator */}
            {encryptionSecretKey && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-amber-900 mb-1">
                  Save Your Encryption Secret Key
                </h2>
                <p className="text-sm text-amber-800 mb-3">
                  Your agent needs this key to decrypt incoming queries. Configure it on your agent server and store it securely. It will not be shown again.
                </p>
                <div className="bg-white border border-amber-300 rounded-lg p-3 font-mono text-xs text-[#191918] break-all select-all">
                  {encryptionSecretKey}
                </div>
                <div className="flex gap-3 mt-3">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(encryptionSecretKey);
                      toast.success('Secret key copied to clipboard');
                    }}
                  >
                    Copy to clipboard
                  </Button>
                  <Button
                    onClick={() => router.push('/agents')}
                    variant="secondary"
                  >
                    Go to agents
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="py-6 md:py-8">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          <h1 className="text-2xl leading-[1.1] tracking-[-0.02em] text-[#191918] font-bold mb-2">Register Agent</h1>
          <p className="text-sm text-[#898981] mb-6">
            Registration is an on-chain transaction. Your agent will be permanently recorded on the blockchain.
          </p>

          {/* Profile Card */}
          <div className="bg-white border border-[#e5e4db] rounded-xl overflow-hidden mb-6">

            {/* Banner area */}
            <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => handleImage(e, 'banner')} />
            <div className="relative">
              <div
                role="button"
                tabIndex={0}
                aria-label={banner ? 'Change cover image' : 'Upload cover image'}
                className="relative h-40 md:h-48 bg-gradient-to-br from-[#f0efe6] to-[#e5e4db] cursor-pointer group"
                onClick={() => bannerInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bannerInputRef.current?.click(); } }}
              >
                {banner ? (
                  <>
                    <Image src={banner} alt="" fill unoptimized className="object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-lg text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-3.5 h-3.5" />
                        Change
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Camera className="w-6 h-6 text-[#898981] mb-2" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-[#898981]">Upload cover image</span>
                    <span className="text-sm text-[#6a6a65] mt-0.5">Optional. 1200 x 400, PNG, JPEG, GIF or WebP, max 512KB</span>
                  </div>
                )}
              </div>
              {banner && (
                <Button
                  onClick={() => setBanner(null)}
                  aria-label="Remove cover image"
                  variant="secondary"
                  size="sm"
                  icon
                  className="absolute top-3 right-3"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>

            {/* Icon + Name section */}
            <div className="px-6 pb-6">
              {/* Icon - overlapping banner */}
              <div className="flex items-end gap-4 -mt-10 mb-5">
                <input ref={iconInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => handleImage(e, 'icon')} />
                <div
                  aria-hidden
                  className="relative w-20 h-20 rounded-2xl border-4 border-white bg-[#f0efe6] cursor-pointer overflow-hidden shrink-0"
                  onClick={() => iconInputRef.current?.click()}
                >
                  {icon ? (
                    <Image src={icon} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Camera className="w-5 h-5 text-[#898981]" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="link" onClick={() => iconInputRef.current?.click()}>{icon ? 'Change icon' : 'Upload icon (optional, max 256KB)'}</Button>
                  {icon && <Button variant="link" onClick={() => setIcon(null)}>Remove</Button>}
                </div>
              </div>

              {/* Inline editable fields */}
              <div className="space-y-4">
                {/* Name */}
                <div className="group">
                  <div className="mb-1">
                    <label htmlFor="name" className="text-sm uppercase tracking-wider text-[#898981]">Agent Name</label>
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 100))}
                    placeholder="Your agent name"
                    maxLength={100}
                    className="w-full text-sm font-semibold text-[#191918] placeholder:text-[#d1d0c8] bg-[#fafaf8] border border-[#e5e4db] focus:border-[#c8c8c0] rounded-lg px-3 py-2.5 outline-none transition-colors"
                  />
                  <p className="mt-1 text-sm text-[#6a6a65]">At least 3 characters. Shown in the registry and on your agent page.</p>
                </div>

                {/* Description */}
                <div className="group">
                  <div className="mb-1">
                    <label htmlFor="description" className="text-sm uppercase tracking-wider text-[#898981]">Description</label>
                  </div>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    placeholder="Describe what your agent does..."
                    maxLength={500}
                    rows={2}
                    className="w-full text-sm text-[#191918] placeholder:text-[#d1d0c8] bg-[#fafaf8] border border-[#e5e4db] focus:border-[#c8c8c0] rounded-lg px-3 py-2.5 outline-none resize-none leading-relaxed transition-colors"
                  />
                  <p className="flex justify-between text-sm text-[#6a6a65]"><span>At least 10 characters. Say what the agent answers and how.</span><span>{description.length}/500</span></p>
                </div>

                {/* Endpoint */}
                <div className="group">
                  <div className="mb-1">
                    <label htmlFor="endpoint" className="text-sm uppercase tracking-wider text-[#898981]">Endpoint</label>
                  </div>
                  <input
                    id="endpoint"
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://your-agent.example.com/query"
                    className="w-full text-sm text-[#191918] font-mono placeholder:text-[#d1d0c8] bg-[#fafaf8] border border-[#e5e4db] focus:border-[#c8c8c0] rounded-lg px-3 py-2.5 outline-none transition-colors"
                  />
                  <p className="mt-1 text-sm text-[#6a6a65]">The oracle sends queries to this URL. Must start with http:// or https://.</p>
                </div>

                {/* Capabilities */}
                <div className="group">
                  <div className="mb-1">
                    <label htmlFor="capabilities" className="text-sm uppercase tracking-wider text-[#898981]">Capabilities</label>
                    <span className="text-sm text-[#6a6a65] ml-2">(optional, comma-separated)</span>
                  </div>
                  <input
                    id="capabilities"
                    type="text"
                    value={capabilities}
                    onChange={(e) => setCapabilities(e.target.value)}
                    placeholder="price-feed, nlp, defi-analytics"
                    className="w-full text-sm text-[#191918] font-mono placeholder:text-[#d1d0c8] bg-[#fafaf8] border border-[#e5e4db] focus:border-[#c8c8c0] rounded-lg px-3 py-2.5 outline-none transition-colors"
                  />
                  {!capabilitiesValid && (
                    <p className="mt-1 text-sm text-red-600">Use at most {MAX_CAPABILITIES} capabilities of up to {MAX_CAPABILITY_LENGTH} characters each.</p>
                  )}
                  {capabilities && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {capList.map((cap, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Website */}
                <div className="group">
                  <div className="mb-1">
                    <label htmlFor="website" className="text-sm uppercase tracking-wider text-[#898981]">Website</label>
                    <span className="text-sm text-[#6a6a65] ml-2">(optional)</span>
                  </div>
                  <input
                    id="website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://your-agent.example.com"
                    maxLength={MAX_WEBSITE_LENGTH}
                    aria-describedby="website-hint"
                    className="w-full text-sm text-[#191918] font-mono placeholder:text-[#d1d0c8] bg-[#fafaf8] border border-[#e5e4db] focus:border-[#c8c8c0] rounded-lg px-3 py-2.5 outline-none transition-colors"
                  />
                  <p id="website-hint" className={websiteValid ? 'mt-1 text-sm text-[#6a6a65]' : 'mt-1 text-sm text-red-600'}>
                    Shown on your agent page. Must start with https://.
                  </p>
                </div>

                {/* Owner - read only */}
                <div>
                  <div className="mb-1">
                    <span className="text-sm uppercase tracking-wider text-[#898981]">Owner</span>
                  </div>
                  <p className="text-sm text-[#898981] font-mono">{address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* On-chain info banner */}
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <LinkIcon className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              You will sign a message to publish your agent profile, then confirm one transaction to the AgentRegistry contract. Gas fees apply.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <Button
              isLoading={loading}
              disabled={!isValid || wrongNetwork}
              onClick={handleSubmit}
            >
              {loading ? 'Confirming transaction...' : 'Register agent on-chain'}
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
