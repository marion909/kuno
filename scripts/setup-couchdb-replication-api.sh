#!/bin/bash
# CouchDB Replication Setup Script using _replicate API
# This avoids the local_endpoints_not_supported error

set -e

echo "🔧 Setting up CouchDB Replication via _replicate API..."
echo ""

# Wait for CouchDB instances
echo "⏳ Waiting for CouchDB instances..."
for i in 1 2 3; do
  until curl -sf "http://couchdb-$i:5984/_up" > /dev/null; do
    sleep 2
  done
  echo "✓ couchdb-$i is ready"
done

echo ""
echo "🔄 Setting up continuous replication..."

# Node 1 -> Node 2
echo "Setting up Node 1 -> Node 2"
docker exec kuno-couchdb-1 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-2:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

# Node 2 -> Node 1
echo "Setting up Node 2 -> Node 1"
docker exec kuno-couchdb-2 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-1:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

# Node 2 -> Node 3
echo "Setting up Node 2 -> Node 3"
docker exec kuno-couchdb-2 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-3:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

# Node 3 -> Node 2
echo "Setting up Node 3 -> Node 2"
docker exec kuno-couchdb-3 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-2:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

# Node 1 -> Node 3
echo "Setting up Node 1 -> Node 3"
docker exec kuno-couchdb-1 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-3:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

# Node 3 -> Node 1
echo "Setting up Node 3 -> Node 1"
docker exec kuno-couchdb-3 bash -c 'curl -X POST http://admin:$COUCHDB_PASSWORD@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"messages\", \"target\": \"http://admin:$COUCHDB_PASSWORD@couchdb-1:5984/messages\", \"continuous\": true, \"create_target\": false}"'
echo ""

echo "✅ CouchDB Replication setup complete!"
echo ""
echo "📊 Active replications:"
docker exec kuno-couchdb-1 bash -c 'curl -s http://admin:$COUCHDB_PASSWORD@localhost:5984/_active_tasks | grep -i replication' || echo "Check _active_tasks API for replication status"
echo ""
