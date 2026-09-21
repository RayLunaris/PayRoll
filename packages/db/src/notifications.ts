import Redis from 'ioredis';
import { db } from './index';
import { notifications, users, employees, departments } from './schema/index';
import { eq, and, inArray } from 'drizzle-orm';

let redisPublisher: Redis | null = null;

export function getNotificationRedisPublisher(): Redis | null {
  if (redisPublisher) return redisPublisher;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redisPublisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });
    redisPublisher.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[notifications] Redis client error:', err.message);
      }
    });
    return redisPublisher;
  } catch (err) {
    console.warn('[notifications] Failed to instantiate Redis client:', err);
    return null;
  }
}

export interface GetAdminAndManagerUserIdsOptions {
  employeeId?: string | null;
  departmentId?: string | null;
  excludeUserId?: string | null;
}

/**
 * Retrieves user IDs for super_admin, hr_admin, and the department manager of an employee.
 */
export async function getAdminAndManagerUserIds(
  options: GetAdminAndManagerUserIdsOptions = {}
): Promise<string[]> {
  const recipientUserIds = new Set<string>();

  try {
    // 1. Fetch all active super_admin and hr_admin users
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.role, ['super_admin', 'hr_admin']),
          eq(users.isActive, true)
        )
      );

    for (const admin of admins) {
      if (admin.id) recipientUserIds.add(admin.id);
    }

    // 2. Fetch department manager if employeeId or departmentId provided
    let resolvedDeptId = options.departmentId;

    if (!resolvedDeptId && options.employeeId) {
      const emp = await db
        .select({ departmentId: employees.departmentId })
        .from(employees)
        .where(eq(employees.id, options.employeeId))
        .limit(1);

      if (emp.length > 0 && emp[0].departmentId) {
        resolvedDeptId = emp[0].departmentId;
      }
    }

    if (resolvedDeptId) {
      const dept = await db
        .select({ managerId: departments.managerId })
        .from(departments)
        .where(eq(departments.id, resolvedDeptId))
        .limit(1);

      if (dept.length > 0 && dept[0].managerId) {
        const mgrEmp = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, dept[0].managerId))
          .limit(1);

        if (mgrEmp.length > 0 && mgrEmp[0].userId) {
          recipientUserIds.add(mgrEmp[0].userId);
        }
      }
    }
  } catch (error) {
    console.error('[getAdminAndManagerUserIds] Error retrieving recipients:', error);
  }

  if (options.excludeUserId) {
    recipientUserIds.delete(options.excludeUserId);
  }

  return Array.from(recipientUserIds);
}

/**
 * Resolves the user account ID (users.id) associated with an employee ID (employees.id).
 */
export async function getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
  try {
    const emp = await db
      .select({ userId: employees.userId })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    return emp.length > 0 && emp[0].userId ? emp[0].userId : null;
  } catch (error) {
    console.error('[getUserIdByEmployeeId] Error resolving employee user ID:', error);
    return null;
  }
}

export interface NotifyUsersOptions {
  recipientUserIds: string[];
  title: string;
  message: string;
  type: string;
  referenceId?: string | null;
  actionUrl?: string;
}

/**
 * Persists notifications to PostgreSQL and broadcasts real-time events via Redis.
 */
export async function notifyUsers({
  recipientUserIds,
  title,
  message,
  type,
  referenceId,
  actionUrl,
}: NotifyUsersOptions) {
  if (!recipientUserIds || recipientUserIds.length === 0) {
    return [];
  }

  // Deduplicate user IDs
  const uniqueUserIds = Array.from(new Set(recipientUserIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return [];

  let createdNotifications: (typeof notifications.$inferSelect)[] = [];

  // 1. Insert into database
  try {
    createdNotifications = await db
      .insert(notifications)
      .values(
        uniqueUserIds.map((userId) => ({
          userId,
          title,
          message,
          type,
          referenceId: referenceId || null,
          isRead: false,
        }))
      )
      .returning();
  } catch (dbError) {
    console.error('[notifyUsers] Failed to persist notifications to database:', dbError);
  }

  // 2. Publish to Redis for WebSocket real-time broadcast
  try {
    const publisher = getNotificationRedisPublisher();
    if (publisher) {
      const payload = {
        event: 'new_notification',
        type: 'notification',
        toUserIds: uniqueUserIds,
        data: {
          title,
          message,
          type,
          referenceId: referenceId || null,
          actionUrl: actionUrl || null,
          createdAt: new Date().toISOString(),
        },
      };
      await publisher.publish('payrollpro:events', JSON.stringify(payload));
    }
  } catch (redisError) {
    console.error('[notifyUsers] Failed to publish event to Redis:', redisError);
  }

  return createdNotifications;
}
