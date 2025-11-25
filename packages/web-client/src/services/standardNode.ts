// Standard Node API endpoints
const STANDARD_NODES = [
  import.meta.env.VITE_STANDARD_NODE_1_URL || 'http://localhost:4001',
  import.meta.env.VITE_STANDARD_NODE_2_URL || 'http://localhost:4002',
  import.meta.env.VITE_STANDARD_NODE_3_URL || 'http://localhost:4003',
];

export interface StoredMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDeviceId: number;
  recipientId: string;
  recipientUsername: string;
  recipientDeviceId?: number;
  messageType: string;
  encryptedPayload: string;
  timestamp: number;
  delivered: boolean;
  deliveredAt?: number;
  expiresAt?: number;
}

class StandardNodeService {
  /**
   * Retrieve messages for the current user from Standard Nodes
   */
  async getMessagesForUser(userId: string): Promise<StoredMessage[]> {
    const allMessages: StoredMessage[] = [];
    
    // Try each Standard Node
    for (const nodeUrl of STANDARD_NODES) {
      try {
        const response = await fetch(`${nodeUrl}/messages/${userId}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.messages) {
            allMessages.push(...data.messages);
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${nodeUrl}:`, error);
        // Continue with other nodes
      }
    }
    
    // Deduplicate by message ID (in case of replication overlap)
    const uniqueMessages = new Map<string, StoredMessage>();
    allMessages.forEach(msg => {
      if (!uniqueMessages.has(msg.id)) {
        uniqueMessages.set(msg.id, msg);
      }
    });
    
    return Array.from(uniqueMessages.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Delete a message from all Standard Nodes
   */
  async deleteMessage(messageId: string): Promise<void> {
    const promises = STANDARD_NODES.map(async (nodeUrl) => {
      try {
        await fetch(`${nodeUrl}/messages/${messageId}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });
      } catch (error) {
        console.warn(`Failed to delete from ${nodeUrl}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Check health of all Standard Nodes
   */
  async checkHealth(): Promise<{ nodeUrl: string; healthy: boolean }[]> {
    const results = await Promise.allSettled(
      STANDARD_NODES.map(async (nodeUrl) => {
        try {
          const response = await fetch(`${nodeUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });
          return { nodeUrl, healthy: response.ok };
        } catch {
          return { nodeUrl, healthy: false };
        }
      })
    );
    
    return results.map((result) => 
      result.status === 'fulfilled' 
        ? result.value 
        : { nodeUrl: '', healthy: false }
    );
  }
}

export const standardNodeService = new StandardNodeService();
