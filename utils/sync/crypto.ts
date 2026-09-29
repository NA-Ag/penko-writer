/**
 * End-to-end encryption for synced data (WebCrypto only).
 *
 * - The sync passphrase is stretched with PBKDF2-SHA256 (600 000 iterations,
 *   random 16-byte salt stored next to the data) into a 256-bit AES-GCM key.
 *   The key is created non-extractable: page scripts can use it but can never
 *   read its bytes, and it is only ever kept on this device (IndexedDB).
 * - Every blob gets a fresh random 96-bit IV. The file name is bound as
 *   additional authenticated data, so the server can't swap blobs between
 *   files without decryption failing.
 * - Blob layout: "PK" 0x01 | IV (12 bytes) | ciphertext + 128-bit tag.
 */

export const PBKDF2_ITERATIONS = 600_000;
const MAGIC = [0x50, 0x4b, 0x01];
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** TS 5.7+ types typed arrays over ArrayBufferLike; WebCrypto wants ArrayBuffer-backed views. */
const bs = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;

export class SyncCryptoError extends Error {
  constructor(message = 'Decryption failed') {
    super(message);
    this.name = 'SyncCryptoError';
  }
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export const hasWebCrypto = () => typeof crypto !== 'undefined' && !!crypto.subtle;

/** Derives the (non-extractable) AES-GCM key for a passphrase. */
export const deriveKey = async (passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', bs(enc.encode(passphrase.normalize('NFKC'))), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bs(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

/** A random non-extractable key (device-local secrets). */
export const generateKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as Promise<CryptoKey>;

export const encryptBytes = async (key: CryptoKey, data: Uint8Array, aad: string): Promise<Uint8Array> => {
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv), additionalData: bs(enc.encode(aad)) }, key, bs(data)));
  const out = new Uint8Array(MAGIC.length + IV_BYTES + ct.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(ct, MAGIC.length + IV_BYTES);
  return out;
};

export const decryptBytes = async (key: CryptoKey, blob: Uint8Array, aad: string): Promise<Uint8Array> => {
  if (blob.length < MAGIC.length + IV_BYTES + 16 || MAGIC.some((b, i) => blob[i] !== b)) throw new SyncCryptoError('Not an encrypted Penko blob');
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(iv.slice()), additionalData: bs(enc.encode(aad)) },
      key,
      bs(blob.slice(MAGIC.length + IV_BYTES)),
    );
    return new Uint8Array(pt);
  } catch {
    throw new SyncCryptoError();
  }
};

export const encryptString = async (key: CryptoKey, text: string, aad: string) => encryptBytes(key, enc.encode(text), aad);
export const decryptString = async (key: CryptoKey, blob: Uint8Array, aad: string) => dec.decode(await decryptBytes(key, blob, aad));

/** Hex SHA-256 (room names derived from pairing secrets). */
export const sha256Hex = async (text: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bs(enc.encode(text))));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
};
