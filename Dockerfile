# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p data

# Initialize database
RUN npm run db:init && npm run db:seed

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S attendancems -u 1001

# Change ownership of app directory
RUN chown -R attendancems:nodejs /app
USER attendancems

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]