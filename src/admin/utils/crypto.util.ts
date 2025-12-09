import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';

// If no key is provided, we can either throw or use a fallback for dev (DANGEROUS).
// For this implementation, we'll log a warning if it's missing or invalid length.
if (KEY_HEX.length !== 64) {
  console.warn('WARNING: ENCRYPTION_KEY is not set or invalid (must be 32 bytes hex).');
}

export function encrypt(text: string): string {
  if (!text) return '';
  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: IV:AuthTag:EncryptedContent
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text) return '';
  const key = Buffer.from(KEY_HEX, 'hex');
  const parts = text.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
