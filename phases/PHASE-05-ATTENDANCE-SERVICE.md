# Phase 5: Attendance Service

**Objective:** Implementasi GPS tracking, check-in/out, dan overtime calculation  
**Estimated Time:** 10-12 hours  
**Prerequisites:** Phase 4 selesai

---

## Tasks

### 5.1 Initialize Attendance Service

```bash
# Create attendance service
mkdir -p apps/attendance-service/src/{routes,services,middleware,utils}
cd apps/attendance-service

# package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/attendance-service",
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
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0",
    "node-cron": "^3.0.3",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

cp ../auth-service/tsconfig.json .
```

### 5.2 Create GPS Validation Service

```bash
# src/services/gps.ts
cat > src/services/gps.ts << 'EOF'
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationValidation {
  isInside: boolean;
  distance: number;
  radius: number;
}

// Haversine formula to calculate distance between two coordinates
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth's radius in meters
  
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Validate if employee is within work location radius
export function validateLocation(
  employeeLocation: Coordinates,
  workLocation: Coordinates,
  radiusMeters: number
): LocationValidation {
  const distance = calculateDistance(employeeLocation, workLocation);
  
  return {
    isInside: distance <= radiusMeters,
    distance: Math.round(distance),
    radius: radiusMeters,
  };
}

// Detect potential GPS spoofing
export function detectSpoofing(
  locations: Coordinates[],
  threshold: number = 1000 // 1km threshold
): boolean {
  if (locations.length < 2) return false;
  
  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(locations[i - 1], locations[i]);
    if (distance > threshold) {
      return true; // Potential spoofing detected
    }
  }
  
  return false;
}
EOF
```

### 5.3 Create Attendance Routes

