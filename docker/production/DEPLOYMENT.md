# PayrollPro - Production Deployment

Deploy microservices payroll dengan Docker Compose + Nginx reverse proxy + SSL (certbot) + backup PostgreSQL otomatis.

## Prasyarat

- Server Linux (tested: Arch Linux) dengan Docker Engine + Docker Compose v2
- Domain sudah mengarah ke IP server (contoh: `payroll.example.com`)
- Port `80` dan `443` terbuka dari internet

## 1. Siapkan Environment

```bash
cd /home/ray/Projects/PayRoll

# Buat .env.production dari template
cp .env.production.example .env.production

# Generate secret kuat
openssl rand -base64 48        # untuk JWT_SECRET & JWT_REFRESH_SECRET
openssl rand -hex 24           # untuk DB_PASSWORD
openssl rand -hex 24           # untuk REDIS_PASSWORD

# Edit .env.production lalu isi semua value
vi .env.production
```

> ⚠️ Jangan pernah pakai password default/lemah. Jangan commit `.env.production` ke git (guard: `.gitignore`).

## 2. Verifikasi Konfigurasi

```bash
cd docker/production

# Validasi compose file (harus OK)
docker compose --env-file ../../.env.production -f docker-compose.prod.yml config --quiet

# Build semua image (pertama kali ± 5-15 menit)
docker compose --env-file ../../.env.production -f docker-compose.prod.yml build
```

## 3. Issue SSL Certificate (Pertama Kali)

```bash
cd docker/production

# Start postgres, redis, web, dan nginx dulu (tanpa certbot cert)
docker compose --env-file ../../.env.production -f docker-compose.prod.yml up -d nginx web api-gateway websocket auth-service employee-service payroll-service attendance-service leave-service social-service shift-service postgres redis

# Issue certificate via webroot di nginx
docker compose --env-file ../../.env.production -f docker-compose.prod.yml exec nginx mkdir -p /var/www/certbot

docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$(grep '^DOMAIN=' ../../.env.production | cut -d= -f2)" \
  --email admin@example.com \
  --agree-tos \
  --no-eff-email

# Verifikasi sertifikat
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" certbot/certbot certificates
```

> Pastikan nama domain di `nginx/conf.d/payrollpro.conf` (`server_name`) sama dengan `DOMAIN` di `.env.production`.
> Auto-renewal ditangani oleh container `certbot`.

## 4. Start Stack Penuh

```bash
cd docker/production
docker compose --env-file ../../.env.production -f docker-compose.prod.yml up -d

# Cek status semua container
docker compose -f docker-compose.prod.yml ps
```

## 5. Migrasi Database & Seed Admin

Jalankan dari host (bukan dalam container) dengan `DATABASE_URL` diarahkan ke DB production:

```bash
cd /home/ray/Projects/PayRoll

# Ekspor konfigurasi production
export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost:5432/payrollpro"

# Migration schema
pnpm db:migrate

# Seed user admin
pnpm db:seed
```

> Alternatif tanpa mengexpose port DB ke host:
> `docker compose -f docker/production/docker-compose.prod.yml exec -e DATABASE_URL=... <nama-service-tools> npm run ...`

## 6. Verifikasi Deployment

```bash
# Semua service healthy?
docker ps

# Healthcheck gateway
curl -s https://payroll.example.com/api/health | jq

# Healthcheck agregat semua service
curl -s https://payroll.example.com/api/healthcheck | jq

# Frontend
curl -sI https://payroll.example.com | head -20

# HTTP harus redirect ke HTTPS
curl -sI http://payroll.example.com | head -5

# Log tanpa error
docker compose -f docker/production/docker-compose.prod.yml logs --tail=100 gateway postgres
```

## 7. Monitoring & Operasional

```bash
# Log semua service
cd docker/production && docker compose -f docker-compose.prod.yml logs -f

# Resource usage
docker stats

# Backup manual DB
docker exec payrollpro-postgres pg_dump -U postgres payrollpro | gzip > docker/production/backups/manual-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore DB
gzip -dc <backup-file>.sql.gz | docker exec -i payrollpro-postgres psql -U postgres payrollpro

# Cek storage
df -h /var/lib/docker

# Backup otomatis harian (pgbackups) -> Cek hasilnya
ls -la docker/production/backups/
```

## 8. Hardening Checklist

- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` dari `openssl rand -base64 48` (bukan default)
- [ ] `DB_PASSWORD` kuat, bukan `postgres`
- [ ] `REDIS_PASSWORD` kuat, `requirepass` aktif
- [ ] Rate limit aktif: 100 req/min/IP global, 5 percobaan/menit endpoint login
- [ ] CORS dibatasi hanya `https://${DOMAIN}`
- [ ] Security headers (HSTS, CSP, X-Frame-Options) aktif di Nginx
- [ ] Service berjalan sebagai non-root (`app-*` image pakai `USER fastify/nextjs`)
- [ ] `cap_drop: [ALL]` + `no-new-privileges` pada service Node
- [ ] Backup harian PostgreSQL terverifikasi
- [ ] Healthcheck semua service aktif (`docker ps` hijau)

## Rollback

```bash
# Hentikan & hapus container (volumes tetap)
docker compose -f docker/production/docker-compose.prod.yml down

# Hapus total termasuk volumes (DESTRUKTIF - data hilang)
docker compose -f docker/production/docker-compose.prod.yml down -v
```

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Sertifikat SSL expired | `docker compose -f docker-compose.prod.yml restart certbot` atau issue ulang manual |
| Container `unhealthy` | `docker compose -f docker-compose.prod.yml logs <service>`, biasanya DB/Redis belum ready |
| port 80/443 sudah terpakai | Matikan service lain / ubah binding di `docker-compose.prod.yml` |
| Auto-update tidak jalan | `docker compose logs watchtower` |