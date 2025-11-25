/**
 * User represents a registered user in the messaging platform
 */
export interface User {
  id: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Device represents a user's device (multi-device support)
 */
export interface Device {
  id: number;
  userId: string;
  deviceName: string;
  registrationId: number;
  createdAt: Date;
  lastSeenAt: Date;
}

/**
 * PreKeyBundle contains public keys for initiating Signal Protocol sessions
 */
export interface PreKeyBundle {
  identityKey: Uint8Array;
  registrationId: number;
  deviceId: number;
  signedPreKeyId: number;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  preKeyId?: number;
  preKey?: Uint8Array;
}

/**
 * Message types for Signal Protocol
 */
export enum MessageType {
  PREKEY = 'prekey',     // Initial message with PreKey
  WHISPER = 'whisper'    // Subsequent encrypted messages
}

/**
 * Encrypted message payload sent over WebSocket
 */
export interface EncryptedMessage {
  id: string;
  senderId: string;
  senderDeviceId: number;
  recipientId: string;
  recipientDeviceId: number;
  messageType: MessageType;
  encryptedPayload: string; // base64 encoded ciphertext
  timestamp: number;
  delivered?: boolean;
  deliveredAt?: number;
}

/**
 * WebSocket message types
 */
export enum WSMessageType {
  SEND_MESSAGE = 'send_message',
  RECEIVE_MESSAGE = 'receive_message',
  MESSAGE_ACK = 'message_ack',
  TYPING = 'typing',
  PRESENCE = 'presence'
}

/**
 * WebSocket message wrapper
 */
export interface WSMessage {
  type: WSMessageType;
  payload: any;
}

/**
 * Standard Node information
 */
export interface StandardNode {
  id: string;
  url: string;
  status: 'online' | 'offline' | 'degraded';
  lastHealthCheck: Date;
  messageCount?: number;
  uptime?: number;
}

/**
 * Conversation metadata
 */
export interface Conversation {
  id: string;
  participants: string[]; // userId[]
  lastMessageAt: Date;
  lastMessage?: string;
  unreadCount: number;
}

/**
 * Decrypted message (client-side only)
 */
export interface PlainMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}
