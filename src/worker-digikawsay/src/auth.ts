// Simple WebCrypto based password hashing for Cloudflare Workers
// We use SHA-256 with a simple context salt to avoid trivial rainbow tables.

const SALT = "digikawsay_edge_salt_v1";

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function hashPassword(password: string): Promise<string> {
  // Combine password with app-wide salt
  return await sha256(SALT + password);
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  const attemptHash = await hashPassword(password);
  return attemptHash === expectedHash;
}

// Generate simple secure session tokens
export function generateSessionToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
