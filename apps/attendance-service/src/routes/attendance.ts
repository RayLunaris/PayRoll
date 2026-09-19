import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, attendances, employees, workLocations, shifts, employeeShifts, abuseLogs, eq, and, desc, sql, gte, lte } from '@payrollpro/db';
import { getWIBDateString, getWIBTimeString, timeToMinutes } from '@payrollpro/shared-types';
import { validateLocation } from '../services/gps.js';
import { detectBuddyPunching, detectGPSSpoofing, detectAbnormalOvertime } from '../services/abuse-detection.js';
import { requireRole } from '../middleware/auth.js';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
});

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
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

      // Validate GPS location
      const validation = validateLocation(
        { latitude: body.latitude, longitude: body.longitude },
        { latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) },
        loc.radiusMeters || 100
      );

      if (!validation.isInside) {
        return reply.status(400).send({
          success: false,
          error: 'Outside work area',
          distance: validation.distance,
          radius: validation.radius,
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
        return reply.status(400).send({
          success: false,
          error: 'Outside work area',
          distance: checkoutValidation.distance,
          radius: checkoutValidation.radius,
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
}

