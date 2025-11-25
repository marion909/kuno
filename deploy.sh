#!/bin/bash

# Kuno Deployment Script

set -e

echo "🚀 Deploying Kuno Messaging Platform..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production not found!"
    echo "📝 Copy .env.production.example to .env.production and fill in your secrets"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop old containers
echo "🛑 Stopping old containers..."
docker-compose -f docker-compose.prod.yml down

# Start new containers
echo "▶️  Starting containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Show status
echo "📊 Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo "🌐 Access your application at: http://${DOMAIN}"
echo ""
echo "📝 Next steps:"
echo "  1. Configure SSL certificates (Let's Encrypt)"
echo "  2. Set up firewall rules"
echo "  3. Configure backup strategy"
