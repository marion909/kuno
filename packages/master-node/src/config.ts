import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  wsPort: parseInt(process.env.WS_PORT || '3001'),
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'kuno',
    user: process.env.DB_USER || 'kuno',
    password: process.env.DB_PASSWORD || 'kuno_dev_password',
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
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
