import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@payrollpro/shared-types';

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !allowedRoles.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
    }
  };
}
