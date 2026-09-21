import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, attendances, employees, workLocations, shifts, employeeShifts, abuseLogs, leaves, payrolls, overtimeRequests, users, eq, and, desc, sql, gte, lte, inArray, ne } from '@payrollpro/db';
import { getWIBDateString, getWIBTimeString, timeToMinutes } from '@payrollpro/shared-types';
import { validateLocation } from '../services/gps.js';
import { detectBuddyPunching, detectGPSSpoofing, detectAbnormalOvertime } from '../services/abuse-detection.js';
import { requireRole } from '../middleware/auth.js';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  photoUrl: z.string().optional(),
  locationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
});

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  employeeId: z.string().uuid().optional(),
});

export async function performAutoCheckout(): Promise<number> {
  const today = getWIBDateString();
  const pendingCheckouts = await db.select().from(attendances)
    .where(and(
      eq(attendances.date, today),
      sql`${attendances.checkIn} IS NOT NULL`,
      sql`${attendances.checkOut} IS NULL`
    ));

  let processed = 0;
  for (const attendance of pendingCheckouts) {
    let checkOutTime = new Date();
    if (attendance.employeeId) {
      const shiftResult = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, attendance.employeeId),
          eq(employeeShifts.date, today)
        ))
        .limit(1);

      if (shiftResult.length > 0 && shiftResult[0].shiftId) {
        const shiftData = await db.select().from(shifts).where(eq(shifts.id, shiftResult[0].shiftId)).limit(1);
        if (shiftData.length > 0) {
          checkOutTime = new Date(`${today}T${shiftData[0].endTime}:00+07:00`);
        }
      }
    }

    await db.update(attendances)
      .set({
        checkOut: checkOutTime,
        overtimeHours: '0.00',
        notes: 'Auto check-out',
      })
      .where(eq(attendances.id, attendance.id));
    processed++;
  }
  return processed;
}

// Resolve target employee (anti-impersonation)
async function resolveTargetEmployee(
  user: { id: string; role: string },
  requestedEmployeeId: string | undefined,
): Promise<{ employeeId: string; isOwn: boolean } | null> {
  const own = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
  const canActForOthers = ['super_admin', 'hr_admin'].includes(user.role);

  if (own.length > 0) {
    if (requestedEmployeeId && own[0].id !== requestedEmployeeId && !canActForOthers) {
      return { employeeId: '', isOwn: false };
    }
    return { employeeId: requestedEmployeeId || own[0].id, isOwn: !requestedEmployeeId || requestedEmployeeId === own[0].id };
  }

  if (canActForOthers && requestedEmployeeId) {
    return { employeeId: requestedEmployeeId, isOwn: false };
  }

  return null;
}

