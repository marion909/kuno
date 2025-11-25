import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config';
import { initDatabase, pool } from './db';
import { authRoutes } from './routes/auth';
import { keyRoutes } from './routes/keys';
import { websocketRoutes } from './routes/websocket';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Extend FastifyInstance with authenticate decorator and pg
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    pg: any;
  }
}

async function start() {
  try {
    // Register plugins
    await app.register(cors, {
      origin: true,
    });

    await app.register(jwt, {
      secret: config.jwt.secret,
    });

    // Add authentication decorator
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({
          success: false,
          error: 'Unauthorized',
        });
      }
    });

    // Add pg pool to app instance
    app.decorate('pg', pool);

    await app.register(websocket);

    // Initialize database
    await initDatabase();

    // Health check
    app.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register routes
    await app.register(authRoutes);
    await app.register(keyRoutes);
    await app.register(websocketRoutes);
    
    // TODO: Register additional routes
    // - /api/nodes (node registry)

    // Start HTTP server
    await app.listen({ port: config.port, host: '0.0.0.0' });
    
    console.log(`🚀 Master Node running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${config.port}/ws`);
    console.log(`🔐 Auth endpoints: POST /api/auth/register, POST /api/auth/login`);
    console.log(`🔑 Key endpoints: POST /api/keys/upload, GET /api/keys/:username`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
