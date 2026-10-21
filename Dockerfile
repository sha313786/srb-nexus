# ==========================================
# STAGE 1: Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json tailwind.config.js ./

# Install dependencies for compilation
RUN npm ci

# Copy static assets and source files
COPY public ./public
COPY src ./src

# Compile TypeScript to JavaScript and copy assets
RUN npm run build

# Prune devDependencies for a lean production footprint
RUN npm prune --production

# ==========================================
# STAGE 2: Production Runtime Environment
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install system libraries for @napi-rs/canvas and health check utilities
RUN apk add --no-cache libc6-compat wget ca-certificates

# Security: Create non-root system user
RUN addgroup -S nexusgroup && adduser -S nexususer -G nexusgroup

# Copy compiled artifacts, public assets, and production dependencies
COPY --chown=nexususer:nexusgroup package*.json ./
COPY --chown=nexususer:nexusgroup --from=builder /app/node_modules ./node_modules
COPY --chown=nexususer:nexusgroup --from=builder /app/dist ./dist
COPY --chown=nexususer:nexusgroup --from=builder /app/public ./public

# Switch to non-privileged user
USER nexususer

# Expose Fastify REST API port
EXPOSE 3000

# Health check to monitor container status
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start Application Engine
CMD ["node", "dist/index.js"]
