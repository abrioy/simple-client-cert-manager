# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy frontend package files
COPY client/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY client/ ./

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --production

# Copy server source
COPY server/ ./

# Copy built frontend
COPY --from=frontend-builder /app/client/dist /app/client/dist

# Create directories for certificates and data
RUN mkdir -p /certs /data/certs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV CERT_DIR=/certs
ENV DATA_DIR=/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/user', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "index.js"]
