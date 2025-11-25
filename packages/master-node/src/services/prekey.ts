import { pool } from '../db';

export interface PreKey {
  id: number;
  device_id: number;
  prekey_id: number;
  public_key: string;
  is_signed: boolean;
  signature?: string;
  used: boolean;
  created_at: Date;
}

export interface PreKeyBundle {
  identityKey: string;
  registrationId: number;
  deviceId: number;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySignature: string;
  preKeyId?: number;
  preKey?: string;
}

export class PreKeyService {
  /**
   * Upload PreKeys for a device
   */
  async uploadPreKeys(
    deviceId: number,
    identityKey: string,
    signedPreKey: { id: number; publicKey: string; signature: string },
    oneTimePreKeys: { id: number; publicKey: string }[]
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update identity key for device
      await client.query(
        'UPDATE devices SET identity_key = $1 WHERE id = $2',
        [identityKey, deviceId]
      );

      // Insert signed PreKey
      await client.query(
        `INSERT INTO prekeys (device_id, prekey_id, public_key, is_signed, signature)
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (device_id, prekey_id) DO UPDATE
         SET public_key = EXCLUDED.public_key,
             signature = EXCLUDED.signature,
             used = false`,
        [deviceId, signedPreKey.id, signedPreKey.publicKey, signedPreKey.signature]
      );

      // Insert one-time PreKeys
      for (const preKey of oneTimePreKeys) {
        await client.query(
          `INSERT INTO prekeys (device_id, prekey_id, public_key, is_signed)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (device_id, prekey_id) DO NOTHING`,
          [deviceId, preKey.id, preKey.publicKey]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get PreKey bundle for a user (specific device or any available device)
   */
  async getPreKeyBundle(userId: string, deviceId?: number): Promise<PreKeyBundle | null> {
    const client = await pool.connect();

    try {
      // Get device info
      let deviceQuery = `
        SELECT id, user_id, registration_id, identity_key
        FROM devices
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (deviceId) {
        deviceQuery += ' AND id = $2';
        params.push(deviceId);
      } else {
        deviceQuery += ' ORDER BY last_seen_at DESC LIMIT 1';
      }

      const deviceResult = await client.query(deviceQuery, params);

      if (deviceResult.rows.length === 0) {
        return null;
      }

      const device = deviceResult.rows[0];

      if (!device.identity_key) {
        return null; // Device hasn't uploaded keys yet
      }

      // Get signed PreKey
      const signedPreKeyResult = await client.query(
        `SELECT prekey_id, public_key, signature
         FROM prekeys
         WHERE device_id = $1 AND is_signed = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [device.id]
      );

      if (signedPreKeyResult.rows.length === 0) {
        return null;
      }

      const signedPreKey = signedPreKeyResult.rows[0];

      // Get and mark one-time PreKey as used
      const oneTimePreKeyResult = await client.query(
        `UPDATE prekeys
         SET used = true
         WHERE id = (
           SELECT id FROM prekeys
           WHERE device_id = $1 AND is_signed = false AND used = false
           ORDER BY created_at ASC
           LIMIT 1
         )
         RETURNING prekey_id, public_key`,
        [device.id]
      );

      const bundle: PreKeyBundle = {
        identityKey: device.identity_key,
        registrationId: device.registration_id,
        deviceId: device.id,
        signedPreKeyId: signedPreKey.prekey_id,
        signedPreKey: signedPreKey.public_key,
        signedPreKeySignature: signedPreKey.signature,
      };

      // Add one-time PreKey if available
      if (oneTimePreKeyResult.rows.length > 0) {
        const oneTimePreKey = oneTimePreKeyResult.rows[0];
        bundle.preKeyId = oneTimePreKey.prekey_id;
        bundle.preKey = oneTimePreKey.public_key;
      }

      return bundle;
    } finally {
      client.release();
    }
  }

  /**
   * Get all devices for a user (for multi-device support)
   */
  async getAllDevicePreKeyBundles(userId: string): Promise<PreKeyBundle[]> {
    const client = await pool.connect();

    try {
      const deviceResult = await client.query(
        `SELECT id FROM devices WHERE user_id = $1 AND identity_key != ''`,
        [userId]
      );

      const bundles: PreKeyBundle[] = [];

      for (const device of deviceResult.rows) {
        const bundle = await this.getPreKeyBundle(userId, device.id);
        if (bundle) {
          bundles.push(bundle);
        }
      }

      return bundles;
    } finally {
      client.release();
    }
  }

  /**
   * Get count of available one-time PreKeys for a device
   */
  async getAvailablePreKeyCount(deviceId: number): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM prekeys WHERE device_id = $1 AND is_signed = false AND used = false',
      [deviceId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}

export const preKeyService = new PreKeyService();
