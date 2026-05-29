# ─── Multi-stage Dockerfile for Team Task Tracker API ─────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Prisma schema and migrations for runtime
COPY --from=builder /app/src/prisma ./src/prisma

# Copy node_modules with Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Re-generate Prisma client in production stage to match the platform
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership of app files to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
