// ── DigiKawsay Auth Module (Hardened) ──────────────────────────────────────
// 2026-05-03: Upgraded from SHA-256 to PBKDF2 with random salt per password.
// Timing-safe comparison to prevent timing attacks.

/**
 * Hash a password using PBKDF2 with a random 16-byte salt.
 * Returns "salt:hash" where both are hex-encoded.
 * Uses 100,000 iterations of SHA-256 via WebCrypto.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Supports both new PBKDF2 format ("salt:hash") and legacy SHA-256 format (plain hex).
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  // Detect legacy SHA-256 format (no colon separator)
  if (!expectedHash.includes(':')) {
    return verifyLegacyPassword(password, expectedHash);
  }

  const [saltHex, storedHashHex] = expectedHash.split(':');
  
  // Reconstruct salt from hex
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) || []).map(byte => parseInt(byte, 16))
  );

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const attemptHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(attemptHex, storedHashHex);
}

/**
 * Legacy SHA-256 verifier for backwards compatibility with existing admin hashes.
 * Will be removed after all admins re-set their passwords.
 */
async function verifyLegacyPassword(password: string, expectedHash: string): Promise<boolean> {
  const LEGACY_SALT = "digikawsay_edge_salt_v1";
  const data = new TextEncoder().encode(LEGACY_SALT + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const attemptHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(attemptHex, expectedHash);
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Always compares full length regardless of mismatch position.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
