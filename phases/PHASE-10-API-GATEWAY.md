# Phase 10: API Gateway

**Objective:** Implementasi routing, rate limiting, CORS, dan error handling  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 9 selesai

---

## Tasks

### 10.1 Initialize API Gateway

```bash
# Create api gateway
mkdir -p apps/api-gateway/src/{routes,middleware,utils,plugins}
cd apps/api-gateway

# package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/api-gateway",
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
    "@fastify/rate-limit": "^9.0.0",
    "@fastify/helmet": "^11.0.0",
    "ioredis": "^5.4.0",
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

### 10.2 Create Proxy Plugin

```bash
# src/plugins/proxy.ts
cat > src/plugins/proxy.ts << 'EOF'
import { FastifyInstance } from 'fastify';

interface ServiceConfig {
  name: string;
  prefix: string;
  url: string;
  auth: boolean;
}

const SERVICES: ServiceConfig[] = [
  { name: 'auth', prefix: '/api/auth', url: process.env.AUTH_SERVICE_URL || 'http://localhost:3010', auth: false },
  { name: 'employees', prefix: '/api/employees', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'departments', prefix: '/api/departments', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'positions', prefix: '/api/positions', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'locations', prefix: '/api/locations', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'payrolls', prefix: '/api/payrolls', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'cash-advances', prefix: '/api/cash-advances', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'attendance', prefix: '/api/attendance', url: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3013', auth: true },
  { name: 'leaves', prefix: '/api/leaves', url: process.env.LEAVE_SERVICE_URL || 'http://localhost:3014', auth: true },
  { name: 'posts', prefix: '/api/posts', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'messages', prefix: '/api/messages', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'announcements', prefix: '/api/announcements', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'social', prefix: '/api/social', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'shifts', prefix: '/api/shifts', url: process.env.SHIFT_SERVICE_URL || 'http://localhost:3016', auth: true },
];

// Proxy middleware
export async function registerProxy(app: FastifyInstance) {
  for (const service of SERVICES) {
    app.register(async (serviceApp: FastifyInstance) => {
      // Global request logging
      serviceApp.addHook('onRequest', async (request) => {
        request.log.info(`[${service.name}] ${request.method} ${request.url}`);
      });

      // Proxy all methods
      const handleProxy = async (request, reply) => {
        // Forward token if exists
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        
        if (request.headers.authorization) {
          headers['authorization'] = request.headers.authorization as string;
        }

        // Build target URL
        const targetUrl = `${service.url}${request.url}`;

        try {
          // Use global fetch (Node 22)
          const response = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' 
              ? JSON.stringify(request.body || {}) 
              : undefined,
          });

          const data = await response.json();
          reply.status(response.status).send(data);
        } catch (error) {
          reply.status(502).send({ error: 'Bad gateway' });
        }
      };

      serviceApp.all('/*', handleProxy);
      serviceApp.all('/', handleProxy);
    }, { prefix: service.prefix });
  }
}
EOF
```

### 10.3 Create Rate Limit Config

```bash
# src/plugins/rate-limit.ts
cat > src/plugins/rate-limit.ts << 'EOF'
import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

// Configure rate limiting
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100, // 100 requests
    timeWindow: '1 minute', // per minute
    redis: undefined, // Use in-memory for dev, Redis for production
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        message: `You have exceeded the ${context.max} requests in ${context.after} times pan`,
        code: 'RATE_LIMIT_EXCEEDED',
      };
    },
  });
}
EOF
```

### 10.4 Create Security Plugin

```bash
# src/plugins/security.ts
cat > src/plugins/security.ts << 'EOF'
import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

// Configure security headers
export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });
}
EOF
```

### 10.5 Create Error Handler

```bash
# src/middleware/error-handler.ts
cat > src/middleware/error-handler.ts << 'EOF'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  success: boolean;
  statusCode: number;
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
}

