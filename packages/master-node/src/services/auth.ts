import bcrypt from 'bcrypt';
import { pool } from '../db';

const SALT_ROUNDS = 10;

export interface User {
  id: string;
  username: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: number;
  user_id: string;
  device_name: string;
  registration_id: number;
  identity_key: string;
  created_at: Date;
  last_seen_at: Date;
}

export class AuthService {
  /**
   * Register a new user and their first device
   */
  async register(username: string, password: string, deviceName: string): Promise<{ user: User; device: Device }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if username exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         RETURNING id, username, created_at, updated_at`,
        [username, passwordHash]
      );

      const user = userResult.rows[0];

      // Generate registration ID (random 32-bit integer)
      const registrationId = Math.floor(Math.random() * 2147483647);

      // Create first device (identity key will be set later via PreKey upload)
      const deviceResult = await client.query(
        `INSERT INTO devices (user_id, device_name, registration_id, identity_key)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, device_name, registration_id, identity_key, created_at, last_seen_at`,
        [user.id, deviceName, registrationId, ''] // Empty identity key for now
      );

      const device = deviceResult.rows[0];

      await client.query('COMMIT');

      return { user, device };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Login user and create/update device
   */
  async login(username: string, password: string, deviceName: string): Promise<{ user: User; device: Device }> {
    const client = await pool.connect();

    try {
      // Get user
      const userResult = await client.query(
        'SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const userRow = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userRow.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      const user: User = {
        id: userRow.id,
        username: userRow.username,
        created_at: userRow.created_at,
        updated_at: userRow.updated_at,
      };

      // Check if device exists for this user
      const deviceResult = await client.query(
        `SELECT id, user_id, device_name, registration_id, identity_key, created_at, last_seen_at
         FROM devices
         WHERE user_id = $1 AND device_name = $2`,
        [user.id, deviceName]
      );

      let device: Device;

      if (deviceResult.rows.length > 0) {
        // Update last_seen_at
        device = deviceResult.rows[0];
        await client.query(
          'UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1',
          [device.id]
        );
        device.last_seen_at = new Date();
      } else {
        // Create new device
        const registrationId = Math.floor(Math.random() * 2147483647);
        const newDeviceResult = await client.query(
          `INSERT INTO devices (user_id, device_name, registration_id, identity_key)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id, device_name, registration_id, identity_key, created_at, last_seen_at`,
          [user.id, deviceName, registrationId, '']
        );
        device = newDeviceResult.rows[0];
      }

      return { user, device };
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT id, username, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT id, username, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<Device[]> {
    const result = await pool.query(
      `SELECT id, user_id, device_name, registration_id, identity_key, created_at, last_seen_at
       FROM devices
       WHERE user_id = $1
       ORDER BY last_seen_at DESC`,
      [userId]
    );

    return result.rows;
  }
}

export const authService = new AuthService();
