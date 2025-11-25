import { config } from '../config';

type MessageHandler = (message: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private isIntentionalClose = false;
  private token: string | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    this.token = token;
    this.isIntentionalClose = false;

    return new Promise((resolve, reject) => {
      const wsUrl = `${config.wsUrl}/ws?token=${encodeURIComponent(token)}`;
      
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.ws = null;
          
          if (!this.isIntentionalClose) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message through WebSocket
   */
  send(type: string, payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type, payload }));
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.token && !this.isIntentionalClose) {
        this.connect(this.token).catch(() => {
          // Will retry automatically via onclose handler
        });
      }
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const websocket = new WebSocketService();
