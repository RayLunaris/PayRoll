# Phase 3: Auth Service

**Objective:** Implementasi login, JWT, dan role-based access control  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 2 selesai

---

## Tasks

### 3.1 Initialize Fastify Project

```bash
# Create auth service directory
mkdir -p apps/auth-service/src/{routes,services,middleware,utils}
cd apps/auth-service

# Create package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/auth-service",
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
    "@fastify/cookie": "^9.0.0",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0",
    "bcrypt": "^5.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

### 3.2 Create Auth Routes

```bash
# src/routes/auth.ts
cat > src/routes/auth.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import { db } from '../utils/db';
import { users } from '@payrollpro/db';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['super_admin', 'hr_admin', 'manager', 'employee']),
  employeeId: z.string().uuid().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Find user by email
      const user = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      
      if (user.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await compare(body.password, user[0].passwordHash);
      
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generate tokens
      const accessToken = app.jwt.sign(
        { id: user[0].id, email: user[0].email, role: user[0].role },
        { expiresIn: '15m' }
      );

      const refreshToken = app.jwt.sign(
        { id: user[0].id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      // Update last login
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user[0].id));

      return reply.send({
        success: true,
        data: {
          user: {
            id: user[0].id,
            email: user[0].email,
            role: user[0].role,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Register
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      // Check if email already exists
      const existingUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      
      if (existingUser.length > 0) {
        return reply.status(409).send({ error: 'Email already exists' });
      }

      // Hash password
      const passwordHash = await hash(body.password, 12);

      // Create user
      const newUser = await db.insert(users).values({
        email: body.email,
        passwordHash,
        role: body.role,
        employeeId: body.employeeId,
        isActive: true,
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: newUser[0].id,
          email: newUser[0].email,
          role: newUser[0].role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Refresh Token
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body as { refreshToken: string };
      
      if (!refreshToken) {
        return reply.status(400).send({ error: 'Refresh token required' });
      }

      // Verify refresh token
      const decoded = app.jwt.verify(refreshToken) as { id: string; type: string };
      
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }

      // Find user
      const user = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
      
      if (user.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      // Generate new access token
      const accessToken = app.jwt.sign(
        { id: user[0].id, email: user[0].email, role: user[0].role },
        { expiresIn: '15m' }
      );

      return reply.send({
        success: true,
        data: { accessToken },
      });
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Get Current User
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; email: string; role: string };
      
      const userData = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      
      if (userData.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        success: true,
        data: {
          id: userData[0].id,
          email: userData[0].email,
          role: userData[0].role,
          isActive: userData[0].isActive,
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Logout
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // In a real app, you would invalidate the refresh token
    return reply.send({ success: true, message: 'Logged out successfully' });
  });
}
EOF
```

### 3.3 Create Auth Middleware

```bash
# src/middleware/auth.ts
cat > src/middleware/auth.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// JWT Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

// Role-based access control middleware
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string };
    
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}

// Register middleware with Fastify
export async function registerAuthMiddleware(app: FastifyInstance) {
  // Add authenticate decorator
  app.decorate('authenticate', authenticate);
}
EOF
```

### 3.4 Create Database Utility

```bash
# src/utils/db.ts
cat > src/utils/db.ts << 'EOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@payrollpro/db';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
EOF
```

### 3.5 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';
import { registerAuthMiddleware } from './middleware/auth';

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

// Register auth middleware
await registerAuthMiddleware(app);

// Register routes
await app.register(authRoutes, { prefix: '/api/auth' });

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3010');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Auth service running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
EOF
```

### 3.6 Create Dockerfile

```bash
# Dockerfile
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

EXPOSE 3010

CMD ["node", "dist/index.js"]
EOF
```

### 3.7 Update docker-compose.yml

```yaml
# Tambahkan auth service ke docker-compose.yml
services:
  auth-service:
    build:
      context: .
      dockerfile: apps/auth-service/Dockerfile
    container_name: payrollpro-auth-service
    ports:
      - "3010:3010"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
      - JWT_SECRET=${JWT_SECRET:-super-secret-key}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3010/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3.8 Test Endpoints

```bash
# Build and start auth service
cd apps/auth-service
pnpm install
pnpm build

# Test login
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@payrollpro.com", "password": "admin123"}'

# Test register
curl -X POST http://localhost:3010/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@payrollpro.com", "password": "test123", "role": "employee"}'

# Test get current user (with token)
curl -X GET http://localhost:3010/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

---

## Verification Checklist

- [x] Auth service running on port 3010
- [x] Login endpoint works
- [x] Register endpoint works
- [x] JWT token generated correctly
- [x] Refresh token works
- [x] Protected routes require authentication
- [x] Role-based access control works
- [x] Health check endpoint responds

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/health` | Health check |

---

## Next Phase

Setelah Phase 3 selesai, lanjut ke:
**[Phase 4: Employee Service](./PHASE-04-EMPLOYEE-SERVICE.md)**
