# Phase 4: Employee Service

**Objective:** Implementasi CRUD karyawan, departments, positions, dan work locations  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 3 selesai

---

## Tasks

### 4.1 Initialize Employee Service

```bash
# Create employee service directory
mkdir -p apps/employee-service/src/{routes,services,middleware,utils}
cd apps/employee-service

# Create package.json (similar to auth-service)
cat > package.json << 'EOF'
{
  "name": "@payrollpro/employee-service",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/multipart": "^8.0.0",
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

# Copy tsconfig.json from auth-service
cp ../auth-service/tsconfig.json .
```

### 4.2 Create Employee Routes

```bash
# src/routes/employees.ts
cat > src/routes/employees.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { employees, departments, positions, workLocations } from '@payrollpro/db';
import { eq, ilike, and, desc, sql } from 'drizzle-orm';

const employeeSchema = z.object({
  nip: z.string().min(1),
  fullName: z.string().min(1),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  locationId: z.string().uuid(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  joinDate: z.string(),
  baseSalary: z.number().positive(),
  npwp: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

export async function employeeRoutes(app: FastifyInstance) {
  // Get all employees with pagination
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 10, search = '' } = request.query as any;
      
      const offset = (page - 1) * limit;
      
      let query = db.select().from(employees);
      
      if (search) {
        query = query.where(ilike(employees.fullName, `%${search}%`));
      }
      
      const data = await query
        .orderBy(desc(employees.createdAt))
        .limit(limit)
        .offset(offset);
      
      const total = await db.select({ count: sql<number>`count(*)` }).from(employees);
      
      return reply.send({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: total[0].count,
          totalPages: Math.ceil(total[0].count / limit),
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get employee by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const employee = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      return reply.send({ success: true, data: employee[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create employee
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = employeeSchema.parse(request.body);
      
      const newEmployee = await db.insert(employees).values(body).returning();
      
      return reply.status(201).send({ success: true, data: newEmployee[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update employee
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = employeeSchema.partial().parse(request.body);
      
      const updated = await db.update(employees).set(body).where(eq(employees.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete employee
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const deleted = await db.delete(employees).where(eq(employees.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      return reply.send({ success: true, message: 'Employee deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 4.3 Create Department Routes

```bash
# src/routes/departments.ts
cat > src/routes/departments.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { departments } from '@payrollpro/db';
import { eq, desc } from 'drizzle-orm';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().uuid().optional(),
});

