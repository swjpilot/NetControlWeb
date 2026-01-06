# Multi-stage build for NetControl Web Application
FROM node:18-alpine AS client-build

# Build the React client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production
COPY client/ ./
RUN npm run build

# Production server stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Copy server package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install server dependencies
RUN npm ci --only=production

# Copy server source
COPY server/ ./server/

# Copy built client from previous stage
COPY --from=client-build /app/client/build ./client/build

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S netcontrol -u 1001

# Change ownership of app directory
RUN chown -R netcontrol:nodejs /app
USER netcontrol

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/index.js"]