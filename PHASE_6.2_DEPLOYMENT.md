# Phase 6.2: CouchDB Multi-Master Replication - Deployment Guide

## Overview
Phase 6.2 implements distributed message storage using CouchDB multi-master replication. Messages are stored across 3 Standard Nodes with automatic bidirectional replication.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────▶│ Master Node  │────▶│Standard Node1│
│ (Web/Mobile)│     │  (Node.js)   │     │    (Go)      │
└─────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            │              ┌──────▼──────┐
                            │              │  CouchDB 1  │
                            │              └──────┬──────┘
                            │                     │
                            ├─────────────────────┤
                            │                     │
                    ┌───────▼────────┐    ┌──────▼──────┐
                    │Standard Node 2 │────│  CouchDB 2  │
                    │     (Go)       │    └──────┬──────┘
                    └───────┬────────┘           │
                            │            Replication
                    ┌───────▼────────┐           │
                    │Standard Node 3 │    ┌──────▼──────┐
                    │     (Go)       │────│  CouchDB 3  │
                    └────────────────┘    └─────────────┘
```

## Components Changed

### 1. Standard Node (Go)
- **File**: `packages/standard-node/cmd/main.go`
- **Changes**: 
  - Added CouchDB connection via Kivik client
  - Updated Message struct to match Master Node format
  - Added message handler routes
- **File**: `packages/standard-node/cmd/handlers.go` (NEW)
- **Functions**:
  - `POST /messages` - Store encrypted message with 30-day TTL
  - `GET /messages/:userId` - Retrieve messages for user, filter expired
  - `DELETE /messages/:id` - Delete message after retrieval

### 2. Master Node (Node.js/TypeScript)
- **File**: `packages/master-node/src/config.ts`
- **Changes**: Added Standard Node URL configuration
- **File**: `packages/master-node/src/routes/websocket.ts`
- **Function**: `storeMessageInStandardNodes()` - Already implemented
- **Behavior**: Forwards all messages to all 3 Standard Nodes for redundancy

### 3. Web Client (React)
- **File**: `packages/web-client/src/services/standardNode.ts` (NEW)
- **Service**: `standardNodeService` - API client for Standard Nodes
- **Functions**:
  - `getMessagesForUser()` - Fetch from all nodes, deduplicate
  - `deleteMessage()` - Remove from all nodes after retrieval
- **File**: `packages/web-client/src/stores/chatStore.ts`
- **Changes**: 
  - Added `fetchStoredMessages()` function
  - Called on chat initialization
  - Decrypts and displays offline messages

### 4. CouchDB Replication
- **File**: `scripts/setup-couchdb-replication.sh`
- **Creates**: 6 continuous bidirectional replications
  - Node 1 ↔ Node 2
  - Node 2 ↔ Node 3
  - Node 1 ↔ Node 3
- **Indexes**: Creates `recipient-timestamp-index` on all nodes

### 5. Docker Configuration
- **File**: `docker-compose.prod.yml`
- **Changes**:
  - Master Node: Added Standard Node URL env vars
  - Web Client: Added Standard Node URL build args
  - Added `couchdb-replication` service (runs once)
- **File**: `packages/web-client/Dockerfile`
- **Changes**: Added Standard Node URL env vars for build
- **File**: `packages/web-client/nginx.conf`
- **Changes**: Added proxy routes `/node1/`, `/node2/`, `/node3/`

## Environment Variables

Add to `.env` file (or on production server):

```bash
# Standard Nodes (internal Docker network)
STANDARD_NODE_1_URL=http://standard-node-1:4001
STANDARD_NODE_2_URL=http://standard-node-2:4002
STANDARD_NODE_3_URL=http://standard-node-3:4003

