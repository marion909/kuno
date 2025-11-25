#!/bin/bash
set -e

# Wait for CouchDB instances to be ready
wait_for_couchdb() {
  local node_url=$1
  local max_attempts=30
  local attempt=0
  
  echo "Waiting for $node_url to be ready..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -f -s "$node_url/_up" > /dev/null 2>&1; then
      echo "✅ $node_url is ready"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  echo "❌ Timeout waiting for $node_url"
  return 1
}

# CouchDB credentials
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-admin}"

# CouchDB node URLs
COUCHDB_1="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-1:5984"
COUCHDB_2="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-2:5984"
COUCHDB_3="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-3:5984"

# Wait for all nodes
wait_for_couchdb "$COUCHDB_1"
wait_for_couchdb "$COUCHDB_2"
wait_for_couchdb "$COUCHDB_3"

echo ""
echo "🔧 Creating indexes for efficient queries..."
echo ""

# Create index on recipientId for all nodes
create_index() {
  local node_url=$1
  local node_name=$2
  
  echo "Creating index on $node_name..."
  
  curl -X POST "$node_url/messages/_index" \
    -H "Content-Type: application/json" \
    -d '{
      "index": {
        "fields": ["recipientId", "timestamp"]
      },
      "name": "recipient-timestamp-index",
      "type": "json"
    }' || echo "Index may already exist on $node_name"
  
  echo "✅ Index created on $node_name"
}

create_index "$COUCHDB_1" "Node 1"
create_index "$COUCHDB_2" "Node 2"
create_index "$COUCHDB_3" "Node 3"

echo ""
echo "✅ CouchDB indexes created successfully!"
echo ""
