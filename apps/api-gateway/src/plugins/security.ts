import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

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
