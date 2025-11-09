/**
 * Config Manager Test Suite
 * Tests encryption/decryption functionality
 */

import { describe, it, expect } from '@jest/globals';
import { encrypt, decrypt } from '../src/config/encryption.js';

const TEST_SECRET = 'this-is-a-very-secret-key-32-chars-min!!!';

describe('Config Manager', () => {
  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt correctly', () => {
      const plaintext = 'my-secret-api-token-12345';
      const encrypted = encrypt(plaintext, TEST_SECRET);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plaintext);

      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle multiple encryption/decryption cycles', () => {
      const texts = [
        'api_key_secret_1',
        'another_secret_token',
        '{"sensitive": "data"}',
      ];

      for (const text of texts) {
        const encrypted = encrypt(text, TEST_SECRET);
        const decrypted = decrypt(encrypted, TEST_SECRET);
        expect(decrypted).toEqual(text);
      }
    });

    it('should produce different ciphertext for each encryption', () => {
      const plaintext = 'test-secret';
      const encrypted1 = encrypt(plaintext, TEST_SECRET);
      const encrypted2 = encrypt(plaintext, TEST_SECRET);

      // Encryption should be randomized (IV changes)
      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to the same plaintext
      expect(decrypt(encrypted1, TEST_SECRET)).toEqual(plaintext);
      expect(decrypt(encrypted2, TEST_SECRET)).toEqual(plaintext);
    });
  });
});
