# Phase 24: Production Deployment

**Objective:** Deployment aplikasi ke production (Nginx, SSL, monitoring, backup)  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 23 selesai

---

## Tasks

### 24.1 Create Production Docker Compose

```bash
# docker/production/docker-compose.prod.yml
cat > docker/production/docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: payrollpro-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./next-assets:/var/www/payrollpro:ro
    depends_on:
      - web
      - gateway
    networks:
      - payrollpro
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    container_name: payrollpro-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - payrollpro

  web:
    build:
      context: ../../
      dockerfile: apps/web/Dockerfile.prod
    container_name: payrollpro-web
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://payroll.example.com/api
      - NEXT_PUBLIC_WS_URL=wss://payroll.example.com/ws
    expose:
      - "3000"
    depends_on:
      - gateway
    networks:
      - payrollpro
    restart: unless-stopped

  gateway:
    build:
      context: ../../
      dockerfile: apps/gateway/Dockerfile
    container_name: payrollpro-gateway
    environment:
      - NODE_ENV=production
      - AUTH_SERVICE_URL=http://auth-service:3003
      - EMPLOYEE_SERVICE_URL=http://employee-service:3004
      - PAYROLL_SERVICE_URL=http://payroll-service:3005
      - ATTENDANCE_SERVICE_URL=http://attendance-service:3006
      - LEAVE_SERVICE_URL=http://leave-service:3007
      - SOCIAL_SERVICE_URL=http://social-service:3008
      - SHIFT_SERVICE_URL=http://shift-service:3009
    expose:
      - "3001"
    depends_on:
      - auth-service
      - employee-service
      - payroll-service
      - attendance-service
      - leave-service
      - social-service
      - shift-service
    networks:
      - payrollpro
    restart: unless-stopped

  auth-service:
    build:
      context: ../../
      dockerfile: apps/auth-service/Dockerfile
    container_name: payrollpro-auth-service
    environment:
      - NODE_ENV=production
      - PORT=3003
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    expose:
      - "3003"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  employee-service:
    build:
      context: ../../
      dockerfile: apps/employee-service/Dockerfile
    container_name: payrollpro-employee-service
    environment:
      - NODE_ENV=production
      - PORT=3004
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3004"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  payroll-service:
    build:
      context: ../../
      dockerfile: apps/payroll-service/Dockerfile
    container_name: payrollpro-payroll-service
    environment:
      - NODE_ENV=production
      - PORT=3005
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3005"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  attendance-service:
    build:
      context: ../../
      dockerfile: apps/attendance-service/Dockerfile
    container_name: payrollpro-attendance-service
    environment:
      - NODE_ENV=production
      - PORT=3006
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3006"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  leave-service:
    build:
      context: ../../
      dockerfile: apps/leave-service/Dockerfile
    container_name: payrollpro-leave-service
    environment:
      - NODE_ENV=production
      - PORT=3007
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3007"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  social-service:
    build:
      context: ../../
      dockerfile: apps/social-service/Dockerfile
    container_name: payrollpro-social-service
    environment:
      - NODE_ENV=production
      - PORT=3008
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3008"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  shift-service:
    build:
      context: ../../
      dockerfile: apps/shift-service/Dockerfile
    container_name: payrollpro-shift-service
    environment:
      - NODE_ENV=production
      - PORT=3009
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/payrollpro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    expose:
      - "3009"
    depends_on:
      - postgres
      - redis
    networks:
      - payrollpro
    restart: unless-stopped

  websocket:
    build:
      context: ../../
      dockerfile: apps/websocket/Dockerfile
    container_name: payrollpro-websocket
    environment:
      - NODE_ENV=production
      - PORT=3002
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    expose:
      - "3002"
    depends_on:
      - redis
      - social-service
    networks:
      - payrollpro
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: payrollpro-postgres
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=payrollpro
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
    expose:
      - "5432"
    networks:
      - payrollpro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: payrollpro-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    expose:
      - "6379"
    networks:
      - payrollpro
    restart: unless-stopped

  pgbackups:
    image: prodrigestivill/postgres-backup-local
    container_name: payrollpro-pgbackups
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=payrollpro
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - SCHEDULE=@daily
      - BACKUP_DIR=/backups
      - BACKUP_KEEP_DAYS=7
      - BACKUP_KEEP_WEEKS=4
      - BACKUP_KEEP_MONTHS=6
    volumes:
      - ./backups:/backups
    depends_on:
      - postgres
    networks:
      - payrollpro
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    container_name: payrollpro-watchtower
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_SCHEDULE=0 0 3 * * *
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  payrollpro:
    driver: bridge
EOF

# Create production .env file
cp .env.example .env.production
```

### 24.2 Create Nginx Reverse Proxy Config

