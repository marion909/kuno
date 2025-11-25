# Master Node Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace root package.json
COPY package*.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy master-node package
COPY packages/master-node ./packages/master-node

# Install dependencies from root
RUN npm install

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build master-node
WORKDIR /app/packages/master-node
RUN npm run build

# Production stage
FROM node:18-alpine

ENV NODE_PATH=/app/node_modules

WORKDIR /app

# Copy node_modules and built code maintaining structure
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["node", "packages/master-node/dist/index.js"]
