# PayrollPro - Web Payroll System

Sistem web payroll berbasis microservices untuk mengelola penggajian, kehadiran, cuti, dan komunikasi internal perusahaan.

## Tech Stack

- **Frontend:** Next.js 14+, Tailwind CSS, Zustand
- **Backend:** Fastify, TypeScript, Drizzle ORM
- **Database:** PostgreSQL 16, Redis 7
- **Auth:** JWT
- **API:** REST
- **Container:** Docker & Docker Compose
- **Platform:** Arch Linux

## Quick Start

### Prerequisites

- Node.js 22+ LTS
- Docker & Docker Compose
- pnpm

### Installation

```bash
# Clone repository
git clone <repository-url>
cd payrollpro

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Start databases
docker-compose up -d postgres redis

# Run migrations
pnpm db:generate
pnpm db:migrate

# Seed data
pnpm db:seed

# Start development servers
pnpm dev:all
```

### Access

- Frontend: http://localhost:3000
- API Gateway: http://localhost:3001
- API Docs: http://localhost:3001/docs

## Documentation

Lihat folder `phases/` untuk dokumentasi lengkap implementasi.

## License

MIT
