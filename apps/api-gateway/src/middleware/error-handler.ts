import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorResponse } from '../types/index.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode,
      error: error.name || 'InternalServerError',
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    };

    // Validation errors
    if (error.validation || error.name === 'ZodError') {
      errorResponse.statusCode = 400;
      errorResponse.error = 'ValidationError';
      errorResponse.message = 'Request validation failed';
      errorResponse.details = error.validation || error.errors;
      return reply.status(400).send(errorResponse);
    }

    // Rate limit errors
    if (error.code === 'FST_ERR_RATE_LIMIT' || statusCode === 429) {
      errorResponse.statusCode = 429;
      errorResponse.error = 'RateLimitExceeded';
      errorResponse.message = 'Too many requests. Please slow down.';
      return reply.status(429).send(errorResponse);
    }

    // JWT / Authentication errors
    if (
      error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
      error.code === 'FST_JWT_BAD_REQUEST' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' ||
      statusCode === 401
    ) {
      errorResponse.statusCode = 401;
      errorResponse.error = 'Unauthorized';
      errorResponse.message = error.message || 'Authentication required or invalid token';
      return reply.status(401).send(errorResponse);
    }

    // Network / Proxy connection errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('fetch failed')
    ) {
      errorResponse.statusCode = 502;
      errorResponse.error = 'BadGateway';
      errorResponse.message = 'Downstream microservice is unavailable or connection refused';
      return reply.status(502).send(errorResponse);
    }

    // 5xx Server errors
    if (statusCode >= 500) {
      request.log.error(error);
    }

    return reply.status(statusCode).send(errorResponse);
  });
}