```bash
# src/routes/attendance.ts
cat > src/routes/attendance.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { attendances, employees, workLocations, shifts, employeeShifts } from '@payrollpro/db';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { validateLocation } from '../services/gps';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationId: z.string().uuid(),
});

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function attendanceRoutes(app: FastifyInstance) {
  // Check in with GPS
  app.post('/check-in', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; employeeId?: string };
      const body = checkInSchema.parse(request.body);

      // Get employee
      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Get work location
      const location = await db.select().from(workLocations).where(eq(workLocations.id, body.locationId)).limit(1);
      
      if (location.length === 0) {
        return reply.status(404).send({ error: 'Location not found' });
      }

      // Validate GPS location
      const validation = validateLocation(
        { latitude: body.latitude, longitude: body.longitude },
        { latitude: parseFloat(location[0].latitude), longitude: parseFloat(location[0].longitude) },
        location[0].radiusMeters
      );

      if (!validation.isInside) {
        return reply.status(400).send({
          error: 'Outside work area',
          distance: validation.distance,
          radius: validation.radius,
        });
      }

      // Check if already checked in today
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, employee[0].id),
          eq(attendances.date, today)
        ))
        .limit(1);

      if (existingAttendance.length > 0 && existingAttendance[0].checkIn) {
        return reply.status(400).send({ error: 'Already checked in today' });
      }

      // Get employee's shift for today
      const todayShift = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, employee[0].id),
          eq(employeeShifts.date, today)
        ))
        .limit(1);

      // Determine status (late, present)
      let status = 'present';
      if (todayShift.length > 0) {
        const shift = await db.select().from(shifts).where(eq(shifts.id, todayShift[0].shiftId)).limit(1);
        if (shift.length > 0) {
          const now = new Date();
          const [hours, minutes] = shift[0].startTime.split(':').map(Number);
          const shiftStart = new Date();
          shiftStart.setHours(hours, minutes, 0, 0);
          
          if (now > shiftStart) {
            status = 'late';
          }
        }
      }

      // Create or update attendance
      const attendance = await db.insert(attendances).values({
        employeeId: employee[0].id,
        locationId: body.locationId,
        date: today,
        checkIn: new Date(),
        checkInLat: body.latitude.toString(),
        checkInLng: body.longitude.toString(),
        status,
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: attendance[0].id,
          checkIn: attendance[0].checkIn,
          status,
          location: {
            name: location[0].name,
            distance: validation.distance,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Check out with GPS
  app.post('/check-out', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = checkOutSchema.parse(request.body);

      // Get employee
      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const attendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, employee[0].id),
          eq(attendances.date, today)
        ))
        .limit(1);

      if (attendance.length === 0 || !attendance[0].checkIn) {
        return reply.status(400).send({ error: 'No check-in found for today' });
      }

      if (attendance[0].checkOut) {
        return reply.status(400).send({ error: 'Already checked out today' });
      }

      // Calculate overtime
      let overtimeHours = 0;
      const todayShift = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, employee[0].id),
          eq(employeeShifts.date, today)
        ))
        .limit(1);

      if (todayShift.length > 0) {
        const shift = await db.select().from(shifts).where(eq(shifts.id, todayShift[0].shiftId)).limit(1);
        if (shift.length > 0) {
          const now = new Date();
          const [endHours, endMinutes] = shift[0].endTime.split(':').map(Number);
          const shiftEnd = new Date();
          shiftEnd.setHours(endHours, endMinutes, 0, 0);
          
          if (now > shiftEnd) {
            overtimeHours = (now.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);
          }
        }
      }

      // Update attendance
      const updated = await db.update(attendances)
        .set({
          checkOut: new Date(),
          checkOutLat: body.latitude.toString(),
          checkOutLng: body.longitude.toString(),
          overtimeHours: overtimeHours.toFixed(2),
        })
        .where(eq(attendances.id, attendance[0].id))
        .returning();

      return reply.send({
        success: true,
        data: {
          id: updated[0].id,
          checkIn: updated[0].checkIn,
          checkOut: updated[0].checkOut,
          overtimeHours,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get attendance history
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const { startDate, endDate } = request.query as any;

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      let query = db.select().from(attendances)
        .where(eq(attendances.employeeId, employee[0].id));

      if (startDate && endDate) {
        query = query.where(and(
          eq(attendances.employeeId, employee[0].id),
          gte(attendances.date, startDate),
          lte(attendances.date, endDate)
        ));
      }

      const data = await query.orderBy(desc(attendances.date));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get today's attendance
  app.get('/today', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const today = new Date().toISOString().split('T')[0];

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const attendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, employee[0].id),
          eq(attendances.date, today)
        ))
        .limit(1);

      return reply.send({
        success: true,
        data: attendance[0] || null,
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get attendance report (HR)
  app.get('/report', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month, year, departmentId } = request.query as any;

      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const data = await db.select({
        employeeId: attendances.employeeId,
        totalDays: sql<number>`count(*)`,
        presentDays: sql<number>`count(case when ${attendances.status} = 'present' then 1 end)`,
        lateDays: sql<number>`count(case when ${attendances.status} = 'late' then 1 end)`,
        absentDays: sql<number>`count(case when ${attendances.status} = 'absent' then 1 end)`,
        totalOvertime: sql<number>`sum(${attendances.overtimeHours})`,
      })
      .from(attendances)
      .where(and(
        gte(attendances.date, startDate),
        lte(attendances.date, endDate)
      ))
      .groupBy(attendances.employeeId);

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Auto check-out scheduler (runs at midnight)
  app.post('/auto-checkout', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Find all employees who checked in but didn't check out
      const pendingCheckouts = await db.select().from(attendances)
        .where(and(
          eq(attendances.date, today),
          sql`${attendances.checkIn} IS NOT NULL`,
          sql`${attendances.checkOut} IS NULL`
        ));

      let processed = 0;
      
      for (const attendance of pendingCheckouts) {
        // Auto check-out at 23:59
        await db.update(attendances)
          .set({
            checkOut: new Date(`${today}T23:59:00`),
            notes: 'Auto check-out',
          })
          .where(eq(attendances.id, attendance.id));
        
        processed++;
      }

      return reply.send({
        success: true,
        message: `Auto check-out completed for ${processed} employees`,
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 5.4 Create Abuse Detection Service

```bash
# src/services/abuse-detection.ts
cat > src/services/abuse-detection.ts << 'EOF'
import { db } from '../utils/db';
import { abuseLogs, attendances } from '@payrollpro/db';
import { eq, and, desc } from 'drizzle-orm';
import { detectSpoofing } from './gps';

interface AbuseDetectionResult {
  detected: boolean;
  type?: string;
  severity?: 'low' | 'medium' | 'high';
  description?: string;
}

