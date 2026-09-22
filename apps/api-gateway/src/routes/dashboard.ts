import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ActivityItem } from '@payrollpro/shared-types';

const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3013';
const LEAVE_SERVICE_URL = process.env.LEAVE_SERVICE_URL || 'http://localhost:3014';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/recent-activity', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-user-id': user?.id || (user as any)?.userId || '',
        'x-employee-id': (user as any)?.employeeId || '',
        'x-department-id': (user as any)?.departmentId || '',
        'x-user-role': user?.role || '',
      };

      if (request.headers.authorization) {
        headers['authorization'] = request.headers.authorization as string;
      }

      const [attendanceRes, leaveRes] = await Promise.allSettled([
        fetch(`${ATTENDANCE_SERVICE_URL}/api/attendance/activities/mine`, {
          headers,
          signal: AbortSignal.timeout(4000),
        }).then(async (r) => (r.ok ? r.json() : null)),

        fetch(`${LEAVE_SERVICE_URL}/api/leaves/activities/mine`, {
          headers,
          signal: AbortSignal.timeout(4000),
        }).then(async (r) => (r.ok ? r.json() : null)),
      ]);

      const rawAtt = attendanceRes.status === 'fulfilled' && attendanceRes.value
        ? ((attendanceRes.value as any)?.data ?? attendanceRes.value)
        : [];
      const rawLeave = leaveRes.status === 'fulfilled' && leaveRes.value
        ? ((leaveRes.value as any)?.data ?? leaveRes.value)
        : [];

      const attendanceActivities: ActivityItem[] = Array.isArray(rawAtt) ? rawAtt : [];
      const leaveActivities: ActivityItem[] = Array.isArray(rawLeave) ? rawLeave : [];

      // Merge and deduplicate by unique prefixed ID
      const merged = new Map<string, ActivityItem>();
      for (const item of [...attendanceActivities, ...leaveActivities]) {
        if (item && item.id) {
          merged.set(item.id, item);
        }
      }

      // Sort chronological newest first and limit to 10
      const result = Array.from(merged.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return reply.send({ success: true, data: result });
    } catch (error) {
      request.log.error(error, 'Dashboard aggregation error');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