export async function departmentRoutes(app: FastifyInstance) {
  // Get all departments
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(departments).orderBy(desc(departments.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get department by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const department = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
      
      if (department.length === 0) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      return reply.send({ success: true, data: department[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create department
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = departmentSchema.parse(request.body);
      const newDepartment = await db.insert(departments).values(body).returning();
      return reply.status(201).send({ success: true, data: newDepartment[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update department
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = departmentSchema.partial().parse(request.body);
      const updated = await db.update(departments).set(body).where(eq(departments.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete department
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(departments).where(eq(departments.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      return reply.send({ success: true, message: 'Department deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 4.4 Create Position Routes

```bash
# src/routes/positions.ts
cat > src/routes/positions.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { positions } from '@payrollpro/db';
import { eq, desc } from 'drizzle-orm';

const positionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baseSalary: z.number().positive(),
  grade: z.string().optional(),
});

export async function positionRoutes(app: FastifyInstance) {
  // Get all positions
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(positions).orderBy(desc(positions.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create position
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = positionSchema.parse(request.body);
      const newPosition = await db.insert(positions).values(body).returning();
      return reply.status(201).send({ success: true, data: newPosition[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update position
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = positionSchema.partial().parse(request.body);
      const updated = await db.update(positions).set(body).where(eq(positions.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete position
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(positions).where(eq(positions.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      return reply.send({ success: true, message: 'Position deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 4.5 Create Work Location Routes

```bash
# src/routes/locations.ts
cat > src/routes/locations.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { workLocations } from '@payrollpro/db';
import { eq, desc } from 'drizzle-orm';

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().positive().default(100),
});

export async function locationRoutes(app: FastifyInstance) {
  // Get all locations
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(workLocations).orderBy(desc(workLocations.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get location by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const location = await db.select().from(workLocations).where(eq(workLocations.id, id)).limit(1);
      
      if (location.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      return reply.send({ success: true, data: location[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create location
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = locationSchema.parse(request.body);
      const newLocation = await db.insert(workLocations).values(body).returning();
      return reply.status(201).send({ success: true, data: newLocation[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update location
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = locationSchema.partial().parse(request.body);
      const updated = await db.update(workLocations).set(body).where(eq(workLocations.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete location
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(workLocations).where(eq(workLocations.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      return reply.send({ success: true, message: 'Location deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Validate GPS location
  app.post('/validate-location', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId, latitude, longitude } = request.body as {
        locationId: string;
        latitude: number;
        longitude: number;
      };
      
      const location = await db.select().from(workLocations).where(eq(workLocations.id, locationId)).limit(1);
      
      if (location.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (location[0].latitude * Math.PI) / 180;
      const φ2 = (latitude * Math.PI) / 180;
      const Δφ = ((latitude - location[0].latitude) * Math.PI) / 180;
      const Δλ = ((longitude - location[0].longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const isInside = distance <= location[0].radiusMeters;

      return reply.send({
        success: true,
        data: {
          isInside,
          distance: Math.round(distance),
          radius: location[0].radiusMeters,
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 4.6 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { employeeRoutes } from './routes/employees';
import { departmentRoutes } from './routes/departments';
import { positionRoutes } from './routes/positions';
import { locationRoutes } from './routes/locations';

const app = Fastify({
  logger: true,
});

// Register plugins
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-key',
});

// Add authenticate decorator
app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Register routes
await app.register(employeeRoutes, { prefix: '/api/employees' });
await app.register(departmentRoutes, { prefix: '/api/departments' });
await app.register(positionRoutes, { prefix: '/api/positions' });
await app.register(locationRoutes, { prefix: '/api/locations' });

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'employee-service' };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3011');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Employee service running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
EOF
```

### 4.7 Create Dockerfile

```bash
# Dockerfile (same pattern as auth-service)
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
EXPOSE 3011
CMD ["node", "dist/index.js"]
EOF
```

### 4.8 Test Endpoints

```bash
# Build and start employee service
cd apps/employee-service
pnpm install
pnpm build

# Test endpoints
curl -X GET http://localhost:3011/api/employees \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:3011/api/employees \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nip": "EMP001",
    "fullName": "John Doe",
    "departmentId": "<uuid>",
    "positionId": "<uuid>",
    "locationId": "<uuid>",
    "joinDate": "2024-01-01",
    "baseSalary": 8000000
  }'
```

---

## Verification Checklist

- [x] Employee service running on port 3011
- [x] CRUD employees works
- [x] CRUD departments works
- [x] CRUD positions works
- [x] CRUD locations works
- [x] GPS validation works
- [x] Pagination works
- [x] Search works

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees |
| GET | `/api/employees/:id` | Get employee by ID |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |
| GET | `/api/departments` | Get all departments |
| POST | `/api/departments` | Create department |
| PUT | `/api/departments/:id` | Update department |
| DELETE | `/api/departments/:id` | Delete department |
| GET | `/api/positions` | Get all positions |
| POST | `/api/positions` | Create position |
| PUT | `/api/positions/:id` | Update position |
| DELETE | `/api/positions/:id` | Delete position |
| GET | `/api/locations` | Get all locations |
| POST | `/api/locations` | Create location |
| PUT | `/api/locations/:id` | Update location |
| DELETE | `/api/locations/:id` | Delete location |
| POST | `/api/locations/validate-location` | Validate GPS |

---

## Next Phase

Setelah Phase 4 selesai, lanjut ke:
**[Phase 5: Attendance Service](./PHASE-05-ATTENDANCE-SERVICE.md)**
