/**
 * Crypto utilities and Signal Protocol wrapper
 * This file provides a simplified interface for Signal Protocol operations
 */

import { PreKeyBundle } from './types';

/**
 * Generate a cryptographically secure random ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(buffer: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(buffer).toString('base64');
  } else {
    // Browser environment
    return btoa(String.fromCharCode(...Array.from(buffer)));
  }
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return new Uint8Array(Buffer.from(base64, 'base64'));
  } else {
    // Browser environment
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

/**
 * Serialize PreKeyBundle for transmission
 */
export function serializePreKeyBundle(bundle: PreKeyBundle): Record<string, any> {
  return {
    identityKey: uint8ArrayToBase64(bundle.identityKey),
    registrationId: bundle.registrationId,
    deviceId: bundle.deviceId,
    signedPreKeyId: bundle.signedPreKeyId,
    signedPreKey: uint8ArrayToBase64(bundle.signedPreKey),
    signedPreKeySignature: uint8ArrayToBase64(bundle.signedPreKeySignature),
    preKeyId: bundle.preKeyId,
    preKey: bundle.preKey ? uint8ArrayToBase64(bundle.preKey) : undefined,
  };
}

/**
 * Deserialize PreKeyBundle from JSON
 */
export function deserializePreKeyBundle(data: Record<string, any>): PreKeyBundle {
  return {
    identityKey: base64ToUint8Array(data.identityKey),
    registrationId: data.registrationId,
    deviceId: data.deviceId,
    signedPreKeyId: data.signedPreKeyId,
    signedPreKey: base64ToUint8Array(data.signedPreKey),
    signedPreKeySignature: base64ToUint8Array(data.signedPreKeySignature),
    preKeyId: data.preKeyId,
    preKey: data.preKey ? base64ToUint8Array(data.preKey) : undefined,
  };
}

/**
 * Create a timestamp (Unix milliseconds)
 */
export function createTimestamp(): number {
  return Date.now();
}