# Domain (used in docker-compose)
DOMAIN=npanel.at
```

## Deployment Steps

### 1. Local Testing (Optional)

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up --build

# Check CouchDB replication status
docker exec -it kuno-couchdb-1 curl -s http://admin:password@localhost:5984/_replicator/_all_docs?include_docs=true | jq

# Check Standard Node health
curl http://localhost/node1/health
curl http://localhost/node2/health
curl http://localhost/node3/health

# Send test message and verify storage
# 1. Register and login via Web Client
# 2. Send message to another user
# 3. Check CouchDB: docker exec -it kuno-couchdb-1 curl -s http://admin:password@localhost:5984/messages/_all_docs
```

### 2. Production Deployment

```bash
# 1. Push code to GitHub
git add .
git commit -m "feat: Phase 6.2 - CouchDB Multi-Master Replication"
git push origin main

# 2. SSH to production server
ssh root@npanel-main

# 3. Pull latest changes
cd /opt/kuno
git pull

# 4. Update .env file with Standard Node URLs
nano .env
# Add:
STANDARD_NODE_1_URL=http://standard-node-1:4001
STANDARD_NODE_2_URL=http://standard-node-2:4002
STANDARD_NODE_3_URL=http://standard-node-3:4003
DOMAIN=npanel.at

# 5. Rebuild and restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up --build -d

# 6. Verify services
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f couchdb-replication
docker-compose -f docker-compose.prod.yml logs -f master-node
docker-compose -f docker-compose.prod.yml logs standard-node-1
```

### 3. Verify Replication

```bash
# Check replication status on each node
docker exec kuno-couchdb-1 curl -s http://admin:${COUCHDB_PASSWORD}@localhost:5984/_replicator/_all_docs?include_docs=true | jq '.rows[].doc | {id: ._id, state: .state}'

# Create test document on Node 1
docker exec kuno-couchdb-1 curl -X POST http://admin:${COUCHDB_PASSWORD}@localhost:5984/messages \
  -H "Content-Type: application/json" \
  -d '{"id":"test-123","recipientId":"test-user","ciphertext":"test"}'

# Verify it replicated to Node 2 and 3
docker exec kuno-couchdb-2 curl -s http://admin:${COUCHDB_PASSWORD}@localhost:5984/messages/test-123
docker exec kuno-couchdb-3 curl -s http://admin:${COUCHDB_PASSWORD}@localhost:5984/messages/test-123

# Clean up test
docker exec kuno-couchdb-1 curl -X DELETE http://admin:${COUCHDB_PASSWORD}@localhost:5984/messages/test-123?rev=<rev>
```

### 4. Monitor Logs

```bash
# Master Node (message forwarding)
docker-compose -f docker-compose.prod.yml logs -f master-node | grep "Message routed"

# Standard Nodes (message storage)
docker-compose -f docker-compose.prod.yml logs -f standard-node-1 | grep "POST /messages"

# CouchDB (replication)
docker-compose -f docker-compose.prod.yml logs -f couchdb-1 | grep "replicator"
```

## Testing Scenarios

### Scenario 1: Online Message Delivery
1. User A sends message to User B
2. User B is online (WebSocket connected)
3. **Expected**: Message delivered via WebSocket AND stored in CouchDB
4. **Verify**: User B receives message immediately, message exists in all 3 CouchDB nodes

### Scenario 2: Offline Message Storage
1. User A sends message to User B
2. User B is offline (no WebSocket connection)
3. **Expected**: Message stored in all 3 CouchDB nodes
4. **Verify**: 
   - `GET /node1/messages/<user-b-id>` returns the message
   - Message exists on all 3 nodes (check replication)

### Scenario 3: Offline Message Retrieval
1. User B comes online (opens Web Client)
2. Web Client calls `fetchStoredMessages()` on initialization
3. **Expected**: Messages retrieved, decrypted, displayed, then deleted
4. **Verify**:
   - Messages appear in User B's chat
   - `GET /node1/messages/<user-b-id>` returns empty array

