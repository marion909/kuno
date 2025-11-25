import { FastifyInstance } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { config } from '../config';

interface Client {
  userId: string;
  username: string;
  deviceId: number;
  socket: SocketStream['socket'];
}

// Store active WebSocket connections
const clients = new Map<string, Client[]>(); // userId -> Client[]

export async function websocketRoutes(app: FastifyInstance) {
  /**
   * WebSocket endpoint: /ws
   * Handles real-time message routing
   */
  app.get('/ws', { websocket: true }, (socket: SocketStream, request) => {
    let client: Client | null = null;

    // Authentication via query parameter (token)
    const token = (request.query as any).token;
    
    if (!token) {
      socket.socket.close(4001, 'Missing authentication token');
      return;
    }

    try {
      // Verify JWT token
      const decoded = app.jwt.verify(token) as any;
      const { userId, username, deviceId } = decoded;

      // Create client object
      client = {
        userId,
        username,
        deviceId,
        socket: socket.socket,
      };

      // Add to clients map
      if (!clients.has(userId)) {
        clients.set(userId, []);
      }
      clients.get(userId)!.push(client);

      app.log.info(`WebSocket connected: ${username} (device ${deviceId})`);

      // Send welcome message
      socket.socket.send(JSON.stringify({
        type: 'connected',
        payload: {
          message: 'Connected to Kuno Master Node',
          userId,
          deviceId,
        },
      }));

      // Handle incoming messages
      socket.socket.on('message', async (rawData: Buffer) => {
        try {
          const data = JSON.parse(rawData.toString());
          await handleWebSocketMessage(app, client!, data);
        } catch (error: unknown) {
          app.log.error({ error }, 'Error handling WebSocket message');
          socket.socket.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Failed to process message' },
          }));
        }
      });

      // Handle disconnect
      socket.socket.on('close', () => {
        if (client) {
          removeClient(client);
          app.log.info(`WebSocket disconnected: ${client.username} (device ${client.deviceId})`);
        }
      });

    } catch (error: unknown) {
      app.log.error({ error }, 'WebSocket authentication failed');
      socket.socket.close(4001, 'Authentication failed');
    }
  });
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(app: FastifyInstance, sender: Client, data: any) {
  const { type, payload } = data;

  switch (type) {
    case 'send_message':
      await handleSendMessage(app, sender, payload);
      break;

    case 'typing':
      await handleTyping(sender, payload);
      break;

    case 'read_receipt':
      await handleReadReceipt(sender, payload);
      break;

    case 'presence':
      await handlePresence(sender, payload);
      break;

    default:
      app.log.warn(`Unknown message type: ${type}`);
  }
}

/**
 * Handle sending encrypted messages
 */
async function handleSendMessage(app: FastifyInstance, sender: Client, payload: any) {
  try {
    const { recipientUsername, recipientDeviceId, encryptedPayload, messageType } = payload;

    // Get recipient user ID
    const userResult = await app.pg.query(
      'SELECT id FROM users WHERE username = $1',
      [recipientUsername]
    );

    if (userResult.rows.length === 0) {
      sender.socket.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Recipient not found' },
      }));
      return;
    }

    const recipientUserId = userResult.rows[0].id;

    // Create message object
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      senderId: sender.userId,
      senderUsername: sender.username,
      senderDeviceId: sender.deviceId,
      recipientId: recipientUserId,
      recipientUsername,
      recipientDeviceId,
      messageType,
      encryptedPayload,
      timestamp: Date.now(),
    };

    // Send acknowledgment to sender
    sender.socket.send(JSON.stringify({
      type: 'message_ack',
      payload: {
        messageId: message.id,
        timestamp: message.timestamp,
      },
    }));

    // Route message to recipient devices
    const recipientClients = clients.get(recipientUserId) || [];
    
    let delivered = false;
    for (const recipient of recipientClients) {
      // If specific device is targeted, only send to that device
      if (recipientDeviceId && recipient.deviceId !== recipientDeviceId) {
        continue;
      }

      recipient.socket.send(JSON.stringify({
        type: 'receive_message',
        payload: message,
      }));

      delivered = true;
    }

    // Store message in Standard Nodes
    await storeMessageInStandardNodes(message, delivered);

    app.log.info(`Message routed: ${sender.username} -> ${recipientUsername}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    app.log.error({ err: error }, 'Error sending message');
    sender.socket.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Failed to send message', error: errorMessage },
    }));
  }
}

/**
 * Handle typing indicators
 */
async function handleTyping(sender: Client, payload: any) {
  const { recipientUsername, isTyping } = payload;

  // Find recipient clients
  let recipientUserId: string | null = null;
  
  // Search through all clients to find matching username
  for (const [userId, userClients] of clients.entries()) {
    if (userClients.some(c => c.username === recipientUsername)) {
      recipientUserId = userId;
      break;
    }
  }

  if (!recipientUserId) {
    return; // Recipient not online, ignore typing indicator
  }

  // Forward typing indicator to all recipient devices
  const recipientClients = clients.get(recipientUserId) || [];
  for (const recipient of recipientClients) {
    recipient.socket.send(JSON.stringify({
      type: 'typing',
      payload: {
        username: sender.username,
        isTyping,
      },
    }));
  }
}

/**
 * Handle read receipts
 */
async function handleReadReceipt(sender: Client, payload: any) {
  const { messageId, senderUsername } = payload;

  // Find sender clients (the original message sender)
  let originalSenderUserId: string | null = null;
  
  for (const [userId, userClients] of clients.entries()) {
    if (userClients.some(c => c.username === senderUsername)) {
      originalSenderUserId = userId;
      break;
    }
  }

  if (!originalSenderUserId) {
    return; // Original sender not online, ignore read receipt
  }

  // Forward read receipt to all original sender devices
  const senderClients = clients.get(originalSenderUserId) || [];
  for (const recipient of senderClients) {
    recipient.socket.send(JSON.stringify({
      type: 'read_receipt',
      payload: {
        messageId,
        readBy: sender.username,
        readAt: Date.now(),
      },
    }));
  }
}

/**
 * Handle presence updates
 */
async function handlePresence(sender: Client, payload: any) {
  const { status } = payload; // 'online', 'away', 'offline'
  
  // TODO: Implement presence broadcasting
}

/**
 * Store encrypted message in Standard Nodes
 */
async function storeMessageInStandardNodes(message: any, delivered: boolean) {
  const messageData = {
    ...message,
    delivered,
    deliveredAt: delivered ? Date.now() : null,
  };

  // Try to store in each Standard Node
  const promises = config.standardNodes.map(async (node) => {
    try {
      const response = await fetch(`${node.url}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        throw new Error(`Standard Node ${node.id} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to store in ${node.id}:`, error);
      // Continue with other nodes even if one fails
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Remove client from active connections
 */
function removeClient(client: Client) {
  const userClients = clients.get(client.userId);
  if (userClients) {
    const index = userClients.findIndex(c => c.deviceId === client.deviceId);
    if (index !== -1) {
      userClients.splice(index, 1);
    }
    if (userClients.length === 0) {
      clients.delete(client.userId);
    }
  }
}
