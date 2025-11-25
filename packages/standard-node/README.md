# Standard Node

Go-based Standard Node for Kuno messaging platform. Handles encrypted message storage with CouchDB replication.

## Setup

```bash
# Install dependencies
go mod download

# Copy environment variables
cp .env.example .env

# Run
go run cmd/main.go
```

## Environment Variables

- `NODE_ID`: Unique identifier for this node (e.g., node-1)
- `PORT`: HTTP server port (default: 4001)
- `COUCHDB_URL`: CouchDB instance URL
- `COUCHDB_USER`: CouchDB admin username
- `COUCHDB_PASSWORD`: CouchDB admin password
- `COUCHDB_DB`: Database name for messages
- `MASTER_NODE_URL`: Master Node URL for registration

## Endpoints

- `GET /health` - Health check
- `POST /messages` - Store encrypted message
- `GET /messages?userId=X&since=timestamp` - Retrieve messages
