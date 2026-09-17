FROM postgres:16-alpine

# Install additional extensions
RUN apk add --no-cache curl

# Create init script directory
RUN mkdir -p /docker-entrypoint-initdb.d

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD pg_isready -U postgres

# Expose port
EXPOSE 5432
