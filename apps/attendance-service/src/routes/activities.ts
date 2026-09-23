import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, attendances, employees, workLocations, eq, inArray, and, desc, sql } from '@payrollpro/db';
import type { ActivityItem } from '@payrollpro/shared-types';

const EMPLOYEE_SERVICE_URL = process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011';

export async function attendanceActivityRoutes(app: FastifyInstance) {
  app.get('/activities/mine', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      // Identity comes only from the verified JWT (and DB profile) — never from
      // client-controlled x-user-* / x-employee-* / x-department-* headers.
      const role = user?.role;
      let employeeId = (user as any)?.employeeId as string | undefined;
      let departmentId = (user as any)?.departmentId as string | undefined;

      if (user?.id) {
        const emp = await db.select({ id: employees.id, departmentId: employees.departmentId })
          .from(employees)
          .where(eq(employees.userId, user.id))
          .limit(1);
        if (emp.length > 0) {
          employeeId = emp[0].id;
          departmentId = emp[0].departmentId ?? undefined;
        }
      }

      const conditions = [];

      if (role === 'employee') {
        if (!employeeId) {
          return reply.send({ success: true, data: [] });
        }
        conditions.push(eq(attendances.employeeId, employeeId));
      } else if (role === 'manager') {
        let teamIds: string[] = [];
        if (departmentId) {
          try {
            // Query employee-service for team employee IDs
            const authHeader = request.headers.authorization;
            const res = await fetch(`${EMPLOYEE_SERVICE_URL}/api/employees/by-department/${departmentId}`, {
              headers: authHeader ? { authorization: authHeader } : undefined,
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const body = await res.json() as { success?: boolean; data?: string[] };
              if (Array.isArray(body?.data)) {
                teamIds = body.data;
              }
            }
          } catch {
            // Fallback to local DB query if employee-service call fails
            const team = await db.select({ id: employees.id }).from(employees)
              .where(and(eq(employees.departmentId, departmentId), eq(employees.isActive, true)));
            teamIds = team.map((t) => t.id);
          }
        }

        if (teamIds.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        conditions.push(inArray(attendances.employeeId, teamIds));
      }

      // Query attendances
      const rows = await db.select({
        id: attendances.id,
        employeeId: attendances.employeeId,
        checkIn: attendances.checkIn,
        checkOut: attendances.checkOut,
        createdAt: attendances.createdAt,
        locationName: workLocations.name,
        employeeName: employees.fullName,
      })
      .from(attendances)
      .innerJoin(employees, eq(attendances.employeeId, employees.id))
      .leftJoin(workLocations, eq(attendances.locationId, workLocations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`COALESCE(${attendances.checkOut}, ${attendances.checkIn}, ${attendances.createdAt})`))
      .limit(10);

      const activities: ActivityItem[] = rows.map((r) => {
        const isCheckOut = Boolean(r.checkOut);
        const time = r.checkOut || r.checkIn || r.createdAt;
        return {
          id: `attendance-service:${r.id}`,
          type: isCheckOut ? 'attendance_check_out' : 'attendance_check_in',
          title: isCheckOut ? 'Presensi keluar' : 'Presensi masuk',
          description: `${r.employeeName || 'Karyawan'} ${isCheckOut ? 'check-out' : 'check-in'}${r.locationName ? ` di ${r.locationName}` : ''}`,
          employeeId: r.employeeId || '',
          employeeName: r.employeeName || 'Karyawan',
          timestamp: time ? new Date(time).toISOString() : new Date().toISOString(),
          sourceService: 'attendance-service',
        };
      });

      return reply.send({ success: true, data: activities });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
