# Phase 6: Leave Service

**Objective:** Implementasi cuti, approval workflow, dan leave quota  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 5 selesai

---

## Tasks

### 6.1 Initialize Leave Service

```bash
# Create leave service
mkdir -p apps/leave-service/src/{routes,services,middleware,utils}
cd apps/leave-service

# package.json (same pattern as attendance)
cat > package.json << 'EOF'
{
  "name": "@payrollpro/leave-service",
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

### 6.2 Create Leave Routes

```bash
# src/routes/leaves.ts
cat > src/routes/leaves.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { leaves, leaveQuotas, employees } from '@payrollpro/db';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

const leaveSchema = z.object({
  leaveType: z.enum(['annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

const approveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

// Default leave quotas per year
const DEFAULT_QUOTAS: Record<string, number> = {
  annual: 12,
  sick: 12,
  maternity: 90,
  paternity: 3,
  special: 0,
  unpaid: 0,
};

export async function leaveRoutes(app: FastifyInstance) {
  // Request leave
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = leaveSchema.parse(request.body);

      // Get employee
      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Calculate days
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Check quota (except for special and unpaid)
      if (body.leaveType !== 'special' && body.leaveType !== 'unpaid') {
        const year = new Date().getFullYear();
        const quota = await db.select().from(leaveQuotas)
          .where(and(
            eq(leaveQuotas.employeeId, employee[0].id),
            eq(leaveQuotas.leaveType, body.leaveType),
            eq(leaveQuotas.year, year)
          ))
          .limit(1);

        if (quota.length === 0) {
          // Create default quota if not exists
          const defaultQuota = DEFAULT_QUOTAS[body.leaveType] || 0;
          await db.insert(leaveQuotas).values({
            employeeId: employee[0].id,
            leaveType: body.leaveType,
            year,
            totalQuota: defaultQuota,
            usedQuota: 0,
          });
          
          if (days > defaultQuota) {
            return reply.status(400).send({ error: `Insufficient quota. Available: ${defaultQuota} days` });
          }
        } else {
          const available = quota[0].totalQuota - quota[0].usedQuota;
          if (days > available) {
            return reply.status(400).send({ error: `Insufficient quota. Available: ${available} days` });
          }
        }
      }

      // Create leave request
      const newLeave = await db.insert(leaves).values({
        employeeId: employee[0].id,
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
        attachmentUrl: body.attachmentUrl,
        status: 'pending',
      }).returning();

      // TODO: Send notification to manager

      return reply.status(201).send({ success: true, data: newLeave[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get leave history
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      
      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const data = await db.select().from(leaves)
        .where(eq(leaves.employeeId, employee[0].id))
        .orderBy(desc(leaves.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get leave detail
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const leave = await db.select().from(leaves).where(eq(leaves.id, id)).limit(1);
      
      if (leave.length === 0) {
        return reply.status(404).send({ error: 'Leave not found' });
      }

      return reply.send({ success: true, data: leave[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Approve/Reject leave (Manager)
  app.put('/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      const { id } = request.params as { id: string };
      const body = approveSchema.parse(request.body);

      // Check role
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const leave = await db.select().from(leaves).where(eq(leaves.id, id)).limit(1);
      
      if (leave.length === 0) {
        return reply.status(404).send({ error: 'Leave not found' });
      }

      if (leave[0].status !== 'pending') {
        return reply.status(400).send({ error: 'Leave already processed' });
      }

      const newStatus = body.approved ? 'approved' : 'rejected';

      // Update leave status
      const updated = await db.update(leaves)
        .set({
          status: newStatus,
          approvedBy: user.id,
          approvedAt: new Date(),
          notes: body.notes,
        })
        .where(eq(leaves.id, id))
        .returning();

      // Update quota if approved
      if (body.approved && leave[0].leaveType !== 'special' && leave[0].leaveType !== 'unpaid') {
        const year = leave[0].startDate.substring(0, 4);
        const days = Math.ceil(
          (new Date(leave[0].endDate).getTime() - new Date(leave[0].startDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        ) + 1;

        const quota = await db.select().from(leaveQuotas)
          .where(and(
            eq(leaveQuotas.employeeId, leave[0].employeeId),
            eq(leaveQuotas.leaveType, leave[0].leaveType),
            eq(leaveQuotas.year, parseInt(year))
          ))
          .limit(1);

        if (quota.length > 0) {
          await db.update(leaveQuotas)
            .set({ usedQuota: quota[0].usedQuota + days })
            .where(eq(leaveQuotas.id, quota[0].id));
        }
      }

      // TODO: Send notification to employee

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get leave quota
  app.get('/quota', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const year = new Date().getFullYear();

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const quotas = await db.select().from(leaveQuotas)
        .where(and(
          eq(leaveQuotas.employeeId, employee[0].id),
          eq(leaveQuotas.year, year)
        ));

      // Create default quotas if not exists
      if (quotas.length === 0) {
        const defaultQuotas = [
          { leaveType: 'annual', totalQuota: 12 },
          { leaveType: 'sick', totalQuota: 12 },
          { leaveType: 'maternity', totalQuota: 90 },
          { leaveType: 'paternity', totalQuota: 3 },
        ];

        for (const quota of defaultQuotas) {
          await db.insert(leaveQuotas).values({
            employeeId: employee[0].id,
            leaveType: quota.leaveType,
            year,
            totalQuota: quota.totalQuota,
            usedQuota: 0,
          });
        }

        // Fetch again
        const newQuotas = await db.select().from(leaveQuotas)
          .where(and(
            eq(leaveQuotas.employeeId, employee[0].id),
            eq(leaveQuotas.year, year)
          ));

        return reply.send({ success: true, data: newQuotas });
      }

      return reply.send({ success: true, data: quotas });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get leave calendar
  app.get('/calendar', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month, year } = request.query as any;

      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const data = await db.select().from(leaves)
        .where(and(
          gte(leaves.startDate, startDate),
          lte(leaves.startDate, endDate),
          eq(leaves.status, 'approved')
        ));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get pending approvals (Manager)
  app.get('/approvals', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };

      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const data = await db.select().from(leaves)
        .where(eq(leaves.status, 'pending'))
        .orderBy(desc(leaves.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 6.3 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { leaveRoutes } from './routes/leaves';

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

app.decorate('authenticate', async (request: any, reply: any) => {
  try { await request.jwtVerify(); } catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(leaveRoutes, { prefix: '/api/leaves' });

app.get('/health', async () => ({ status: 'ok', service: 'leave-service' }));

const start = async () => {
  const port = parseInt(process.env.PORT || '3014');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Leave service running on port ${port}`);
};

start();
EOF
```

### 6.4 Create Dockerfile

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
EXPOSE 3014
CMD ["node", "dist/index.js"]
EOF
```

---

## Verification Checklist

- [x] Leave service running on port 3014
- [x] Request leave works
- [x] Leave quota check works
- [x] Approve/Reject leave works
- [x] Leave history works
- [x] Leave calendar works
- [x] Approval queue works

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leaves` | Request leave |
| GET | `/api/leaves/history` | Get leave history |
| GET | `/api/leaves/:id` | Get leave detail |
| PUT | `/api/leaves/:id/approve` | Approve/Reject leave |
| GET | `/api/leaves/quota` | Get leave quota |
| GET | `/api/leaves/calendar` | Get leave calendar |
| GET | `/api/leaves/approvals` | Get approval queue |

---

## Next Phase

Setelah Phase 6 selesai, lanjut ke:
**[Phase 7: Payroll Service](./PHASE-07-PAYROLL-SERVICE.md)**