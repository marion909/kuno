/**
 * Backup utilities for encrypting and decrypting Signal protocol keys
 * Uses PBKDF2 for key derivation and AES-256-GCM for encryption
 */

export class BackupService {
  /**
   * Derive encryption key from passphrase using PBKDF2
   */
  private async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate random salt for key derivation
   */
  private generateSalt(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Export Signal store keys to JSON
   */
  async exportKeys(): Promise<any> {
    const stores = ['identity', 'preKey', 'signedPreKey', 'session'];
    const exported: any = {};

    for (const storeName of stores) {
      const data = localStorage.getItem(`signal_${storeName}`);
      if (data) {
        exported[storeName] = data;
      }
    }

    return exported;
  }

  /**
   * Import Signal store keys from JSON
   */
  async importKeys(keys: any): Promise<void> {
    const stores = ['identity', 'preKey', 'signedPreKey', 'session'];

    for (const storeName of stores) {
      if (keys[storeName]) {
        localStorage.setItem(`signal_${storeName}`, keys[storeName]);
      }
    }
  }

  /**
   * Encrypt keys with passphrase
   */
  async encryptKeys(passphrase: string): Promise<{ encryptedKeys: string; salt: string }> {
    if (passphrase.length < 12) {
      throw new Error('Passphrase must be at least 12 characters');
    }

    // Export current keys
    const keys = await this.exportKeys();
    const keysJson = JSON.stringify(keys);

    // Generate salt and derive key
    const salt = this.generateSalt();
    const key = await this.deriveKey(passphrase, salt);

    // Encrypt
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoder.encode(keysJson)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return {
      encryptedKeys: this.arrayBufferToBase64(combined),
      salt: this.arrayBufferToBase64(salt),
    };
  }

  /**
   * Decrypt keys with passphrase
   */
  async decryptKeys(
    encryptedKeys: string,
    salt: string,
    passphrase: string
  ): Promise<any> {
    // Decode
    const saltBytes = this.base64ToArrayBuffer(salt);
    const combined = this.base64ToArrayBuffer(encryptedKeys);

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Derive key
    const key = await this.deriveKey(passphrase, saltBytes);

    // Decrypt
    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const keysJson = decoder.decode(decrypted);
      return JSON.parse(keysJson);
    } catch (error) {
      throw new Error('Failed to decrypt keys. Wrong passphrase?');
    }
  }

  /**
   * Clear all Signal keys from localStorage
   */
  clearKeys(): void {
    const stores = ['identity', 'preKey', 'signedPreKey', 'session'];
    for (const storeName of stores) {
      localStorage.removeItem(`signal_${storeName}`);
    }
  }
}

export const backupService = new BackupService();
