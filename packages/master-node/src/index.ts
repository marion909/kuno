import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config';
import { initDatabase } from './db';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

async function start() {
  try {
    // Register plugins
    await app.register(cors, {
      origin: true,
    });

    await app.register(jwt, {
      secret: config.jwt.secret,
    });

    await app.register(websocket);

    // Initialize database
    await initDatabase();

    // Health check
    app.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // TODO: Register routes
    // - /api/auth (register, login)
    // - /api/keys (prekey upload/fetch)
    // - /api/nodes (node registry)
    // - /ws (WebSocket connections)

    // Start HTTP server
    await app.listen({ port: config.port, host: '0.0.0.0' });
    
    console.log(`🚀 Master Node running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${config.port}/ws`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
