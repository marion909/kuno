# Kuno - Decentralized Encrypted Messaging Platform

A decentralized messaging platform with end-to-end encryption using Signal Protocol, featuring a master node architecture for node management and fully distributed message storage.

## 🏗️ Architecture

- **Master Node** (Node.js/TypeScript): Central management server handling user authentication, device registration, PreKey distribution, and WebSocket message routing
- **Standard Nodes** (Go): Distributed message storage using CouchDB with multi-master replication
- **Web Client** (React/TypeScript): Browser-based chat interface with Signal Protocol encryption
- **Mobile Apps** (React Native): Coming in Phase 3

## 📁 Project Structure

```
kuno-messaging-platform/
├── packages/
│   ├── shared/              # Shared TypeScript types and utilities
│   ├── master-node/         # Master Node (Node.js/TypeScript)
│   ├── standard-node/       # Standard Node (Go)
│   └── web-client/          # React web application
├── docker-compose.dev.yml   # Development infrastructure
└── package.json             # Monorepo workspace configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Go 1.21+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Kuno
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start infrastructure (PostgreSQL, CouchDB, Redis)**
   ```bash
   npm run docker:dev
   ```

4. **Set up environment variables**
   ```bash
   # Master Node
   cp packages/master-node/.env.example packages/master-node/.env
   
   # Standard Node
   cp packages/standard-node/.env.example packages/standard-node/.env
   ```

5. **Build shared package**
   ```bash
   cd packages/shared
   npm run build
   ```

6. **Start Master Node**
   ```bash
   cd packages/master-node
   npm run dev
   ```

7. **Start Standard Node(s)**
   ```bash
   cd packages/standard-node
   go run cmd/main.go
   ```

8. **Start Web Client**
   ```bash
   cd packages/web-client
   npm run dev
   ```

## 🔧 Development

### Master Node

- **Tech Stack**: Node.js, TypeScript, Fastify, PostgreSQL, Redis
- **Port**: 3000 (HTTP), 3001 (WebSocket)
- **Features**: User auth, PreKey management, message routing, node registry

### Standard Node

- **Tech Stack**: Go, Gin, CouchDB
- **Port**: 4001 (Node 1), 4002 (Node 2), 4003 (Node 3)
- **Features**: Encrypted message storage, CouchDB replication, health checks

### Web Client

- **Tech Stack**: React, TypeScript, Vite, Zustand, React Router
- **Port**: 5173
- **Features**: Signal Protocol E2E encryption, real-time chat, WebSocket connection

## 🔐 Security Features

- **Signal Protocol**: Industry-standard E2E encryption (Double Ratchet, X3DH)
- **Multi-Device Support**: Each device maintains separate encrypted sessions
- **Forward Secrecy**: Messages remain secure even if keys are compromised later
- **Zero-Knowledge**: Master Node never has access to message plaintext

## 📋 Architecture Decisions

1. **Encryption**: Signal Protocol (`@signalapp/libsignal-client`)
2. **Node Discovery**: Centralized through Master Node
3. **Data Persistence**: Fully distributed with CouchDB multi-master replication
4. **Monetization**: None (currently)
5. **MVP Scope**: 1:1 chats only (groups in Phase 3)

## 🗺️ Roadmap

### Phase 1: MVP (Current)
- [x] Project structure and infrastructure
- [ ] User authentication and registration
- [ ] Signal Protocol implementation
- [ ] 1:1 encrypted messaging
- [ ] Message persistence and replication

### Phase 2: Production Ready
- [ ] Multi-device support
- [ ] Message history and pagination
- [ ] Offline message queue
- [ ] Production deployment
- [ ] Monitoring and logging

### Phase 3: Mobile + Advanced
- [ ] React Native iOS/Android apps
- [ ] Push notifications
- [ ] Group chats (Sender-Keys Protocol)
- [ ] Media attachments
- [ ] Voice/video calls (optional)

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Master Node database |
| Redis | 6379 | Session storage |
| CouchDB-1 | 5984 | Standard Node 1 storage |
| CouchDB-2 | 5985 | Standard Node 2 storage |
| CouchDB-3 | 5986 | Standard Node 3 storage |

## 📚 Documentation

- [Architecture Plan](untitled:plan-decentralizedMessagingPlatform.prompt.md)
- [Standard Node README](packages/standard-node/README.md)

## 🤝 Contributing

This project is currently in early development. Contributions will be welcome once the MVP is complete.

## 📄 License

TBD

## 🔗 Links

- Master Node: http://localhost:3000
- WebSocket: ws://localhost:3000/ws
- Web Client: http://localhost:5173
- CouchDB Admin: http://localhost:5984/_utils