```bash
# docker/production/nginx/conf.d/payrollpro.conf
cat > docker/production/nginx/conf.d/payrollpro.conf << 'EOF'
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name payroll.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name payroll.example.com;

    ssl_certificate /etc/letsencrypt/live/payroll.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/payroll.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https:; connect-src 'self' wss: https:; font-src 'self' data:;" always;

    client_max_body_size 10M;

    # Next.js frontend
    location / {
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API gateway
    location /api/ {
        proxy_pass http://gateway:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # WebSocket (DM realtime, notification)
    location /ws/ {
        proxy_pass http://websocket:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

# Validate Nginx config
docker exec payrollpro-nginx nginx -t
```

### 24.3 Issue SSL Certificate with Certbot

```bash
# Initial certificate issuance (run once)
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d payroll.example.com \
  --email admin@example.com \
  --agree-tos \
  --no-eff-email

# Verify certificate
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  certbot/certbot certificates
```

### 24.4 Create Frontend Production Dockerfile

```bash
# apps/web/Dockerfile.prod
cat > apps/web/Dockerfile.prod << 'EOF'
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/gateway/package.json ./apps/gateway/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY pnpm-workspace.yaml ./
COPY apps/web/ ./apps/web
RUN pnpm --filter @payrollpro/web build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
EOF
```

### 24.5 Verify Production Build

```bash
# Build all images
docker-compose -f docker/production/docker-compose.prod.yml build --no-cache

# Check config
docker-compose -f docker/production/docker-compose.prod.yml config
```

### 24.6 Hardening & Security Checklist

1. **JWT Secret** - gunakan secret yang kuat (`openssl rand -base64 48`) di `.env.production`, jangan pakai default.
2. **Database** - set password kuat untuk `DB_PASSWORD`; jangan pernah pakai `postgres`.
3. **Redis** - aktifkan `requirepass` dengan `REDIS_PASSWORD` kuat.
4. **Rate limiting** - gateway: 100 req/min per IP; endpoint auth login: 5 percobaan/menit.
5. **CORS** - batasi origin hanya domain production.
6. **Helmet** - aktifkan semua security headers di Fastify & Nginx.
7. **Docker non-root** - jalankan service sebagai user `node` (bukan root) di Dockerfile.
8. **Drop capabilities** - gunakan `cap_drop: [ALL]` pada service.
9. **Backup** - verifikasi backup harian PostgreSQL berjalan.
10. **Monitoring** - aktifkan healthcheck endpoints di semua service.

### 24.7 Deployment Runbook

```bash
# 1. Set environment
export $(grep -v '^#' .env.production | xargs)

# 2. Start the stack
docker-compose -f docker/production/docker-compose.prod.yml up -d

# 3. Run database migrations
docker-compose -f docker/production/docker-compose.prod.yml exec backend npx drizzle-kit push
docker-compose -f docker/production/docker-compose.prod.yml exec backend npx tsx src/seeds/admin.ts

# 4. Verify services are healthy
docker-compose -f docker/production/docker-compose.prod.yml ps
curl -s http://localhost:3001/health | jq

# 5. Verify frontend
curl -sI https://payroll.example.com | head -20

# 6. Check logs for errors
docker-compose -f docker/production/docker-compose.prod.yml logs -f --tail=100 gateway postgres
```

### 24.8 Monitoring & Operations

```bash
# Container logs (all services)
docker-compose logs -f

# Resource usage
docker stats

# Manual DB backup
docker exec payrollpro-postgres pg_dump -U postgres payrollpro | gzip > /backups/manual-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore DB
gzip -dc your-backup.sql.gz | docker exec -i payrollpro-postgres psql -U postgres payrollpro

# Check storage
df -h /var/lib/docker
```

Production healthcheck URL:
```
http://localhost:3001/health
http://localhost:3000 (frontend)
```

---

## Verification Checklist

- [ ] HTTPS aktif (certbot issued + renewed)
- [ ] HTTP redirect ke HTTPS
- [ ] Frontend diakses via https://payroll.example.com
- [ ] Semua service healthy di docker ps
- [ ] Backup harian berjalan
- [ ] Healthcheck endpoint 200
- [ ] Auto-deploy via watchtower (opsional)
- [ ] Logging tidak ada error
- [ ] Monitoring resource normal
- [ ] Data test seed berhasil

---

## Selesai 🎉

Seluruh 25 fase (Phase 00-24) telah selesai. Aplikasi **PayrollPro** siap digunakan untuk demo PKL.

**Rangkuman akhir:**
| Bagian | Fase | Jam Estimasi |
|--------|------|--------------|
| Env & Struktur | 00-01 | 6-8 |
| Database | 02 | 10-12 |
| Backend Services | 03-10 | 70-90 |
| Frontend | 11-22 | 90-120 |
| Testing | 23 | 10-14 |
| Production | 24 | 8-10 |
| **Total** | **25 fase** | **194-254 jam** |