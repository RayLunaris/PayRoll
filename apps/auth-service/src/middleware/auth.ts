import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@payrollpro/shared-types';

// JWT Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}

// Role-based access control middleware
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
  };
}

// Register middleware with Fastify
export async function registerAuthMiddleware(app: FastifyInstance) {
  app.decorate('authenticate', authenticate);
}
