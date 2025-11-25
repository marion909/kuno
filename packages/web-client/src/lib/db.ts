import Dexie, { Table } from 'dexie';

export interface StoredSession {
  id: string; // `${userId}_${deviceId}`
  userId: string;
  deviceId: number;
  sessionData: string; // Serialized session
  createdAt: number;
  updatedAt: number;
}

export interface StoredPreKey {
  id: number;
  keyId: number;
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

export interface StoredIdentity {
  id: string; // 'local'
  identityKeyPair: string; // Serialized key pair
  registrationId: number;
  createdAt: number;
}

export class KunoDatabase extends Dexie {
  sessions!: Table<StoredSession, string>;
  preKeys!: Table<StoredPreKey, number>;
  identity!: Table<StoredIdentity, string>;

  constructor() {
    super('KunoMessaging');
    
    this.version(1).stores({
      sessions: 'id, userId, deviceId',
      preKeys: '++id, keyId',
      identity: 'id',
    });
  }
}

export const db = new KunoDatabase();
