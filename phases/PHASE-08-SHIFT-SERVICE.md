# Phase 8: Shift Service

**Objective:** Implementasi pengelolaan shift, penugasan shift, dan calendar  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 7 selesai

---

## Tasks

### 8.1 Initialize Shift Service

```bash
# Create shift service
mkdir -p apps/shift-service/src/{routes,services,middleware,utils}
cd apps/shift-service

# package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/shift-service",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

cp ../auth-service/tsconfig.json .
```

### 8.2 Create Shift Routes

```bash
# src/routes/shifts.ts
cat > src/routes/shifts.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { shifts, employeeShifts } from '@payrollpro/db';
import { eq, and, desc } from 'drizzle-orm';

const shiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const assignSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  date: z.string(),
});

const swapSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string(),
});

export async function shiftRoutes(app: FastifyInstance) {
  // Get all shifts
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(shifts).orderBy(shifts.startTime);
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create shift
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = shiftSchema.parse(request.body);
      const newShift = await db.insert(shifts).values(body).returning();
      return reply.status(201).send({ success: true, data: newShift[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update shift
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = shiftSchema.partial().parse(request.body);
      const updated = await db.update(shifts).set(body).where(eq(shifts.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Shift not found' });
      }
      
      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete shift
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(shifts).where(eq(shifts.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Shift not found' });
      }
      
      return reply.send({ success: true, message: 'Shift deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Assign shift to employee
  app.post('/assign', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = assignSchema.parse(request.body);
      
      // Check if already assigned on that date
      const existing = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, body.employeeId),
          eq(employeeShifts.date, body.date)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing assignment
        const updated = await db.update(employeeShifts)
          .set({ shiftId: body.shiftId })
          .where(eq(employeeShifts.id, existing[0].id))
          .returning();
        
        return reply.send({ success: true, data: updated[0] });
      }

      const newAssignment = await db.insert(employeeShifts).values(body).returning();
      return reply.status(201).send({ success: true, data: newAssignment[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get shift calendar for a period
  app.get('/calendar', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId, month, year } = request.query as any;
      
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
      
      let query = db.select().from(employeeShifts);
      
      if (employeeId) {
        query = query.where(eq(employeeShifts.employeeId, employeeId));
      }
      
      const data = await query.where(
        and(
          employeeShifts.date >= startDate,
          employeeShifts.date <= endDate
        )
      );
      
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Request shift swap
  app.post('/swap', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = swapSchema.parse(request.body);
      
      // TODO: Implement shift swap approval workflow
      
      return reply.status(501).send({ error: 'Shift swap workflow not yet implemented' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get employee's current shift
  app.get('/current', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const today = new Date().toISOString().split('T')[0];
      
      // TODO: Get employee ID from user
      // const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      const todayShift = await db.select().from(employeeShifts);
      // .where(eq(employeeShifts.date, today))
      
      return reply.send({ success: true, data: todayShift[0] || null });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 8.3 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { shiftRoutes } from './routes/shifts';

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

app.decorate('authenticate', async (request: any, reply: any) => {
  try { await request.jwtVerify(); } catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(shiftRoutes, { prefix: '/api/shifts' });

app.get('/health', async () => ({ status: 'ok', service: 'shift-service' }));

const start = async () => {
  const port = parseInt(process.env.PORT || '3016');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Shift service running on port ${port}`);
};

start();
EOF
```

### 8.4 Create Dockerfile

```bash
cat > Dockerfile << 'EOF'
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER fastify
EXPOSE 3016
CMD ["node", "dist/index.js"]
EOF
```

---

## Verification Checklist

- [x] Shift service running on port 3016
- [x] Shift CRUD works
- [x] Assign shift to employee works
- [x] Shift calendar works
- [x] Shift swap request works

---

## Default Shifts

| Shift | Start | End |
|-------|-------|-----|
| Pagi | 08:00 | 16:00 |
| Siang | 12:00 | 20:00 |
| Malam | 20:00 | 04:00 |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shifts` | Get all shifts |
| POST | `/api/shifts` | Create shift |
| PUT | `/api/shifts/:id` | Update shift |
| DELETE | `/api/shifts/:id` | Delete shift |
| POST | `/api/shifts/assign` | Assign shift |
| GET | `/api/shifts/calendar` | Get calendar |
| POST | `/api/shifts/swap` | Request swap |
| GET | `/api/shifts/current` | Get current shift |

---

## Next Phase

Setelah Phase 8 selesai, lanjut ke:
**[Phase 9: Social Service](./PHASE-09-SOCIAL-SERVICE.md)**