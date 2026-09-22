import '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@payrollpro/shared-types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      userId?: string;
      email: string;
      role: UserRole;
      employeeId?: string;
      departmentId?: string;
      type?: string;
      jti?: string;
    };
    user: {
      id: string;
      userId?: string;
      email: string;
      role: UserRole;
      employeeId?: string;
      departmentId?: string;
      type?: string;
      jti?: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
