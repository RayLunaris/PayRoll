import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@payrollpro/shared-types';
import { db, users, eq } from '@payrollpro/db';

// JWT Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    if ((request.user as any)?.type === 'refresh') {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  } catch (err) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }

  // Re-verify the account's liveness on every request so a deactivated user is
  // locked out immediately even while holding a still-valid access token.
  const storedUser = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, request.user.id)).limit(1);
  if (storedUser.length === 0 || !storedUser[0].isActive) {
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
