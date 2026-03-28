FROM node:20-slim AS builder

# Install ffmpeg for video composition
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json

# Install backend dependencies only
RUN npm ci --workspace=backend --include-workspace-root

# Copy backend source
COPY backend/ backend/

# Build TypeScript
RUN npm run build --workspace=backend

# Copy migrations to dist (they're loaded at runtime)
RUN cp -r backend/src/db/migrations backend/dist/db/migrations

# --- Production stage ---
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json

RUN npm ci --workspace=backend --include-workspace-root --omit=dev

COPY --from=builder /app/backend/dist backend/dist

# Create uploads directory (will be mounted as persistent volume)
RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV PORT=8080
ENV UPLOADS_DIR=/data/uploads

EXPOSE 8080

CMD ["node", "backend/dist/index.js"]