### Scenario 4: Node Failure Resilience
1. Stop one Standard Node: `docker stop kuno-standard-node-1`
2. Send messages
3. **Expected**: Messages still stored in Node 2 and 3
4. Restart Node 1: `docker start kuno-standard-node-1`
5. **Expected**: Replication syncs messages to Node 1
6. **Verify**: All nodes have same messages

### Scenario 5: Message TTL (30 Days)
1. Create test message with `expiresAt` set to past timestamp
2. Call `GET /messages/:userId`
3. **Expected**: Expired message not returned, automatically deleted
4. **Verify**: Message removed from CouchDB

## Troubleshooting

### Replication Not Working
```bash
# Check replication status
docker exec kuno-couchdb-1 curl -s http://admin:password@localhost:5984/_replicator/_all_docs?include_docs=true | jq

# Look for "error" or "failed" state
# If replication failed, delete and recreate:
docker-compose -f docker-compose.prod.yml restart couchdb-replication
```

### Standard Node Connection Refused
```bash
# Check if Standard Nodes are running
docker-compose -f docker-compose.prod.yml ps | grep standard-node

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs standard-node-1

# Test connection from Master Node container
docker exec kuno-master-node wget -qO- http://standard-node-1:4001/health
```

### Messages Not Retrieved on Web Client
```bash
# Check browser console for errors
# Verify Standard Node URLs in web client
docker-compose -f docker-compose.prod.yml logs nginx | grep node1

# Test nginx proxy
curl https://npanel.at/node1/health
curl https://npanel.at/node2/health
curl https://npanel.at/node3/health
```

### CouchDB Index Missing
```bash
# Manually create index
docker exec kuno-couchdb-1 curl -X POST http://admin:password@localhost:5984/messages/_index \
  -H "Content-Type: application/json" \
  -d '{"index":{"fields":["recipientId","timestamp"]},"name":"recipient-timestamp-index","type":"json"}'
```

## Performance Considerations

### Query Optimization
- Index on `recipientId` and `timestamp` enables fast queries
- Expired messages automatically cleaned up on query

### Replication Performance
- Continuous replication has minimal latency (< 1s)
- CouchDB handles conflicts automatically (MVCC)
- Network partitions heal automatically when connectivity restored

### Load Balancing
- Master Node tries all 3 Standard Nodes (parallel storage)
- Web Client tries all 3 Standard Nodes (retrieves from first successful)
- Single node failure doesn't affect availability

## Security

### CouchDB Authentication
- Admin user with password from `.env`
- No external exposure (only internal Docker network)

### Message Encryption
- Messages stored as encrypted ciphertext
- CouchDB never sees plaintext
- Decryption only in client after retrieval

### Message Deletion
- Messages deleted after successful retrieval
- 30-day TTL as backup (privacy by design)

## Rollback Plan

If issues occur in production:

```bash
# 1. Revert to previous code
git checkout <previous-commit>

# 2. Rebuild without Standard Nodes
docker-compose -f docker-compose.prod.yml up --build -d master-node nginx

# 3. Messages will be delivered via WebSocket only (no persistence)

# 4. To restore:
git checkout main
docker-compose -f docker-compose.prod.yml up --build -d
```

## Next Steps

After Phase 6.2 is successfully deployed:

1. **Phase 1**: Encrypted Key Backup & Recovery
2. **Phase 7**: Quick wins (typing indicators, read receipts)
3. **Phase 5**: Expo Mobile App
4. **Phase 2**: Multi-Device Sync
5. **Phase 3**: Group Chats
6. **Phase 4**: Media & File Sharing

## Metrics to Monitor

- CouchDB replication lag: `_replicator` status
- Standard Node message count: `GET /messages/:userId` response count
- Message delivery success rate: Master Node logs
- Node availability: Health check endpoints

## Documentation Updates

After successful deployment, update:
- `README.md` - Add CouchDB replication section
- `ARCHITECTURE.md` - Document distributed storage
- `.env.production.example` - Add Standard Node URLs
