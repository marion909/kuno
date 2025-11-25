import 'dotenv/config';

// Parse REDIS_URL if provided (e.g., redis://:password@host:port)
function parseRedisUrl(url?: string) {
  if (!url) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };
  }
  
  // Parse redis://:password@host:port or redis://host:port
  const match = url.match(/redis:\/\/(?::([^@]+)@)?([^:]+):(\d+)/);
  if (!match) {
    throw new Error('Invalid REDIS_URL format');
  }
  
  return {
    host: match[2],
    port: parseInt(match[3]),
    password: match[1] || undefined,
  };
}

// Parse DATABASE_URL if provided (e.g., postgresql://user:pass@host:port/dbname)
function parseDatabaseUrl(url?: string) {
  if (!url) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'kuno',
      user: process.env.DB_USER || 'kuno',
      password: process.env.DB_PASSWORD || 'kuno_dev_password',
    };
  }
  
  // Parse postgresql://user:pass@host:port/dbname
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  wsPort: parseInt(process.env.WS_PORT || '3001'),
  
  // Database - supports both DATABASE_URL and individual env vars
  database: process.env.DATABASE_URL 
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'kuno',
        user: process.env.DB_USER || 'kuno',
        password: process.env.DB_PASSWORD || 'kuno_dev_password',
      },
  
  // Redis - supports both REDIS_URL and individual env vars
  redis: process.env.REDIS_URL
    ? parseRedisUrl(process.env.REDIS_URL)
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d',
  },
  
  // Standard Nodes
  standardNodes: [
    {
      id: 'node-1',
      url: process.env.STANDARD_NODE_1_URL || 'http://localhost:4001',
    },
    {
      id: 'node-2',
      url: process.env.STANDARD_NODE_2_URL || 'http://localhost:4002',
    },
    {
      id: 'node-3',
      url: process.env.STANDARD_NODE_3_URL || 'http://localhost:4003',
    },
  ],
};
