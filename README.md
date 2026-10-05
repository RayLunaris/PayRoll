# PayrollPro - Web Payroll System

Sistem web payroll berbasis microservices untuk mengelola penggajian, kehadiran, cuti, shift, lembur, laporan, dan komunikasi internal perusahaan.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Struktur Project](#struktur-project)
- [File Database](#file-database)
- [Panduan Instalasi](#panduan-instalasi)
- [Cara Menjalankan](#cara-menjalankan)
- [Cara Deploy ke Server](#cara-deploy-ke-server)
- [Testing](#testing)
- [Dokumentasi Lain](#dokumentasi-lain)

## Fitur Utama

- **Autentikasi**: login, register, lupa password, reset password (JWT)
- **Dashboard**: ringkasan kehadiran, payroll, dan aktivitas
- **Karyawan**: manajemen data karyawan
- **Absensi**: check-in/check-out berbasis lokasi (Leaflet map)
- **Cuti**: pengajuan dan persetujuan cuti
- **Shift**: pengaturan jadwal shift
- **Lembur**: pengajuan dan approval lembur
- **Payroll**: perhitungan gaji, BPJS, PPh 21, dan slip gaji
- **Laporan**: laporan kehadiran dan payroll (recharts)
- **Sosial**: feed/komunikasi internal antar karyawan
- **Notifikasi**: notifikasi real-time (WebSocket)
- **Admin & Settings**: pengaturan sistem dan role management

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, shadcn/ui (Radix), Zustand, react-hook-form, zod, recharts, Leaflet
- **Backend:** Fastify, TypeScript, Drizzle ORM
- **Database:** PostgreSQL 16, Redis 7
- **Auth:** JWT
- **API:** REST + WebSocket
- **Monorepo:** pnpm workspaces
- **Container:** Docker & Docker Compose, Nginx, Certbot (SSL)
- **Testing:** Vitest (unit), Playwright (e2e), axe-core (aksesibilitas)

## Struktur Project

```
apps/
  web                  # Frontend Next.js            (port 3000)
  api-gateway          # Gateway ke semua service     (port 3001)
  websocket            # Realtime notifikasi          (port 3002)
  auth-service         # Autentikasi & user           (port 3010)
  employee-service     # Data karyawan                (port 3011)
  payroll-service      # Penggajian                   (port 3012)
  attendance-service   # Absensi                      (port 3013)
  leave-service        # Cuti                         (port 3014)
  social-service       # Feed internal & upload file  (port 3015)
  shift-service        # Shift                        (port 3016)
packages/
  db                   # Skema, migrasi & seed Drizzle
  shared-types         # Type bersama
  utils                # Utilitas bersama
database/
  payrollpro.sql       # Dump database (skema + data awal)
docker/
  postgres/            # Image PostgreSQL untuk development
  production/          # Compose production, Nginx, SSL, backup
scripts/
  dev-light.mjs        # Launcher dev hemat RAM
```

## File Database

File database ada di [`database/payrollpro.sql`](database/payrollpro.sql): dump PostgreSQL 16 berisi skema lengkap (30 tabel) dan data awal.

| Isi | Keterangan |
|-----|-----------|
| Skema | Semua tabel hasil migrasi di `packages/db/src/migrations` |
| Data awal | Super admin, 3 departemen, 3 jabatan, 2 lokasi kerja, 3 shift, tarif BPJS, tarif PPh 21 2024, tarif lembur |
| Riwayat migrasi | Tabel `drizzle.__drizzle_migrations`, jadi `pnpm db:migrate` setelah import tidak mengulang migrasi |

**Akun default:**

| Email | Password | Role |
|-------|----------|------|
| `admin@payrollpro.com` | `admin123` | `super_admin` |

> [!WARNING]
> Ganti password admin setelah login pertama, terutama di server production.

Sumber kebenaran skema tetap kode Drizzle di [`packages/db/src/schema`](packages/db/src/schema). Kalau skema berubah, buat ulang file dump (lihat [Memperbarui file database](#memperbarui-file-database)).

## Panduan Instalasi

### 1. Persyaratan

| Software | Versi | Cek versi |
|----------|-------|-----------|
| Node.js | 22 atau lebih baru | `node -v` |
| pnpm | 9 atau lebih baru | `pnpm -v` |
| Docker + Docker Compose v2 | terbaru | `docker compose version` |
| Git | terbaru | `git --version` |

Kalau pnpm belum ada:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Docker dipakai untuk menjalankan PostgreSQL dan Redis. Kalau PostgreSQL 16 dan Redis 7 sudah terpasang langsung di komputer, Docker boleh dilewati. Sesuaikan saja `DATABASE_URL` dan `REDIS_URL` di `.env`.

### 2. Clone repository

```bash
git clone https://github.com/RayLunaris/PayRoll.git
cd PayRoll
```

### 3. Install dependency

```bash
pnpm install
```

### 4. Buat file environment

```bash
cp .env.example .env
```

Isi `JWT_SECRET` dan `JWT_REFRESH_SECRET` dengan nilai acak yang **berbeda**:

```bash
openssl rand -hex 32   # tempel ke JWT_SECRET
openssl rand -hex 32   # tempel ke JWT_REFRESH_SECRET
```

Variabel lain di `.env.example` sudah cocok untuk development lokal.

### 5. Jalankan PostgreSQL dan Redis

```bash
pnpm services:up
# atau: docker compose up -d postgres redis
```

Cek keduanya sudah `healthy`:

```bash
docker ps
```

### 6. Siapkan database

Pilih **salah satu** cara.

**Cara A: migrasi + seed (disarankan untuk development)**

```bash
pnpm db:migrate
pnpm db:seed
```

**Cara B: import file database**

```bash
docker exec -i payrollpro-postgres psql -U postgres -d payrollpro < database/payrollpro.sql
```

Tanpa Docker (PostgreSQL lokal):

```bash
createdb -U postgres payrollpro
psql -U postgres -d payrollpro -f database/payrollpro.sql
```

> [!NOTE]
> Import hanya untuk database kosong. Kalau tabel sudah ada, hapus dulu databasenya atau pakai Cara A.

## Cara Menjalankan

### Mode development

```bash
pnpm dev:all
```

Perintah ini menjalankan frontend, gateway, websocket, dan semua service sekaligus. Setelah jalan, buka:

| Aplikasi | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| WebSocket | ws://localhost:3002 |

Login memakai akun default di bagian [File Database](#file-database).

### Mode ringan (RAM terbatas)

Untuk komputer dengan RAM 8 GB atau kurang, jalankan hanya service yang dibutuhkan:

| Perintah | Service yang jalan |
|----------|--------------------|
| `pnpm dev` | Menu interaktif untuk memilih mode |
| `pnpm dev:core` | Web + Gateway + Auth + Employee |
| `pnpm dev:payroll-full` | Core + Payroll |
| `pnpm dev:attendance-full` | Core + Attendance + Shift |
| `pnpm dev:leave-full` | Core + Leave |
| `pnpm dev:social-full` | Core + Social + WebSocket |
| `pnpm dev:backend` | Gateway + Auth + Employee (tanpa web) |

Satu service saja: `pnpm dev:web`, `pnpm dev:gateway`, `pnpm dev:auth`, `pnpm dev:payroll`, dan seterusnya (lihat `package.json`).

### Mode production di lokal (tanpa Docker)

```bash
pnpm build
pnpm --filter @payrollpro/auth-service start     # ulangi untuk tiap service
pnpm --filter @payrollpro/web start
```

### Perintah database lain

| Perintah | Fungsi |
|----------|--------|
| `pnpm db:generate` | Buat file migrasi baru setelah skema diubah |
| `pnpm db:migrate` | Jalankan migrasi yang belum diterapkan |
| `pnpm db:seed` | Isi data awal (aman dijalankan ulang) |
| `pnpm db:studio` | Buka Drizzle Studio untuk melihat isi database |

### Menghentikan aplikasi

Tekan `Ctrl+C` di terminal `pnpm dev:all`, lalu matikan database bila perlu:

```bash
docker compose stop postgres redis
```

## Cara Deploy ke Server

Ada dua pilihan. Panduan lengkap dan troubleshooting ada di [`docker/production/DEPLOYMENT.md`](docker/production/DEPLOYMENT.md).

| Pilihan | Frontend | Backend + database | Cocok untuk |
|---------|----------|--------------------|-------------|
| **A. Satu VPS** | VPS (Docker) | VPS (Docker) | Semua di satu server, satu domain |
| **B. Vercel + VPS** | Vercel | VPS (Docker) | Frontend gratis di Vercel, backend di VPS |

### Pilihan A: semua di satu VPS dengan Docker Compose

Stack production ([`docker-compose.prod.yml`](docker/production/docker-compose.prod.yml)) berisi Nginx (reverse proxy + HTTPS), Certbot (perpanjangan SSL otomatis), semua service, PostgreSQL, Redis, dan backup database harian.

**Kebutuhan server:**

- VPS Linux (Ubuntu 22.04/24.04 atau sejenis), minimal 2 vCPU dan 4 GB RAM
- Domain yang record A-nya mengarah ke IP VPS
- Port 22, 80, dan 443 terbuka

**1. Install Docker di server**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout lalu login lagi
docker compose version
```

**2. Clone project**

```bash
git clone https://github.com/RayLunaris/PayRoll.git
cd PayRoll
```

**3. Buat `.env.production`**

```bash
cp .env.production.example .env.production
openssl rand -base64 48   # untuk JWT_SECRET
openssl rand -base64 48   # untuk JWT_REFRESH_SECRET (harus beda)
openssl rand -hex 24      # untuk DB_PASSWORD
openssl rand -hex 24      # untuk REDIS_PASSWORD
nano .env.production
```

Isi `DOMAIN` dengan domain kamu dan `CORS_ORIGIN=https://<domain-kamu>`.

**4. Ganti domain di konfigurasi Nginx**

```bash
sed -i 's/payroll.example.com/<domain-kamu>/g' docker/production/nginx/conf.d/payrollpro.conf
```

**5. Buat sertifikat SSL (sekali saja)**

Nginx belum bisa start dengan blok HTTPS sebelum sertifikat ada. Ambil sertifikat lebih dulu dengan Certbot mode standalone (port 80 harus kosong):

```bash
cd docker/production
docker run --rm -p 80:80 \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly --standalone \
  -d <domain-kamu> --email <email-kamu> --agree-tos --no-eff-email
```

Setelah ini, container `certbot` memperpanjang sertifikat otomatis.

**6. Build dan jalankan**

```bash
# masih di docker/production
docker compose --env-file ../../.env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Build pertama butuh sekitar 5-15 menit.

**7. Isi database**

PostgreSQL production tidak membuka port ke host, jadi import lewat container:

```bash
cd ../..
docker exec -i payrollpro-postgres psql -U postgres -d payrollpro < database/payrollpro.sql
```

**8. Cek hasil deploy**

```bash
docker compose -f docker/production/docker-compose.prod.yml ps        # semua harus "healthy"
docker exec payrollpro-api-gateway curl -s localhost:3001/healthcheck # status semua service
curl -sI https://<domain-kamu> | head -3   # frontend 200
curl -sI http://<domain-kamu> | head -3    # harus redirect 301 ke https
```

Buka `https://<domain-kamu>`, login sebagai admin, lalu **ganti password admin**.

**Update aplikasi setelah ada perubahan di GitHub:**

```bash
cd PayRoll
git pull
cd docker/production
docker compose --env-file ../../.env.production -f docker-compose.prod.yml up -d --build
```

Kalau update membawa migrasi baru (`packages/db/src/migrations`), jalankan migrasi lewat container sementara di network Docker yang sama (dari root project, ganti `<DB_PASSWORD>`):

```bash
docker run --rm --network production_payrollpro -v "$PWD":/app -w /app \
  -e DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@postgres:5432/payrollpro \
  node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm db:migrate"
```

Nama network bisa dicek dengan `docker network ls | grep payrollpro`.

**Backup dan restore:**

```bash
# backup otomatis harian tersimpan di:
ls docker/production/backups/

# backup manual
docker exec payrollpro-postgres pg_dump -U postgres payrollpro | gzip > backup-$(date +%F).sql.gz

# restore
gzip -dc backup-YYYY-MM-DD.sql.gz | docker exec -i payrollpro-postgres psql -U postgres payrollpro
```

### Pilihan B: frontend di Vercel, backend di VPS

1. Di VPS, ikuti Pilihan A langkah 1-7, tetapi tanpa service `web`:
   ```bash
   docker compose --env-file ../../.env.production -f docker-compose.prod.yml up -d --build \
     nginx certbot api-gateway websocket auth-service employee-service payroll-service \
     attendance-service leave-service social-service shift-service postgres redis pgbackups
   ```
   Pakai subdomain untuk API, misalnya `api.domainkamu.com`.
2. Di `.env.production`, isi `CORS_ORIGIN` dengan URL Vercel, contoh `https://payrollpro.vercel.app`.
3. Di Vercel: **Add New Project**, pilih repo ini, set **Root Directory** ke `apps/web`.
4. Tambahkan Environment Variables di Vercel lalu deploy:

   | Variable | Contoh |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | `https://api.domainkamu.com/api` |
   | `NEXT_PUBLIC_WS_URL` | `wss://api.domainkamu.com/ws` |
   | `NEXT_PUBLIC_APP_URL` | `https://payrollpro.vercel.app` |

### Checklist keamanan production

- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD` acak dan kuat
- [ ] Password akun admin default sudah diganti
- [ ] `.env` dan `.env.production` tidak ikut di-commit (sudah ada di `.gitignore`)
- [ ] HTTPS aktif dan HTTP redirect ke HTTPS
- [ ] Firewall hanya membuka port 22, 80, 443
- [ ] Backup harian di `docker/production/backups/` sudah dicek

## Testing

```bash
pnpm test:unit                            # unit test (Vitest)
pnpm test:e2e                             # e2e test (Playwright)
pnpm --filter @payrollpro/web typecheck
pnpm --filter @payrollpro/web lint
```

## Dokumentasi Lain

- [`docker/production/DEPLOYMENT.md`](docker/production/DEPLOYMENT.md): detail deploy, monitoring, rollback
- `PRD/` dan `PRD-WEB-PAYROLL.md`: product requirements
- `phases/`: dokumentasi implementasi per fase
- `RENCANA-FITUR-TAMBAHAN.md`: rencana fitur lanjutan

### Memperbarui file database

Setelah ada migrasi baru, buat ulang `database/payrollpro.sql` dari database bersih:

```bash
docker exec payrollpro-postgres psql -U postgres -c "DROP DATABASE IF EXISTS payrollpro_dump" -c "CREATE DATABASE payrollpro_dump"
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/payrollpro_dump pnpm db:migrate
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/payrollpro_dump pnpm db:seed
docker exec payrollpro-postgres pg_dump -U postgres --no-owner --no-privileges payrollpro_dump \
  | grep -v -E '^\\(restrict|unrestrict) ' > database/payrollpro.sql
docker exec payrollpro-postgres psql -U postgres -c "DROP DATABASE payrollpro_dump"
```

Header penjelasan di awal file perlu ditambahkan lagi secara manual.

## License

MIT
