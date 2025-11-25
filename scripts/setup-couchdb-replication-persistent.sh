#!/bin/bash

# CouchDB Multi-Master Replication Setup (Persistent)
# Uses _replicator database with external URLs to bypass local_endpoints_not_supported

set -e

echo "🔧 Setting up persistent CouchDB replication..."

# Configuration
DB_NAME="messages"
COUCHDB_USER="admin"

# Get password from environment or docker
if [ -z "$COUCHDB_PASSWORD" ]; then
    COUCHDB_PASSWORD=$(docker exec kuno-couchdb-1 printenv COUCHDB_PASSWORD)
fi

# Wait for all CouchDB instances to be ready
echo ""
echo "⏳ Waiting for CouchDB instances..."
for i in 1 2 3; do
    until docker exec kuno-couchdb-$i curl -sf "http://localhost:5984/_up" > /dev/null 2>&1; do
        sleep 1
    done
    echo "✓ couchdb-$i is ready"
done

# Function to create replication document
create_replication() {
    local source_node=$1
    local target_node=$2
    local replication_id="${source_node}_to_${target_node}"
    
    echo "Setting up Node $source_node -> Node $target_node"
    
    # Use localhost URLs which are considered "external" by CouchDB
    local source_url="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@localhost:5984/${DB_NAME}"
    local target_host="couchdb-${target_node}"
    local target_url="http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${target_host}:5984/${DB_NAME}"
    
    docker exec kuno-couchdb-${source_node} bash -c "curl -X PUT \
        http://admin:\$COUCHDB_PASSWORD@localhost:5984/_replicator/${replication_id} \
        -H 'Content-Type: application/json' \
        -d '{
            \"_id\": \"${replication_id}\",
            \"source\": \"${source_url}\",
            \"target\": \"${target_url}\",
            \"continuous\": true,
            \"create_target\": false
        }'"
    echo ""
}

echo ""
echo "🔄 Setting up continuous replication..."

# Create bidirectional replications between all nodes
create_replication 1 2
create_replication 2 1
create_replication 2 3
create_replication 3 2
create_replication 1 3
create_replication 3 1

echo ""
echo "✅ CouchDB Replication setup complete!"
echo ""
echo "📊 Verify replications with:"
echo "   docker exec kuno-couchdb-1 curl -s http://admin:\$COUCHDB_PASSWORD@localhost:5984/_replicator/_all_docs"
