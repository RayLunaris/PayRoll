import '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@payrollpro/shared-types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      role: UserRole;
      type?: string;
    };
    user: {
      id: string;
      email: string;
      role: UserRole;
      type?: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    uploadDir: string;
  }
}
