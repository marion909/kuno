import { create } from 'zustand';
import { websocket } from '../services/websocket';
import { signalService } from '../services/signal';
import { api } from '../services/api';
import { standardNodeService } from '../services/standardNode';
import { useAuthStore } from './authStore';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  isOwn: boolean;
  reactions?: Array<{ emoji: string; count: number; users: string[] }>;
}

export interface Conversation {
  id: string;
  username: string;
  lastMessage?: string;
  lastMessageAt: number;
  unreadCount: number;
}

interface ChatState {
  conversations: Map<string, Conversation>;
  messages: Map<string, Message[]>;
  activeConversation: string | null;
  typingUsers: Map<string, boolean>; // username -> isTyping
  
  initializeChat: () => void;
  setActiveConversation: (username: string) => void;
  sendMessage: (recipientUsername: string, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  handleIncomingMessage: (payload: any) => Promise<void>;
  handleMessageAck: (payload: any) => void;
  handleTyping: (payload: any) => void;
  handleReadReceipt: (payload: any) => void;
  sendTypingIndicator: (recipientUsername: string, isTyping: boolean) => void;
  sendReadReceipt: (messageId: string, senderUsername: string) => void;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  fetchStoredMessages: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: new Map(),
  messages: new Map(),
  activeConversation: null,
  typingUsers: new Map(),

  initializeChat: () => {
    // Listen for incoming messages
    websocket.onMessage((data) => {
      const { type, payload } = data;
      
      if (type === 'receive_message') {
        get().handleIncomingMessage(payload);
      } else if (type === 'message_ack') {
        get().handleMessageAck(payload);
      } else if (type === 'typing') {
        get().handleTyping(payload);
      } else if (type === 'read_receipt') {
        get().handleReadReceipt(payload);
      }
    });
    
    // Fetch stored messages from Standard Nodes
    get().fetchStoredMessages();
  },

  setActiveConversation: (username: string) => {
    set({ activeConversation: username });
    
    // Mark messages as read
    const state = get();
    const conversations = new Map(state.conversations);
    const conversation = conversations.get(username);
    
    if (conversation) {
      conversation.unreadCount = 0;
      conversations.set(username, conversation);
      set({ conversations });
    }
  },

  sendMessage: async (recipientUsername: string, text: string) => {
    const state = get();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get recipient's PreKey bundle
      const bundleResponse = await api.getPreKeyBundle(recipientUsername);
      const recipientBundle = bundleResponse.data.devices[0]; // Use first device
      
      // Encrypt message
      const { encryptedPayload, messageType } = await signalService.encrypt(
        recipientBundle,
        text
      );
      
      // Create optimistic message
      const message: Message = {
        id: messageId,
        conversationId: recipientUsername,
        senderId: '', // Will be set by server
        senderUsername: 'You',
        text,
        timestamp: Date.now(),
        status: 'sending',
        isOwn: true,
      };
      
      // Add to UI immediately
      state.addMessage(message);
      
      // Send via WebSocket
      websocket.send('send_message', {
        recipientUsername,
        recipientDeviceId: recipientBundle.deviceId,
        encryptedPayload,
        messageType,
      });
      
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      const messages = new Map(state.messages);
      const conversationMessages = messages.get(message.conversationId) || [];
      
      // Check if message already exists
      const exists = conversationMessages.some(m => m.id === message.id);
      if (!exists) {
        conversationMessages.push(message);
        conversationMessages.sort((a, b) => a.timestamp - b.timestamp);
        messages.set(message.conversationId, conversationMessages);
      }
      
      // Update conversation
      const conversations = new Map(state.conversations);
      const conversation = conversations.get(message.conversationId) || {
        id: message.conversationId,
        username: message.isOwn ? message.conversationId : message.senderUsername,
        lastMessage: message.text,
        lastMessageAt: message.timestamp,
        unreadCount: 0,
      };
      
      conversation.lastMessage = message.text;
      conversation.lastMessageAt = message.timestamp;
      
      if (!message.isOwn && state.activeConversation !== message.conversationId) {
        conversation.unreadCount++;
      }
      
      conversations.set(message.conversationId, conversation);
      
      return { messages, conversations };
    });
  },

  // Internal helpers
  handleIncomingMessage: async (payload: any) => {
    try {
      // Decrypt message
      const plaintext = await signalService.decrypt(
        payload.encryptedPayload,
        payload.messageType
      );
      
      const message: Message = {
        id: payload.id,
        conversationId: payload.senderUsername,
        senderId: payload.senderId,
        senderUsername: payload.senderUsername,
        text: plaintext,
        timestamp: payload.timestamp,
        status: 'delivered',
        isOwn: false,
      };
      
      get().addMessage(message);
      
      // Send read receipt if this is the active conversation
      const state = get();
      if (state.activeConversation === payload.senderUsername) {
        get().sendReadReceipt(message.id, payload.senderUsername);
      }
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
  },

  handleMessageAck: (payload: any) => {
    set((state) => {
      const messages = new Map(state.messages);
      
      // Find and update message status
      for (const [conversationId, conversationMessages] of messages.entries()) {
        const messageIndex = conversationMessages.findIndex(m => 
          m.timestamp === payload.timestamp && m.status === 'sending'
        );
        
        if (messageIndex !== -1) {
          conversationMessages[messageIndex].status = 'sent';
          conversationMessages[messageIndex].id = payload.messageId;
          messages.set(conversationId, [...conversationMessages]);
          break;
        }
      }
      
      return { messages };
    });
  },

  fetchStoredMessages: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      
      // Fetch stored messages from Standard Nodes
      const storedMessages = await standardNodeService.getMessagesForUser(user.id);
      
      // Decrypt and add messages
      for (const storedMsg of storedMessages) {
        try {
          const plaintext = await signalService.decrypt(
            storedMsg.encryptedPayload,
            storedMsg.messageType as 'prekey' | 'whisper'
          );
          
          const message: Message = {
            id: storedMsg.id,
            conversationId: storedMsg.senderUsername,
            senderId: storedMsg.senderId,
            senderUsername: storedMsg.senderUsername,
            text: plaintext,
            timestamp: storedMsg.timestamp,
            status: 'delivered',
            isOwn: false,
          };
          
          get().addMessage(message);
          
          // Delete message after successful retrieval
          await standardNodeService.deleteMessage(storedMsg.id);
        } catch (error) {
          console.error('Failed to decrypt stored message:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stored messages:', error);
    }
  },

  handleTyping: (payload: any) => {
    const { username, isTyping } = payload;
    set((state) => {
      const typingUsers = new Map(state.typingUsers);
      if (isTyping) {
        typingUsers.set(username, true);
        // Auto-clear after 3 seconds
        setTimeout(() => {
          set((s) => {
            const updated = new Map(s.typingUsers);
            updated.delete(username);
            return { typingUsers: updated };
          });
        }, 3000);
      } else {
        typingUsers.delete(username);
      }
      return { typingUsers };
    });
  },

  handleReadReceipt: (payload: any) => {
    const { messageId } = payload;
    set((state) => {
      const messages = new Map(state.messages);
      
      // Find and update message status
      for (const [conversationId, conversationMessages] of messages.entries()) {
        const messageIndex = conversationMessages.findIndex(m => m.id === messageId);
        
        if (messageIndex !== -1) {
          conversationMessages[messageIndex].status = 'read';
          messages.set(conversationId, [...conversationMessages]);
          break;
        }
      }
      
      return { messages };
    });
  },

  sendTypingIndicator: (recipientUsername: string, isTyping: boolean) => {
    try {
      websocket.send('typing', { recipientUsername, isTyping });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  },

  sendReadReceipt: (messageId: string, senderUsername: string) => {
    try {
      websocket.send('read_receipt', { messageId, senderUsername });
    } catch (error) {
      console.error('Failed to send read receipt:', error);
    }
  },

  addReaction: async (messageId: string, emoji: string) => {
    try {
      const response = await api.post('/api/reactions', { messageId, emoji });
      
      // Update message reactions
      set((state) => {
        const messages = new Map(state.messages);
        
        for (const [conversationId, conversationMessages] of messages.entries()) {
          const messageIndex = conversationMessages.findIndex(m => m.id === messageId);
          
          if (messageIndex !== -1) {
            conversationMessages[messageIndex].reactions = response.data.reactions;
            messages.set(conversationId, [...conversationMessages]);
            break;
          }
        }
        
        return { messages };
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (messageId: string, emoji: string) => {
    try {
      const response = await api.delete('/api/reactions', { data: { messageId, emoji } });
      
      // Update message reactions
      set((state) => {
        const messages = new Map(state.messages);
        
        for (const [conversationId, conversationMessages] of messages.entries()) {
          const messageIndex = conversationMessages.findIndex(m => m.id === messageId);
          
          if (messageIndex !== -1) {
            conversationMessages[messageIndex].reactions = response.data.reactions;
            messages.set(conversationId, [...conversationMessages]);
            break;
          }
        }
        
        return { messages };
      });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  },
}));