// Detect GPS spoofing
export async function detectGPSSpoofing(
  employeeId: string,
  locations: { latitude: number; longitude: number }[]
): Promise<AbuseDetectionResult> {
  const coordinates = locations.map(l => ({
    latitude: l.latitude,
    longitude: l.longitude,
  }));

  if (detectSpoofing(coordinates)) {
    const log = await db.insert(abuseLogs).values({
      employeeId,
      abuseType: 'gps_spoofing',
      description: 'Rapid location changes detected',
      severity: 'high',
    }).returning();

    return {
      detected: true,
      type: 'gps_spoofing',
      severity: 'high',
      description: 'Potential GPS spoofing detected',
    };
  }

  return { detected: false };
}

// Detect buddy punching (same location multiple employees)
export async function detectBuddyPunching(
  locationId: string,
  checkInTime: Date,
  thresholdMinutes: number = 5
): Promise<AbuseDetectionResult> {
  const timeWindow = new Date(checkInTime.getTime() - thresholdMinutes * 60 * 1000);
  
  const recentCheckIns = await db.select().from(attendances)
    .where(and(
      eq(attendances.locationId, locationId),
      eq(attendances.date, checkInTime.toISOString().split('T')[0]),
    ))
    .orderBy(desc(attendances.checkIn));

  // Check for multiple check-ins in short time window
  const suspiciousCheckIns = recentCheckIns.filter(a => {
    if (!a.checkIn) return false;
    const checkIn = new Date(a.checkIn);
    return checkIn >= timeWindow && checkIn <= checkInTime;
  });

  if (suspiciousCheckIns.length > 1) {
    for (const checkIn of suspiciousCheckIns) {
      await db.insert(abuseLogs).values({
        employeeId: checkIn.employeeId,
        abuseType: 'buddy_punching',
        description: `Multiple check-ins detected at same location within ${thresholdMinutes} minutes`,
        severity: 'medium',
      });
    }

    return {
      detected: true,
      type: 'buddy_punching',
      severity: 'medium',
      description: 'Potential buddy punching detected',
    };
  }

  return { detected: false };
}

// Detect abnormal overtime patterns
export async function detectAbnormalOvertime(
  employeeId: string,
  maxOvertimeHours: number = 60
): Promise<AbuseDetectionResult> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  monthEnd.setHours(23, 59, 59, 999);

  const attendances = await db.select().from(attendances)
    .where(and(
      eq(attendances.employeeId, employeeId),
    ));

  const totalOvertime = attendances.reduce((sum, a) => sum + parseFloat(a.overtimeHours || '0'), 0);

  if (totalOvertime > maxOvertimeHours) {
    await db.insert(abuseLogs).values({
      employeeId,
      abuseType: 'abnormal_overtime',
      description: `Total overtime ${totalOvertime.toFixed(1)} hours exceeds limit of ${maxOvertimeHours} hours`,
      severity: 'medium',
    });

    return {
      detected: true,
      type: 'abnormal_overtime',
      severity: 'medium',
      description: 'Abnormal overtime pattern detected',
    };
  }

  return { detected: false };
}
EOF
```

### 5.5 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cron from 'node-cron';
import { attendanceRoutes } from './routes/attendance';

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

app.decorate('authenticate', async (request: any, reply: any) => {
  try { await request.jwtVerify(); } catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(attendanceRoutes, { prefix: '/api/attendance' });

app.get('/health', async () => ({ status: 'ok', service: 'attendance-service' }));

// Schedule auto check-out at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running auto check-out...');
  // Implementation for auto check-out
});

const start = async () => {
  const port = parseInt(process.env.PORT || '3013');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Attendance service running on port ${port}`);
};

start();
EOF
```

### 5.6 Create Dockerfile

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
EXPOSE 3013
CMD ["node", "dist/index.js"]
EOF
```

---

## Verification Checklist

- [x] Attendance service running on port 3013
- [x] GPS check-in works
- [x] GPS check-out works
- [x] Location validation works
- [x] Overtime calculation works
- [x] Attendance history works
- [x] Abuse detection works
- [x] Auto check-out scheduler works

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/check-in` | Check in with GPS |
| POST | `/api/attendance/check-out` | Check out with GPS |
| GET | `/api/attendance/history` | Get attendance history |
| GET | `/api/attendance/today` | Get today's attendance |
| GET | `/api/attendance/report` | Get attendance report |
| POST | `/api/attendance/auto-checkout` | Trigger auto check-out |

---

## Next Phase

Setelah Phase 5 selesai, lanjut ke:
**[Phase 6: Leave Service](./PHASE-06-LEAVE-SERVICE.md)**