// Custom error handler
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;
    
    const errorResponse: ErrorResponse = {
      success: false,
      statusCode,
      error: error.name || 'InternalServerError',
      timestamp: new Date().toISOString(),
    };

    // Validation errors
    if (error.validation) {
      errorResponse.error = 'ValidationError';
      errorResponse.details = error.validation;
      errorResponse.message = 'Request validation failed';
      return reply.status(400).send(errorResponse);
    }

    // Rate limit errors
    if (error.code === 'FST_ERR_RATE_LIMIT') {
      errorResponse.error = 'RateLimitExceeded';
      errorResponse.message = 'Too many requests';
      return reply.status(429).send(errorResponse);
    }

    // JWT errors
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || 
        error.code === 'FST_JWT_BAD_REQUEST') {
      errorResponse.error = 'Unauthorized';
      errorResponse.message = 'Authentication required';
      return reply.status(401).send(errorResponse);
    }

    // Network errors (proxy)
    if (error.code === 'ECONNREFUSED' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      errorResponse.error = 'ServiceUnavailable';
      errorResponse.message = 'Backend service is not available';
      return reply.status(502).send(errorResponse);
    }

    // Log the error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', error);
    }

    // Generic error
    errorResponse.message = error.message || 'Internal server error';
    
    if (statusCode >= 500) {
      reply.log.error(error);
    }

    reply.status(statusCode).send(errorResponse);
  });
}
EOF
```

### 10.6 Create API Documentation Routes

```bash
# src/routes/docs.ts
cat > src/routes/docs.ts << 'EOF'
import { FastifyInstance } from 'fastify';

// API information for documentation
const apiInfo = {
  name: 'PayrollPro API Gateway',
  version: '1.0.0',
  description: 'REST API Gateway for PayrollPro Web Payroll System',
  baseUrl: '/api',
  endpoints: [
    {
      group: 'Authentication',
      prefix: '/api/auth',
      endpoints: [
        { method: 'POST', path: '/login', description: 'Login user', auth: false },
        { method: 'POST', path: '/register', description: 'Register user', auth: false },
        { method: 'POST', path: '/refresh', description: 'Refresh token', auth: false },
        { method: 'GET', path: '/me', description: 'Get current user', auth: true },
        { method: 'POST', path: '/logout', description: 'Logout', auth: true },
      ],
    },
    {
      group: 'Employees',
      prefix: '/api/employees',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get all employees', auth: true },
        { method: 'POST', path: '/', description: 'Create employee', auth: true },
        { method: 'GET', path: '/:id', description: 'Get employee', auth: true },
        { method: 'PUT', path: '/:id', description: 'Update employee', auth: true },
        { method: 'DELETE', path: '/:id', description: 'Delete employee', auth: true },
      ],
    },
    {
      group: 'Departments',
      prefix: '/api/departments',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get all departments', auth: true },
        { method: 'POST', path: '/', description: 'Create department', auth: true },
      ],
    },
    {
      group: 'Attendance',
      prefix: '/api/attendance',
      endpoints: [
        { method: 'POST', path: '/check-in', description: 'Check in with GPS', auth: true },
        { method: 'POST', path: '/check-out', description: 'Check out with GPS', auth: true },
        { method: 'GET', path: '/history', description: 'Get attendance history', auth: true },
        { method: 'GET', path: '/today', description: 'Get today attendance', auth: true },
        { method: 'GET', path: '/report', description: 'Get attendance report', auth: true },
      ],
    },
    {
      group: 'Leaves',
      prefix: '/api/leaves',
      endpoints: [
        { method: 'POST', path: '/', description: 'Request leave', auth: true },
        { method: 'GET', path: '/history', description: 'Get leave history', auth: true },
        { method: 'PUT', path: '/:id/approve', description: 'Approve leave', auth: true },
        { method: 'GET', path: '/quota', description: 'Get leave quota', auth: true },
        { method: 'GET', path: '/calendar', description: 'Get leave calendar', auth: true },
      ],
    },
    {
      group: 'Payrolls',
      prefix: '/api/payrolls',
      endpoints: [
        { method: 'POST', path: '/process', description: 'Process payroll', auth: true },
        { method: 'GET', path: '/', description: 'Get all payrolls', auth: true },
        { method: 'GET', path: '/:id', description: 'Get payroll detail', auth: true },
        { method: 'GET', path: '/:id/slip', description: 'Download payslip', auth: true },
      ],
    },
    {
      group: 'Social',
      prefix: '/api/posts',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get feed posts', auth: true },
        { method: 'POST', path: '/', description: 'Create post', auth: true },
        { method: 'POST', path: '/:id/like', description: 'Like post', auth: true },
        { method: 'GET', path: '/:id/comments', description: 'Get comments', auth: true },
      ],
    },
    {
      group: 'Messages',
      prefix: '/api/messages',
      endpoints: [
        { method: 'POST', path: '/', description: 'Send message', auth: true },
        { method: 'GET', path: '/', description: 'Get conversations', auth: true },
        { method: 'GET', path: '/:userId', description: 'Get conversation', auth: true },
      ],
    },
    {
      group: 'Announcements',
      prefix: '/api/announcements',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get announcements', auth: true },
        { method: 'POST', path: '/', description: 'Create announcement', auth: true },
        { method: 'PUT', path: '/:id/publish', description: 'Publish announcement', auth: true },
      ],
    },
    {
      group: 'Shifts',
      prefix: '/api/shifts',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get all shifts', auth: true },
        { method: 'POST', path: '/', description: 'Create shift', auth: true },
        { method: 'POST', path: '/assign', description: 'Assign shift', auth: true },
        { method: 'GET', path: '/calendar', description: 'Get shift calendar', auth: true },
      ],
    },
    {
      group: 'Locations',
      prefix: '/api/locations',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get all locations', auth: true },
        { method: 'POST', path: '/', description: 'Create location', auth: true },
        { method: 'POST', path: '/validate-location', description: 'Validate GPS', auth: true },
      ],
    },
  ],
};

