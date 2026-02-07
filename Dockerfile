# Build stage for client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source
COPY client/ ./

# Build client
RUN npm run build

# Production stage
FROM node:20-alpine

# Install Puppeteer dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chromium. We'll use the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy server package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy server source
COPY server/ ./server/

# Copy built client from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create directories for data and uploads
RUN mkdir -p /app/data /app/uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/db.sqlite
ENV UPLOAD_DIR=/app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/templates || exit 1

# Start the application
CMD ["node", "server/index.js"]
