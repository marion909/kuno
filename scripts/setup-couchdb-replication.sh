#!/bin/bash
# CouchDB Replication Setup Script
# Sets up bidirectional continuous replication between all 3 CouchDB nodes

set -e

COUCHDB_USER="admin"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-admin}"

COUCH1="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-1:5984"
COUCH2="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-2:5984"
COUCH3="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@couchdb-3:5984"

DB_NAME="messages"

echo "🔧 Setting up CouchDB Replication..."

# Wait for CouchDB instances to be ready
echo "⏳ Waiting for CouchDB instances..."
for i in 1 2 3; do
  until curl -sf "http://couchdb-$i:5984/_up" > /dev/null; do
    echo "Waiting for couchdb-$i..."
    sleep 2
  done
  echo "✓ couchdb-$i is ready"
done

# Create database on all nodes
echo "📦 Creating '$DB_NAME' database on all nodes..."
for COUCH in "$COUCH1" "$COUCH2" "$COUCH3"; do
  curl -X PUT "$COUCH/$DB_NAME" || echo "Database may already exist"
done

echo ""
echo "📦 Ensuring _replicator database exists..."
curl -X PUT "$COUCH1/_replicator" 2>/dev/null || true
curl -X PUT "$COUCH2/_replicator" 2>/dev/null || true
curl -X PUT "$COUCH3/_replicator" 2>/dev/null || true

echo ""
# Setup bidirectional replication
# Node 1 <-> Node 2
echo "🔄 Setting up replication: Node 1 <-> Node 2"
curl -X PUT "$COUCH1/_replicator/node1-to-node2" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH2/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

curl -X PUT "$COUCH2/_replicator/node2-to-node1" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH1/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

# Node 2 <-> Node 3
echo "🔄 Setting up replication: Node 2 <-> Node 3"
curl -X PUT "$COUCH2/_replicator/node2-to-node3" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH3/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

curl -X PUT "$COUCH3/_replicator/node3-to-node2" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH2/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

# Node 1 <-> Node 3
echo "🔄 Setting up replication: Node 1 <-> Node 3"
curl -X PUT "$COUCH1/_replicator/node1-to-node3" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH3/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

curl -X PUT "$COUCH3/_replicator/node3-to-node1" \
  -H "Content-Type: application/json" \
  -d "{
    \"source\": \"$DB_NAME\",
    \"target\": \"$COUCH1/$DB_NAME\",
    \"continuous\": true,
    \"create_target\": false
  }"

echo "✅ CouchDB Replication setup complete!"
echo ""
echo "📊 Checking replication status..."
curl -s "$COUCH1/_replicator/_all_docs?include_docs=true" | jq '.rows[].doc | {id: ._id, state: .state}'

echo ""
echo "🔧 Creating indexes for efficient queries..."
echo ""

# Create index on recipientId for all nodes
for node_url in "$COUCH1" "$COUCH2" "$COUCH3"; do
  echo "Creating index on $node_url..."
  curl -X POST "$node_url/$DB_NAME/_index" \
    -H "Content-Type: application/json" \
    -d '{
      "index": {
        "fields": ["recipientId", "timestamp"]
      },
      "name": "recipient-timestamp-index",
      "type": "json"
    }' 2>/dev/null || echo "Index may already exist"
  echo ""
done

echo ""
echo "🎉 All done! Messages database is now replicated across all 3 nodes with optimized indexes."
