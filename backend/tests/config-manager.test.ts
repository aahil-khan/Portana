/**
 * Config Manager Test Suite
 * Tests encryption, decryption, loading, saving, and updating config
 */

import { ConfigManager } from '../src/config/config-manager.js';
import { encrypt, decrypt } from '../src/config/encryption.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_SECRET = 'this-is-a-very-secret-key-32-chars-min!!!';
const TEST_CONFIG_PATH = path.join(__dirname, '../../../data/test-config.json');

/**
 * Test encryption and decryption
 */
async function testEncryption(): Promise<void> {
  console.log('\n=== Testing Encryption/Decryption ===');

  const plaintext = 'my-secret-api-token-12345';
  const encrypted = encrypt(plaintext, TEST_SECRET);

  console.log(`Original:  ${plaintext}`);
  console.log(`Encrypted: ${encrypted.substring(0, 40)}...`);

  const decrypted = decrypt(encrypted, TEST_SECRET);
  console.log(`Decrypted: ${decrypted}`);

  if (decrypted === plaintext) {
    console.log('✓ Encryption/Decryption working correctly');
  } else {
    throw new Error('Encryption/Decryption failed');
  }
}

/**
 * Test config manager
 */
async function testConfigManager(): Promise<void> {
  console.log('\n=== Testing Config Manager ===');

  // Clean up any existing test file
  try {
    await fs.unlink(TEST_CONFIG_PATH);
  } catch {
    // File doesn't exist, that's ok
  }

  // Create config manager
  const manager = new ConfigManager(TEST_SECRET, TEST_CONFIG_PATH);

  // Load (should create default)
  const defaultConfig = await manager.load();
  console.log('✓ Loaded default config');
  console.log(`  User ID: ${defaultConfig.user.id}`);
  console.log(`  Version: ${defaultConfig.version}`);

  // Update user profile
  await manager.updatePath('user.full_name', 'John Doe');
  await manager.updatePath('user.email', 'john@example.com');
  console.log('✓ Updated user profile');

  // Reload to verify persistence
  const manager2 = new ConfigManager(TEST_SECRET, TEST_CONFIG_PATH);
  const reloaded = await manager2.load();

  if (
    reloaded.user.full_name === 'John Doe' &&
    reloaded.user.email === 'john@example.com'
  ) {
    console.log('✓ Config persisted correctly');
  } else {
    throw new Error('Config not persisted');
  }

  // Test partial update
  const partial = {
    user: {
      ...reloaded.user,
      bio: 'This is my professional bio',
    },
  };

  await manager2.update(partial);
  console.log('✓ Partial update successful');

  // Verify nested path access
  const bio = manager2.getPath('user.bio');
  console.log(`  Bio: ${bio}`);

  // Clean up
  try {
    await fs.unlink(TEST_CONFIG_PATH);
  } catch {
    // Error ok
  }

  console.log('✓ All config manager tests passed');
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  try {
    await testEncryption();
    await testConfigManager();

    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
