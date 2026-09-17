import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, workLocations, eq, desc } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.union([z.number().min(-90).max(90), z.string()]).transform(val => String(val)),
  longitude: z.union([z.number().min(-180).max(180), z.string()]).transform(val => String(val)),
  radiusMeters: z.number().positive().default(100),
});

const validateLocationSchema = z.object({
  locationId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function locationRoutes(app: FastifyInstance) {
  // Get all locations
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(workLocations).orderBy(desc(workLocations.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get location by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const location = await db.select().from(workLocations).where(eq(workLocations.id, id)).limit(1);
      
      if (location.length === 0) {
        return reply.status(404).send({ success: false, error: 'Location not found' });
      }

      return reply.send({ success: true, data: location[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create location (Admin only)
  app.post('/', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = locationSchema.parse(request.body);
      const newLocation = await db.insert(workLocations).values(body).returning();
      return reply.status(201).send({ success: true, data: newLocation[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update location (Admin only)
  app.put('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = locationSchema.partial().parse(request.body);
      const updated = await db.update(workLocations).set(body).where(eq(workLocations.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Location not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete location (Admin only)
  app.delete('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(workLocations).where(eq(workLocations.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Location not found' });
      }

      return reply.send({ success: true, message: 'Location deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Validate GPS location (Haversine Formula)
  app.post('/validate-location', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId, latitude, longitude } = validateLocationSchema.parse(request.body);
      
      const result = await db.select().from(workLocations).where(eq(workLocations.id, locationId)).limit(1);
      
      if (result.length === 0) {
        return reply.status(404).send({ success: false, error: 'Location not found' });
      }

      const location = result[0];
      const locLat = Number(location.latitude);
      const locLng = Number(location.longitude);
      const radiusMeters = location.radiusMeters || 100;

      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (locLat * Math.PI) / 180;
      const φ2 = (latitude * Math.PI) / 180;
      const Δφ = ((latitude - locLat) * Math.PI) / 180;
      const Δλ = ((longitude - locLng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const isInside = distance <= radiusMeters;

      return reply.send({
        success: true,
        data: {
          isInside,
          distance: Math.round(distance),
          radius: radiusMeters,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