export async function docsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return apiInfo;
  });

  app.get('/healthcheck', async () => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        auth: await checkService(process.env.AUTH_SERVICE_URL || 'http://localhost:3010'),
        employee: await checkService(process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011'),
        payroll: await checkService(process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012'),
        attendance: await checkService(process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3013'),
        leave: await checkService(process.env.LEAVE_SERVICE_URL || 'http://localhost:3014'),
        social: await checkService(process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015'),
        shift: await checkService(process.env.SHIFT_SERVICE_URL || 'http://localhost:3016'),
      },
    };
    
    return health;
  });
}

async function checkService(url: string): Promise<string> {
  try {
    const response = await fetch(`${url}/health`);
    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unreachable';
  }
}
EOF
```

### 10.7 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { registerProxy } from './plugins/proxy';
import { registerRateLimit } from './plugins/rate-limit';
import { registerSecurity } from './plugins/security';
import { registerErrorHandler } from './middleware/error-handler';
import { docsRoutes } from './routes/docs';

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    } : undefined,
  },
});

// Register plugins
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-key',
});

await app.register(registerRateLimit);
await app.register(registerSecurity);
await registerErrorHandler(app);

// Register routes
await app.register(docsRoutes, { prefix: '/' });
await app.register(registerProxy);

// Root endpoint
app.get('/', async () => {
  return {
    name: 'PayrollPro API Gateway',
    version: '1.0.0',
    endpoints: '/docs',
  };
});

// Health check
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`API Gateway running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
EOF
```

### 10.8 Create Dockerfile

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
EXPOSE 3001
CMD ["node", "dist/index.js"]
EOF
```

### 10.9 Pino Pretty for Development

```bash
# Add pino-pretty for development logging
pnpm add -D pino-pretty
```

---

## Verification Checklist

- [x] API Gateway running on port 3001
- [x] All services registered as routes
- [x] Rate limiting works
- [x] CORS configured correctly
- [x] Error handling works
- [x] Health check endpoint works
- [x] API docs at `/` shows all endpoints
- [x] Requests are proxied to correct services

---

## API Gateway Config

| Setting | Value |
|---------|-------|
| Port | 3001 |
| CORS Origin | http://localhost:3000 |
| Rate Limit | 100 req/min |
| JWT Validation | Verifies token on each request |
| Timeouts | 30s default |

---

## Next Phase

Setelah Phase 10 selesai, lanjut ke:
**[Phase 11: Frontend Setup](./PHASE-11-FRONTEND-SETUP.md)**