// Number of Mon-Fri days in an inclusive WIB date range (timezone-safe).
function countWeekdays(rangeStart: string, rangeEnd: string): number {
  let count = 0;
  const [sy, sm, sd] = rangeStart.split('-').map(Number);
  const [ey, em, ed] = rangeEnd.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// Overtime only counts after this many minutes past the shift end time.
const OVERTIME_GRACE_MINUTES = parseInt(process.env.OVERTIME_GRACE_MINUTES || '15', 10);

export async function attendanceRoutes(app: FastifyInstance) {
  // Check in with GPS
  app.post('/check-in', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = checkInSchema.parse(request.body);

      const target = await resolveTargetEmployee(user, body.employeeId);
      if (!target) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }
      if (!target.isOwn) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Cannot check-in for another employee' });
      }

      const employee = await db.select().from(employees).where(eq(employees.id, target.employeeId)).limit(1);
      if (employee.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const emp = employee[0];

      // Get work location
      const location = await db.select().from(workLocations).where(eq(workLocations.id, body.locationId)).limit(1);
      if (location.length === 0) {
        return reply.status(404).send({ success: false, error: 'Location not found' });
      }

      const loc = location[0];

      // Strict GPS accuracy verification (enforce <= 100m to reject GeoIP approximations)
      if (body.accuracy !== undefined && body.accuracy > 100) {
        app.log.warn({
          employeeId: emp.id,
          accuracy: body.accuracy,
        }, 'Check-in rejected: GPS accuracy is too low (potential GeoIP/network fix)');

        return reply.status(400).send({
          success: false,
          error: 'Low GPS accuracy',
          message: `Akurasi GPS (±${Math.round(body.accuracy)}m) tidak memenuhi syarat (maksimal 100m). Mohon gunakan smartphone dengan GPS aktif atau berada di area terbuka.`,
          accuracy: body.accuracy,
        });
      }

      // Validate GPS location
      const validation = validateLocation(
        { latitude: body.latitude, longitude: body.longitude },
        { latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) },
        loc.radiusMeters || 100
      );

      if (!validation.isInside) {
        app.log.warn({
          employeeId: emp.id,
          locationId: body.locationId,
          distance: validation.distance,
          radius: validation.radius,
          accuracy: body.accuracy,
        }, 'Check-in rejected: outside work area');

        return reply.status(400).send({
          success: false,
          error: 'Outside work area',
          distance: validation.distance,
          radius: validation.radius,
          accuracy: body.accuracy,
        });
      }

      // Check if already checked in today (using WIB date)
      const today = getWIBDateString();
      const existingAttendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, emp.id),
          eq(attendances.date, today)
        ))
        .limit(1);

      if (existingAttendance.length > 0 && existingAttendance[0].checkIn) {
        return reply.status(400).send({ success: false, error: 'Already checked in today' });
      }

      // Check employee shift for tardiness using WIB time
      let status: 'present' | 'late' = 'present';
      const todayShift = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, emp.id),
          eq(employeeShifts.date, today)
        ))
        .limit(1);

      if (todayShift.length > 0 && todayShift[0].shiftId) {
        const shiftRecord = await db.select().from(shifts).where(eq(shifts.id, todayShift[0].shiftId)).limit(1);
        if (shiftRecord.length > 0) {
          const currentWibMinutes = timeToMinutes(getWIBTimeString());
          const shiftStartMinutes = timeToMinutes(shiftRecord[0].startTime);

          if (currentWibMinutes > shiftStartMinutes) {
            status = 'late';
          }
        }
      }

      const now = new Date();

      // Record check-in
      let attendanceRecord;
      if (existingAttendance.length > 0) {
        const updated = await db.update(attendances)
          .set({
            locationId: body.locationId,
            checkIn: now,
            checkInLat: body.latitude.toString(),
            checkInLng: body.longitude.toString(),
            checkInPhotoUrl: body.photoUrl,
            status,
          })
          .where(eq(attendances.id, existingAttendance[0].id))
          .returning();
        attendanceRecord = updated[0];
      } else {
        const created = await db.insert(attendances).values({
          employeeId: emp.id,
          locationId: body.locationId,
          date: today,
          checkIn: now,
          checkInLat: body.latitude.toString(),
          checkInLng: body.longitude.toString(),
          checkInPhotoUrl: body.photoUrl,
          status,
          overtimeHours: '0',
        }).onConflictDoNothing({
          target: [attendances.employeeId, attendances.date],
        }).returning();

        if (created.length > 0) {
          attendanceRecord = created[0];
        } else {
          // Race: a concurrent check-in request created this record first
          const raceWinner = await db.select().from(attendances)
            .where(and(
              eq(attendances.employeeId, emp.id),
              eq(attendances.date, today)
            ))
            .limit(1);
          if (raceWinner.length === 0 || raceWinner[0].checkIn) {
            return reply.status(400).send({ success: false, error: 'Already checked in today' });
          }
          attendanceRecord = raceWinner[0];
        }
      }

      // GPS spoofing detection: feed today's check-in coordinates
      // (oldest -> newest, including this one) into the rapid-jump detector.
      const recentCheckIns = await db.select({
        latitude: attendances.checkInLat,
        longitude: attendances.checkInLng,
      })
        .from(attendances)
        .where(and(
          eq(attendances.employeeId, emp.id),
          eq(attendances.date, today),
          sql`${attendances.checkInLat} IS NOT NULL`,
          sql`${attendances.checkInLng} IS NOT NULL`
        ))
        .orderBy(desc(attendances.checkIn))
        .limit(10);
      const checkInCoords = recentCheckIns
        .map((r) => ({ latitude: parseFloat(r.latitude!), longitude: parseFloat(r.longitude!) }))
        .reverse();

      if (checkInCoords.length >= 2) {
        await detectGPSSpoofing(emp.id, checkInCoords);
      }

      // Check for buddy punching
      await detectBuddyPunching(body.locationId, now);

      return reply.status(201).send({
        success: true,
        data: {
          id: attendanceRecord.id,
          checkIn: attendanceRecord.checkIn,
          checkInPhotoUrl: attendanceRecord.checkInPhotoUrl,
          status,
          location: {
            name: loc.name,
            distance: validation.distance,
          },
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

  // Check out with GPS
  app.post('/check-out', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = checkOutSchema.parse(request.body);

      const target = await resolveTargetEmployee(user, body.employeeId);
      if (!target) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }
      if (!target.isOwn) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Cannot check-out for another employee' });
      }

      const employee = await db.select().from(employees).where(eq(employees.id, target.employeeId)).limit(1);
      if (employee.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const emp = employee[0];
      const today = getWIBDateString();

      const attendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, emp.id),
          eq(attendances.date, today)
        ))
        .limit(1);

      if (attendance.length === 0 || !attendance[0].checkIn) {
        return reply.status(400).send({ success: false, error: 'No check-in found for today' });
      }

      if (attendance[0].checkOut) {
        return reply.status(400).send({ success: false, error: 'Already checked out today' });
      }

      // Location validation mirrors check-in: the check-out coordinates must be
      // within the radius of the work location that was used at check-in.
      if (!attendance[0].locationId) {
        return reply.status(400).send({ success: false, error: 'Check-in work location not found' });
      }
      const checkOutLocation = await db.select().from(workLocations)
        .where(eq(workLocations.id, attendance[0].locationId))
        .limit(1);
      if (checkOutLocation.length === 0) {
        return reply.status(400).send({ success: false, error: 'Check-in work location not found' });
      }
      const checkoutValidation = validateLocation(
        { latitude: body.latitude, longitude: body.longitude },
        { latitude: parseFloat(checkOutLocation[0].latitude), longitude: parseFloat(checkOutLocation[0].longitude) },
        checkOutLocation[0].radiusMeters || 100
      );
      if (!checkoutValidation.isInside) {
        app.log.warn({
          employeeId: emp.id,
          locationId: attendance[0].locationId,
          distance: checkoutValidation.distance,
          radius: checkoutValidation.radius,
          accuracy: body.accuracy,
        }, 'Check-out rejected: outside work area');

        return reply.status(400).send({
          success: false,
          error: 'Outside work area',
          distance: checkoutValidation.distance,
          radius: checkoutValidation.radius,
          accuracy: body.accuracy,
        });
      }

      // Calculate overtime hours using WIB shift end
      let overtimeHours = 0;
      const todayShift = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, emp.id),
          eq(employeeShifts.date, today)
        ))
        .limit(1);

      const now = new Date();

      if (todayShift.length > 0 && todayShift[0].shiftId) {
        const shiftRecord = await db.select().from(shifts).where(eq(shifts.id, todayShift[0].shiftId)).limit(1);
        if (shiftRecord.length > 0) {
          const currentWibMinutes = timeToMinutes(getWIBTimeString());
          const shiftEndMinutes = timeToMinutes(shiftRecord[0].endTime);

          // Count overtime only past the grace window past the shift end.
          if (currentWibMinutes > shiftEndMinutes + OVERTIME_GRACE_MINUTES) {
            overtimeHours = (currentWibMinutes - shiftEndMinutes - OVERTIME_GRACE_MINUTES) / 60;
          }
        }
      }

      const updated = await db.update(attendances)
        .set({
          checkOut: now,
          checkOutLat: body.latitude.toString(),
          checkOutLng: body.longitude.toString(),
          overtimeHours: overtimeHours.toFixed(2),
        })
        .where(eq(attendances.id, attendance[0].id))
        .returning();

      // Check abnormal overtime abuse
      await detectAbnormalOvertime(emp.id);

      return reply.send({
        success: true,
        data: {
          id: updated[0].id,
          checkIn: updated[0].checkIn,
          checkOut: updated[0].checkOut,
          overtimeHours: parseFloat(overtimeHours.toFixed(2)),
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

  // Get today's attendance
  app.get('/today', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const query = request.query as { employeeId?: string };
      const today = getWIBDateString();

      let targetEmployeeId: string;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: null });
        }
        targetEmployeeId = emp[0].id;
      } else {
        if (query.employeeId) {
          targetEmployeeId = query.employeeId;
        } else {
          const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (emp.length === 0) {
            return reply.send({ success: true, data: null });
          }
          targetEmployeeId = emp[0].id;
        }
      }

      const attendance = await db.select().from(attendances)
        .where(and(
          eq(attendances.employeeId, targetEmployeeId),
          eq(attendances.date, today)
        ))
        .limit(1);

      return reply.send({
        success: true,
        data: attendance[0] || null,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get attendance history
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { startDate, endDate, employeeId } = request.query as { startDate?: string; endDate?: string; employeeId?: string };

      let targetEmployeeId: string;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        targetEmployeeId = emp[0].id;
      } else {
        if (employeeId) {
          targetEmployeeId = employeeId;
        } else {
          const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (emp.length === 0) {
            return reply.send({ success: true, data: [] });
          }
          targetEmployeeId = emp[0].id;
        }
      }

      const conditions = [eq(attendances.employeeId, targetEmployeeId)];
      if (startDate && endDate) {
        conditions.push(gte(attendances.date, startDate));
        conditions.push(lte(attendances.date, endDate));
      }

      const data = await db.select().from(attendances)
        .where(and(...conditions))
        .orderBy(desc(attendances.date));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get attendance report (HR summary - RBAC restricted)
  app.get('/report', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin', 'manager')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = request.query as { month?: string | number; year?: string | number };

      const m = parseInt(month.toString(), 10);
      const y = parseInt(year.toString(), 10);

      const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const data = await db.select({
        employeeId: attendances.employeeId,
        date: attendances.date,
        status: attendances.status,
        overtimeHours: attendances.overtimeHours,
      })
      .from(attendances)
      .where(and(
        gte(attendances.date, startDate),
        lte(attendances.date, endDate)
      ));

      // Scheduled working days per employee come from real shift assignments.
      const shiftDays = await db.select({
        employeeId: employeeShifts.employeeId,
        date: employeeShifts.date,
      })
      .from(employeeShifts)
      .where(and(
        gte(employeeShifts.date, startDate),
        lte(employeeShifts.date, endDate)
      ));

      const shiftSets = new Map<string, Set<string>>();
      for (const sd of shiftDays) {
        if (!sd.employeeId || !sd.date) continue;
        if (!shiftSets.has(sd.employeeId)) shiftSets.set(sd.employeeId, new Set());
        shiftSets.get(sd.employeeId)!.add(sd.date);
      }

      // Weekday count fallback when the employee has no shift schedule.
      const totalWeekdays = countWeekdays(startDate, endDate);

      const report = new Map<string, {
        totalDays: number;
        presentDays: number;
        lateDays: number;
        absentDays: number;
        totalOvertime: number;
      }>();

      const attendedDays = new Map<string, Set<string>>();
      for (const row of data) {
        if (!row.employeeId || !row.date) continue;
        let entry = report.get(row.employeeId);
        if (!entry) {
          entry = { totalDays: 0, presentDays: 0, lateDays: 0, absentDays: 0, totalOvertime: 0 };
          report.set(row.employeeId, entry);
        }
        if (!attendedDays.has(row.employeeId)) attendedDays.set(row.employeeId, new Set());
        attendedDays.get(row.employeeId)!.add(row.date);

        if (row.status === 'present') entry.presentDays++;
        if (row.status === 'late') entry.lateDays++;
        entry.totalOvertime += parseFloat(row.overtimeHours || '0');
      }

      const result = [];
      for (const [employeeId, entry] of report) {
        const scheduled = shiftSets.get(employeeId)?.size ?? 0;
        const workDays = scheduled > 0 ? scheduled : totalWeekdays;
        const attended = attendedDays.get(employeeId)?.size ?? 0;
        entry.totalDays = workDays;
        entry.absentDays = Math.max(0, workDays - attended);
        entry.totalOvertime = Math.round(entry.totalOvertime * 100) / 100;
        result.push({ employeeId, ...entry });
      }

      return reply.send({ success: true, data: result });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Auto check-out manual trigger (Admin only)
  app.post('/auto-checkout', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const processed = await performAutoCheckout();

      return reply.send({
        success: true,
        message: `Auto check-out completed for ${processed} employees`,
        processed,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Abuse check test trigger
  app.post('/abuse-check', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId, locations } = request.body as {
        employeeId: string;
        locations: { latitude: number; longitude: number }[];
      };

      const result = await detectGPSSpoofing(employeeId, locations);
      return reply.send({ success: true, result });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get abuse logs
  app.get('/abuse-logs', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { severity, isResolved } = request.query as { severity?: string; isResolved?: string };
      const conditions = [];

      if (severity) {
        conditions.push(eq(abuseLogs.severity, severity));
      }
      if (isResolved !== undefined) {
        conditions.push(eq(abuseLogs.isResolved, isResolved === 'true'));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db.select({
        id: abuseLogs.id,
        employeeId: abuseLogs.employeeId,
        abuseType: abuseLogs.abuseType,
        description: abuseLogs.description,
        severity: abuseLogs.severity,
        detectedAt: abuseLogs.detectedAt,
        isResolved: abuseLogs.isResolved,
        resolvedAt: abuseLogs.resolvedAt,
        employeeName: employees.fullName,
        employeeNip: employees.nip,
      })
      .from(abuseLogs)
      .leftJoin(employees, eq(abuseLogs.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(abuseLogs.detectedAt));

      return reply.send({ success: true, data: logs });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Resolve an abuse log
  app.put('/abuse-logs/:id/resolve', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user;

      const updated = await db.update(abuseLogs)
        .set({
          isResolved: true,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        })
        .where(eq(abuseLogs.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Abuse log not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get weekly attendance statistics for dashboard chart
  app.get('/weekly-stats', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const todayStr = getWIBDateString();
      const todayDate = new Date(`${todayStr}T00:00:00Z`);

      // Determine Monday of current week
      const dayOfWeek = todayDate.getUTCDay(); // 0 is Sunday, 1 is Monday...
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(todayDate);
      monday.setUTCDate(todayDate.getUTCDate() + diffToMon);

      const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const weekDays: { date: string; fullDate: string; present: number; late: number; absent: number }[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate() + i);
        weekDays.push({
          date: dayLabels[i],
          fullDate: d.toISOString().split('T')[0],
          present: 0,
          late: 0,
          absent: 0,
        });
      }

      const startDate = weekDays[0].fullDate;
      const endDate = weekDays[6].fullDate;

      let employeeIdsScope: string[] | null = null;
      let totalActiveEmployees = 0;

      if (user.role === 'employee') {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: weekDays });
        }
        employeeIdsScope = [emp[0].id];
        totalActiveEmployees = 1;
      } else if (user.role === 'manager') {
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (!mgrEmp.length || !mgrEmp[0].departmentId) {
          return reply.send({ success: true, data: weekDays });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(and(eq(employees.departmentId, mgrEmp[0].departmentId), eq(employees.isActive, true)));
        employeeIdsScope = deptEmps.map((e) => e.id);
        totalActiveEmployees = employeeIdsScope.length;
      } else {
        const allEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.isActive, true));
        totalActiveEmployees = allEmps.length;
      }

      const conditions = [
        gte(attendances.date, startDate),
        lte(attendances.date, endDate),
      ];

      if (employeeIdsScope !== null) {
        if (employeeIdsScope.length === 0) {
          return reply.send({ success: true, data: weekDays });
        }
        conditions.push(inArray(attendances.employeeId, employeeIdsScope));
      }

      const records = await db.select({
        employeeId: attendances.employeeId,
        date: attendances.date,
        status: attendances.status,
      })
      .from(attendances)
      .where(and(...conditions));

      // Group records by date
      const recordsByDate = new Map<string, { present: number; late: number; absent: number }>();
      for (const r of records) {
        if (!r.date) continue;
        let entry = recordsByDate.get(r.date);
        if (!entry) {
          entry = { present: 0, late: 0, absent: 0 };
          recordsByDate.set(r.date, entry);
        }
        if (r.status === 'present') entry.present++;
        else if (r.status === 'late') entry.late++;
        else if (r.status === 'absent') entry.absent++;
      }

      for (let i = 0; i < weekDays.length; i++) {
        const day = weekDays[i];
        const stats = recordsByDate.get(day.fullDate) || { present: 0, late: 0, absent: 0 };
        day.present = stats.present;
        day.late = stats.late;

        if (user.role === 'employee') {
          day.absent = stats.absent;
          if (day.fullDate < todayStr && i < 5 && day.present === 0 && day.late === 0 && day.absent === 0) {
            day.absent = 1;
          }
        } else {
          if (day.fullDate <= todayStr && i < 5) {
            day.absent = Math.max(0, totalActiveEmployees - day.present - day.late);
          } else {
            day.absent = stats.absent;
          }
        }
      }

      return reply.send({ success: true, data: weekDays });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get today attendance summary for dashboard metric card
  app.get('/today-summary', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const today = getWIBDateString();

      // Check if current user checked in
      let isSelfCheckedIn = false;
      const selfEmp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (selfEmp.length > 0) {
        const selfAtt = await db.select().from(attendances)
          .where(and(eq(attendances.employeeId, selfEmp[0].id), eq(attendances.date, today)))
          .limit(1);
        if (selfAtt.length > 0 && selfAtt[0].checkIn) {
          isSelfCheckedIn = true;
        }
      }

      if (user.role === 'employee') {
        return reply.send({
          success: true,
          data: {
            presentCount: isSelfCheckedIn ? 1 : 0,
            totalCount: 1,
            isSelfCheckedIn,
          },
        });
      }

      let employeeIdsScope: string[] | null = null;
      let totalCount = 0;

      if (user.role === 'manager') {
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (!mgrEmp.length || !mgrEmp[0].departmentId) {
          return reply.send({ success: true, data: { presentCount: 0, totalCount: 0, isSelfCheckedIn } });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(and(eq(employees.departmentId, mgrEmp[0].departmentId), eq(employees.isActive, true)));
        employeeIdsScope = deptEmps.map((e) => e.id);
        totalCount = employeeIdsScope.length;
      } else {
        const allEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.isActive, true));
        totalCount = allEmps.length;
      }

      const conditions = [
        eq(attendances.date, today),
        sql`${attendances.checkIn} IS NOT NULL`,
      ];

      if (employeeIdsScope !== null) {
        if (employeeIdsScope.length === 0) {
          return reply.send({ success: true, data: { presentCount: 0, totalCount: 0, isSelfCheckedIn } });
        }
        conditions.push(inArray(attendances.employeeId, employeeIdsScope));
      }

      const presentRecords = await db.select({ count: sql<number>`count(*)` }).from(attendances).where(and(...conditions));
      const presentCount = Number(presentRecords[0]?.count || 0);

      return reply.send({
        success: true,
        data: {
          presentCount,
          totalCount,
          isSelfCheckedIn,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get recent real activities across attendances, leaves, and payrolls
  app.get('/activities', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      let employeeScope: string[] | null = null;

      if (user.role === 'employee') {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        employeeScope = [emp[0].id];
      } else if (user.role === 'manager') {
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (!mgrEmp.length || !mgrEmp[0].departmentId) {
          return reply.send({ success: true, data: [] });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(eq(employees.departmentId, mgrEmp[0].departmentId));
        employeeScope = deptEmps.map((e) => e.id);
      }

      interface ActivityItem {
        id: string;
        type: 'attendance' | 'leave' | 'payroll';
        title: string;
        description: string;
        createdAt: string;
        color: 'green' | 'blue' | 'yellow';
      }

      const activities: ActivityItem[] = [];

      // 1. Recent attendances
      const attConditions = [sql`${attendances.checkIn} IS NOT NULL`];
      if (employeeScope !== null && employeeScope.length > 0) {
        attConditions.push(inArray(attendances.employeeId, employeeScope));
      }
      if (employeeScope === null || employeeScope.length > 0) {
        const recentAtts = await db.select({
          id: attendances.id,
          checkIn: attendances.checkIn,
          checkOut: attendances.checkOut,
          createdAt: attendances.createdAt,
          fullName: employees.fullName,
          locationName: workLocations.name,
        })
        .from(attendances)
        .innerJoin(employees, eq(attendances.employeeId, employees.id))
        .leftJoin(workLocations, eq(attendances.locationId, workLocations.id))
        .where(and(...attConditions))
        .orderBy(desc(attendances.createdAt))
        .limit(5);

        for (const att of recentAtts) {
          const isCheckOut = Boolean(att.checkOut);
          const time = att.checkOut || att.checkIn || att.createdAt;
          activities.push({
            id: `att-${att.id}`,
            type: 'attendance',
            title: isCheckOut ? 'Presensi keluar' : 'Presensi masuk',
            description: `${att.fullName} check-${isCheckOut ? 'out' : 'in'}${att.locationName ? ` di ${att.locationName}` : ''}`,
            createdAt: time ? new Date(time).toISOString() : new Date().toISOString(),
            color: 'green',
          });
        }
      }

      // 2. Recent leaves
      const leaveConditions = [];
      if (employeeScope !== null && employeeScope.length > 0) {
        leaveConditions.push(inArray(leaves.employeeId, employeeScope));
      }
      if (employeeScope === null || employeeScope.length > 0) {
        const recentLeaves = await db.select({
          id: leaves.id,
          leaveType: leaves.leaveType,
          status: leaves.status,
          createdAt: leaves.createdAt,
          approvedAt: leaves.approvedAt,
          fullName: employees.fullName,
        })
        .from(leaves)
        .innerJoin(employees, eq(leaves.employeeId, employees.id))
        .where(leaveConditions.length > 0 ? and(...leaveConditions) : undefined)
        .orderBy(desc(leaves.createdAt))
        .limit(5);

        for (const lv of recentLeaves) {
          let title = 'Pengajuan cuti';
          if (lv.status === 'approved') title = 'Cuti disetujui';
          else if (lv.status === 'rejected') title = 'Cuti ditolak';

          const time = lv.approvedAt || lv.createdAt;
          activities.push({
            id: `leave-${lv.id}`,
            type: 'leave',
            title,
            description: `Cuti ${lv.leaveType} untuk ${lv.fullName}`,
            createdAt: time ? new Date(time).toISOString() : new Date().toISOString(),
            color: 'blue',
          });
        }
      }

      // 3. Recent payrolls
      const payConditions = [];
      if (employeeScope !== null && employeeScope.length > 0) {
        payConditions.push(inArray(payrolls.employeeId, employeeScope));
      }
      if (employeeScope === null || employeeScope.length > 0) {
        const recentPayrolls = await db.select({
          id: payrolls.id,
          periodMonth: payrolls.periodMonth,
          periodYear: payrolls.periodYear,
          status: payrolls.status,
          createdAt: payrolls.createdAt,
          paidAt: payrolls.paidAt,
          updatedAt: payrolls.updatedAt,
          fullName: employees.fullName,
        })
        .from(payrolls)
        .innerJoin(employees, eq(payrolls.employeeId, employees.id))
        .where(payConditions.length > 0 ? and(...payConditions) : undefined)
        .orderBy(desc(payrolls.createdAt))
        .limit(5);

        for (const py of recentPayrolls) {
          const isPaid = py.status === 'paid';
          const time = py.paidAt || py.updatedAt || py.createdAt;
          activities.push({
            id: `payroll-${py.id}`,
            type: 'payroll',
            title: isPaid ? 'Payroll dibayar' : 'Payroll diproses',
            description: `Payroll periode ${py.periodMonth}/${py.periodYear} untuk ${py.fullName}`,
            createdAt: time ? new Date(time).toISOString() : new Date().toISOString(),
            color: 'yellow',
          });
        }
      }

      // Sort all activities by createdAt desc
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return reply.send({ success: true, data: activities.slice(0, 8) });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ---------------------------------------------------------------------------
  // Overtime Request endpoints
  // ---------------------------------------------------------------------------

  const overtimeRequestSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format harus YYYY-MM-DD'),
    hours: z.number().min(0.5).max(8),
    reason: z.string().min(10, 'Alasan minimal 10 karakter'),
    employeeId: z.string().uuid().optional(),
  });

  const overtimeApproveSchema = z.object({
    approved: z.boolean(),
    notes: z.string().optional(),
  });

  // Ensure the overtime_requests table exists (safe, non-destructive)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS overtime_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      employee_id UUID REFERENCES employees(id),
      date DATE NOT NULL,
      hours DECIMAL(4,2) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // POST /overtime-requests — karyawan ajukan lembur
  app.post('/overtime-requests', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = overtimeRequestSchema.parse(request.body);

      // Resolve target employee (anti-impersonation)
      const own = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
      const canActForOthers = ['super_admin', 'hr_admin'].includes(user.role);

      let targetEmployeeId: string | null = null;
      if (own.length > 0) {
        if (body.employeeId && own[0].id !== body.employeeId && !canActForOthers) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Tidak bisa mengajukan lembur atas nama karyawan lain' });
        }
        targetEmployeeId = body.employeeId || own[0].id;
      } else if (canActForOthers && body.employeeId) {
        targetEmployeeId = body.employeeId;
      }

      if (!targetEmployeeId) {
        return reply.status(404).send({ success: false, error: 'Data karyawan tidak ditemukan' });
      }

      // Cek apakah sudah ada request pending/approved untuk hari yang sama
      const existing = await db.select().from(overtimeRequests)
        .where(and(
          eq(overtimeRequests.employeeId, targetEmployeeId),
          eq(overtimeRequests.date, body.date),
          ne(overtimeRequests.status, 'rejected'),
          ne(overtimeRequests.status, 'cancelled'),
        ))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(400).send({
          success: false,
          error: `Sudah ada pengajuan lembur untuk tanggal ${body.date} dengan status ${existing[0].status}`,
        });
      }

      const newRequest = await db.insert(overtimeRequests).values({
        employeeId: targetEmployeeId,
        date: body.date,
        hours: body.hours.toString(),
        reason: body.reason,
        status: 'pending',
      }).returning();

      return reply.status(201).send({ success: true, data: newRequest[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validasi gagal', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // GET /overtime-requests — list (scope by role)
  app.get('/overtime-requests', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { employeeId, month, year } = request.query as { employeeId?: string; month?: string; year?: string };

      const conditions: Parameters<typeof and>[0][] = [];

      if (user.role === 'employee') {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) return reply.send({ success: true, data: [] });
        conditions.push(eq(overtimeRequests.employeeId, emp[0].id));
      } else if (user.role === 'manager') {
        const mgrEmp = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.send({ success: true, data: [] });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.departmentId, mgrEmp[0].departmentId));
        if (deptEmps.length === 0) return reply.send({ success: true, data: [] });
        conditions.push(inArray(overtimeRequests.employeeId, deptEmps.map((e) => e.id)));
        if (employeeId) conditions.push(eq(overtimeRequests.employeeId, employeeId));
      } else {
        // hr_admin / super_admin: full access
        if (employeeId) conditions.push(eq(overtimeRequests.employeeId, employeeId));
      }

      if (month && year) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const start = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        conditions.push(gte(overtimeRequests.date, start));
        conditions.push(lte(overtimeRequests.date, end));
      }

      const data = conditions.length > 0
        ? await db.select().from(overtimeRequests).where(and(...conditions)).orderBy(desc(overtimeRequests.createdAt))
        : await db.select().from(overtimeRequests).orderBy(desc(overtimeRequests.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // GET /overtime-requests/approvals — pending saja, untuk manager/hr/admin
  app.get('/overtime-requests/approvals', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Akses tidak diizinkan' });
      }

      const conditions: Parameters<typeof and>[0][] = [
        eq(overtimeRequests.status, 'pending'),
      ];

      if (user.role === 'manager') {
        const mgrEmp = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.send({ success: true, data: [] });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.departmentId, mgrEmp[0].departmentId));
        if (deptEmps.length === 0) return reply.send({ success: true, data: [] });
        conditions.push(inArray(overtimeRequests.employeeId, deptEmps.map((e) => e.id)));
      }

      const data = await db.select().from(overtimeRequests).where(and(...conditions)).orderBy(desc(overtimeRequests.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // PUT /overtime-requests/:id/approve — approve atau reject
  app.put('/overtime-requests/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Akses tidak diizinkan' });
      }

      const { id } = request.params as { id: string };
      const body = overtimeApproveSchema.parse(request.body);

      const existing = await db.select().from(overtimeRequests).where(eq(overtimeRequests.id, id)).limit(1);
      if (existing.length === 0) {
        return reply.status(404).send({ success: false, error: 'Pengajuan lembur tidak ditemukan' });
      }
      if (existing[0].status !== 'pending') {
        return reply.status(400).send({ success: false, error: `Pengajuan sudah diproses (status: ${existing[0].status})` });
      }

      // Manager scope check
      if (user.role === 'manager') {
        const mgrEmp = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Data departemen manager tidak ditemukan' });
        }
        const targetEmp = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, existing[0].employeeId!)).limit(1);
        if (targetEmp.length === 0 || targetEmp[0].departmentId !== mgrEmp[0].departmentId) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Hanya bisa approve lembur karyawan di departemen Anda' });
        }
      }

      // Resolve approvedBy user id
      const approverUser = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
      const approverId = approverUser.length > 0 ? approverUser[0].id : null;

      const newStatus = body.approved ? 'approved' : 'rejected';
      const updated = await db.update(overtimeRequests).set({
        status: newStatus,
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: body.notes || null,
      }).where(eq(overtimeRequests.id, id)).returning();

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validasi gagal', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // DELETE /overtime-requests/:id — karyawan batalkan request milik sendiri (pending only)
  app.delete('/overtime-requests/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const existing = await db.select().from(overtimeRequests).where(eq(overtimeRequests.id, id)).limit(1);
      if (existing.length === 0) {
        return reply.status(404).send({ success: false, error: 'Pengajuan lembur tidak ditemukan' });
      }

      // Only the owning employee, or hr_admin/super_admin, can cancel
      if (user.role === 'employee') {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || existing[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Bukan pengajuan milik Anda' });
        }
      } else if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Akses tidak diizinkan' });
      }

      if (existing[0].status !== 'pending') {
        return reply.status(400).send({ success: false, error: `Tidak bisa membatalkan pengajuan dengan status: ${existing[0].status}` });
      }

      const updated = await db.update(overtimeRequests).set({ status: 'cancelled' }).where(eq(overtimeRequests.id, id)).returning();

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

