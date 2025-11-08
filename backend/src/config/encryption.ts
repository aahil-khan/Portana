import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * Encryption utilities for securing sensitive config values
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 16;

/**
 * Derive encryption key from master secret using PBKDF2
 */
export function deriveKey(masterSecret: string, salt: Buffer): Buffer {
  return pbkdf2Sync(masterSecret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive string value
 * Returns: salt + iv + authTag + ciphertext (all hex-encoded)
 */
export function encrypt(plaintext: string, masterSecret: string): string {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from master secret
    const key = deriveKey(masterSecret, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + ciphertext
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

    return combined.toString('hex');
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt sensitive string value
 * Input format: salt + iv + authTag + ciphertext (hex-encoded)
 */
export function decrypt(encryptedHex: string, masterSecret: string): string {
  try {
    // Parse combined buffer
    const combined = Buffer.from(encryptedHex, 'hex');

    if (combined.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid encrypted data: too short');
    }

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive key
    const key = deriveKey(masterSecret, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List of config paths that should be encrypted
 */
export const ENCRYPTED_PATHS = [
  'data_sources.github.access_token',
  'data_sources.medium.custom_domain', // Optional: encrypt custom domain too
  'deployment.notifications.telegram.bot_token',
  'deployment.notifications.discord.webhook_url',
];

/**
 * Check if a config path should be encrypted
 */
export function shouldEncrypt(path: string): boolean {
  return ENCRYPTED_PATHS.some(
    (encPath) => path === encPath || path.startsWith(encPath + '.')
  );
}
