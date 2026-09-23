import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, leaves, employees, eq, inArray, and, desc, sql } from '@payrollpro/db';
import type { ActivityItem } from '@payrollpro/shared-types';

const EMPLOYEE_SERVICE_URL = process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011';

export async function leaveActivityRoutes(app: FastifyInstance) {
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

      const conditions = [eq(leaves.status, 'approved')];

      if (role === 'employee') {
        if (!employeeId) {
          return reply.send({ success: true, data: [] });
        }
        conditions.push(eq(leaves.employeeId, employeeId));
      } else if (role === 'manager') {
        let teamIds: string[] = [];
        if (departmentId) {
          try {
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
            const team = await db.select({ id: employees.id }).from(employees)
              .where(and(eq(employees.departmentId, departmentId), eq(employees.isActive, true)));
            teamIds = team.map((t) => t.id);
          }
        }

        if (teamIds.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        conditions.push(inArray(leaves.employeeId, teamIds));
      }

      // Query approved leaves
      const rows = await db.select({
        id: leaves.id,
        employeeId: leaves.employeeId,
        leaveType: leaves.leaveType,
        startDate: leaves.startDate,
        endDate: leaves.endDate,
        status: leaves.status,
        createdAt: leaves.createdAt,
        approvedAt: leaves.approvedAt,
        employeeName: employees.fullName,
      })
      .from(leaves)
      .innerJoin(employees, eq(leaves.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(sql`COALESCE(${leaves.approvedAt}, ${leaves.createdAt})`))
      .limit(10);

      // Dedup guard (defensive, ensures uniqueness by primary key and distinct event)
      const seen = new Map<string, ActivityItem>();
      for (const lv of rows) {
        const time = lv.approvedAt || lv.createdAt;
        const item: ActivityItem = {
          id: `leave-service:${lv.id}`,
          type: 'leave_approved',
          title: 'Cuti disetujui',
          // Sertakan rentang tanggal supaya dua pengajuan cuti yang berbeda untuk karyawan yang sama tidak terlihat identik
          description: `Cuti ${lv.leaveType} (${lv.startDate} s/d ${lv.endDate}) untuk ${lv.employeeName || 'Karyawan'}`,
          employeeId: lv.employeeId || '',
          employeeName: lv.employeeName || 'Karyawan',
          timestamp: time ? new Date(time).toISOString() : new Date().toISOString(),
          sourceService: 'leave-service',
        };
        seen.set(item.id, item);
      }

      return reply.send({ success: true, data: Array.from(seen.values()) });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
