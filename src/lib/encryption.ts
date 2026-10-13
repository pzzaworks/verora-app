import nacl from 'tweetnacl';
import { hexToBytes, sha256, toHex, type Hex } from 'viem';

/**
 * End-to-end encryption for queries (X25519 + XSalsa20-Poly1305), wire-compatible with verora-sdk:
 * - encrypted query:    UTF-8 JSON { ciphertext, nonce, ephemeralPublicKey, replyPublicKey }
 * - encrypted response: UTF-8 JSON { ciphertext, nonce, ephemeralPublicKey }
 * The requester key pair is derived from a wallet signature, so nothing secret is ever stored and
 * answers stay readable after a reload.
 */
export const ENCRYPTION_KEY_MESSAGE =
  'Verora encryption key v1\n\nSign to unlock end-to-end encrypted queries. This does not send a transaction or cost gas.';

export interface EncryptionKeyPair {
  publicKey: string;
  secretKey: Uint8Array;
}

interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function isValidPublicKey(publicKey: string): boolean {
  try {
    return fromBase64(publicKey).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

export function keyPairFromSignature(signature: Hex): EncryptionKeyPair {
  const keyPair = nacl.box.keyPair.fromSecretKey(hexToBytes(sha256(signature)));
  return { publicKey: toBase64(keyPair.publicKey), secretKey: keyPair.secretKey };
}

/** Encrypts a prompt for an agent; the result is the `queryData` of an `encrypted` query */
export function encryptQuery(prompt: string, agentPublicKey: string, replyPublicKey: string): Hex {
  if (!isValidPublicKey(agentPublicKey)) throw new Error('This agent has no valid encryption key');
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(new TextEncoder().encode(prompt), nonce, fromBase64(agentPublicKey), ephemeral.secretKey);
  const payload = {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
    ephemeralPublicKey: toBase64(ephemeral.publicKey),
    replyPublicKey,
  };
  return toHex(new TextEncoder().encode(JSON.stringify(payload)));
}

/** Decrypts an agent response with the requester key; throws if it isn't for this key */
export function decryptResponse(responseData: Hex, secretKey: Uint8Array): string {
  const message = JSON.parse(new TextDecoder().decode(hexToBytes(responseData))) as EncryptedMessage;
  const plaintext = nacl.box.open(
    fromBase64(message.ciphertext),
    fromBase64(message.nonce),
    fromBase64(message.ephemeralPublicKey),
    secretKey,
  );
  if (!plaintext) throw new Error('This response was not encrypted for your wallet');
  return new TextDecoder().decode(plaintext);
}

export function decodeText(data: Hex): string {
  return new TextDecoder().decode(hexToBytes(data));
}

export function encodeText(text: string): Hex {
  return toHex(new TextEncoder().encode(text));
}

/** Random key pair for a new agent; the operator configures the secret key on the agent server */
export function generateAgentKeyPair(): { publicKey: string; secretKey: string } {
  const keyPair = nacl.box.keyPair();
  return { publicKey: toBase64(keyPair.publicKey), secretKey: toBase64(keyPair.secretKey) };
}

/**
 * Readable text of an agent answer. Plaintext answers are decoded; encrypted ones are decrypted with
 * the requester key when it is unlocked, otherwise a short explanation is returned in their place.
 */
export function readAnswer(responseData: Hex, encrypted: boolean, keyPair: EncryptionKeyPair | null): string {
  if (!encrypted) return decodeText(responseData);
  if (!keyPair) return 'Unlock your encryption key to read this answer.';
  try {
    return decryptResponse(responseData, keyPair.secretKey);
  } catch {
    return 'This answer is not encrypted for the connected wallet.';
  }
}
