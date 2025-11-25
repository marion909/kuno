import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool(config.database);

export async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create devices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name VARCHAR(255) NOT NULL,
        registration_id INTEGER NOT NULL,
        identity_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, registration_id)
      )
    `);

    // Create prekeys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS prekeys (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        prekey_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        is_signed BOOLEAN DEFAULT FALSE,
        signature TEXT,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, prekey_id)
      )
    `);

    // Create standard_nodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS standard_nodes (
        id VARCHAR(255) PRIMARY KEY,
        url VARCHAR(512) NOT NULL,
        status VARCHAR(50) DEFAULT 'offline',
        last_health_check TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        uptime INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create message_reactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    // Create index on message_reactions for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id 
      ON message_reactions(message_id)
    `);

    // Create key_backups table for encrypted key storage
    await client.query(`
      CREATE TABLE IF NOT EXISTS key_backups (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_keys TEXT NOT NULL,
        salt VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}
