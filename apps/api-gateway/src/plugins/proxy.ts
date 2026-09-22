import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ServiceConfig } from '../types/index.js';

export const SERVICES: ServiceConfig[] = [
  { name: 'auth', prefix: '/api/auth', url: process.env.AUTH_SERVICE_URL || 'http://localhost:3010', auth: false },
  { name: 'employees', prefix: '/api/employees', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'departments', prefix: '/api/departments', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'positions', prefix: '/api/positions', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'locations', prefix: '/api/locations', url: process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011', auth: true },
  { name: 'payrolls', prefix: '/api/payrolls', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'cash-advances', prefix: '/api/cash-advances', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'bpjs-config', prefix: '/api/bpjs-config', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'tax-config', prefix: '/api/tax-config', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'overtime-rates', prefix: '/api/overtime-rates', url: process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012', auth: true },
  { name: 'attendance', prefix: '/api/attendance', url: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3013', auth: true },
  { name: 'leaves', prefix: '/api/leaves', url: process.env.LEAVE_SERVICE_URL || 'http://localhost:3014', auth: true },
  { name: 'posts', prefix: '/api/posts', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'messages', prefix: '/api/messages', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'announcements', prefix: '/api/announcements', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'uploads', prefix: '/api/uploads', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: true },
  { name: 'social-static', prefix: '/uploads', url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015', auth: false },
  { name: 'shifts', prefix: '/api/shifts', url: process.env.SHIFT_SERVICE_URL || 'http://localhost:3016', auth: true },
];

export async function registerProxy(app: FastifyInstance) {
  for (const service of SERVICES) {
    await app.register(async (serviceApp: FastifyInstance) => {
      // Proxy request handler
      const handleProxy = async (request: FastifyRequest, reply: FastifyReply) => {
        const headers: Record<string, string> = {
          'content-type': (request.headers['content-type'] as string) || 'application/json',
          'accept': (request.headers['accept'] as string) || 'application/json',
        };

        if (request.headers.authorization) {
          headers['authorization'] = request.headers.authorization as string;
        }

        // Pass user identity headers if authenticated
        if (request.user) {
          headers['x-user-id'] = request.user.id || (request.user as any).userId;
          headers['x-employee-id'] = (request.user as any).employeeId || '';
          headers['x-department-id'] = (request.user as any).departmentId || '';
          headers['x-user-email'] = request.user.email;
          headers['x-user-role'] = request.user.role;
        }

        const targetUrl = `${service.url}${request.url}`;

        try {
          const fetchOptions: RequestInit = {
            method: request.method,
            headers,
            signal: AbortSignal.timeout(10000),
          };

          if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined) {
            // Pass raw bytes through for multipart uploads; otherwise serialize JSON body
            fetchOptions.body = request.body instanceof Buffer
              ? request.body
              : (typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
          }

          const response = await fetch(targetUrl, fetchOptions);

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            return reply.status(response.status).send(data);
          } else {
            // Binary/static content: pass through raw bytes
            const buffer = Buffer.from(await response.arrayBuffer());
            return reply.status(response.status).type(contentType || 'application/octet-stream').send(buffer);
          }
        } catch (error: any) {
          request.log.error({ error, targetUrl, service: service.name }, 'Downstream proxy error');
          return reply.status(502).send({
            success: false,
            statusCode: 502,
            error: 'BadGateway',
            message: `Service [${service.name}] is unreachable or encountered a network error`,
            timestamp: new Date().toISOString(),
          });
        }
      };

      const preHandler = service.auth ? [app.authenticate] : [];

      serviceApp.all('/*', { preHandler }, handleProxy);
      serviceApp.all('/', { preHandler }, handleProxy);
    }, { prefix: service.prefix });
  }
}
