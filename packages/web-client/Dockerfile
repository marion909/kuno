# Web Client Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace root
COPY package*.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy web-client
COPY packages/web-client ./packages/web-client

# Install all dependencies
RUN npm install

# Build shared
WORKDIR /app/packages/shared
RUN npm run build

# Build web-client
WORKDIR /app/packages/web-client
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/web-client/dist /usr/share/nginx/html

# Copy nginx config
COPY packages/web-client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
