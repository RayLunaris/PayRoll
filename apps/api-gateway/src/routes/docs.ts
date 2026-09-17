import { FastifyInstance } from 'fastify';

export const apiCatalog = {
  name: 'PayrollPro API Gateway',
  version: '1.0.0',
  description: 'Single Entrypoint REST API Gateway for PayrollPro Web Payroll System',
  baseUrl: '/api',
  endpoints: [
    {
      group: 'Authentication',
      prefix: '/api/auth',
      endpoints: [
        { method: 'POST', path: '/login', description: 'User login and token issuance', auth: false },
        { method: 'POST', path: '/register', description: 'Register new user account', auth: false },
        { method: 'POST', path: '/refresh', description: 'Refresh access token', auth: false },
        { method: 'GET', path: '/me', description: 'Get current authenticated user', auth: true },
        { method: 'POST', path: '/logout', description: 'User logout', auth: true },
      ],
    },
    {
      group: 'Employees',
      prefix: '/api/employees',
      endpoints: [
        { method: 'GET', path: '/', description: 'List employees with pagination', auth: true },
        { method: 'POST', path: '/', description: 'Create employee record', auth: true },
        { method: 'GET', path: '/:id', description: 'Get employee details', auth: true },
        { method: 'PUT', path: '/:id', description: 'Update employee record', auth: true },
        { method: 'DELETE', path: '/:id', description: 'Delete employee record', auth: true },
      ],
    },
    {
      group: 'Departments',
      prefix: '/api/departments',
      endpoints: [
        { method: 'GET', path: '/', description: 'List departments', auth: true },
        { method: 'POST', path: '/', description: 'Create department', auth: true },
      ],
    },
    {
      group: 'Positions',
      prefix: '/api/positions',
      endpoints: [
        { method: 'GET', path: '/', description: 'List job positions', auth: true },
        { method: 'POST', path: '/', description: 'Create job position', auth: true },
      ],
    },
    {
      group: 'Locations',
      prefix: '/api/locations',
      endpoints: [
        { method: 'GET', path: '/', description: 'List work locations and GPS coordinates', auth: true },
        { method: 'POST', path: '/', description: 'Create work location', auth: true },
        { method: 'POST', path: '/validate', description: 'Validate GPS attendance radius', auth: true },
      ],
    },
    {
      group: 'Attendance',
      prefix: '/api/attendance',
      endpoints: [
        { method: 'POST', path: '/check-in', description: 'Clock in attendance with geofence', auth: true },
        { method: 'POST', path: '/check-out', description: 'Clock out attendance', auth: true },
        { method: 'GET', path: '/today', description: 'Get current day attendance status', auth: true },
        { method: 'GET', path: '/history', description: 'Get employee attendance history', auth: true },
        { method: 'GET', path: '/summary', description: 'Get monthly attendance summary', auth: true },
      ],
    },
    {
      group: 'Leaves',
      prefix: '/api/leaves',
      endpoints: [
        { method: 'POST', path: '/', description: 'Submit leave request', auth: true },
        { method: 'GET', path: '/', description: 'List leave requests', auth: true },
        { method: 'GET', path: '/quota', description: 'Get employee leave balance and quota', auth: true },
        { method: 'PUT', path: '/:id/status', description: 'Approve or reject leave request', auth: true },
      ],
    },
    {
      group: 'Payrolls',
      prefix: '/api/payrolls',
      endpoints: [
        { method: 'POST', path: '/calculate', description: 'Calculate employee payroll with taxes and BPJS', auth: true },
        { method: 'POST', path: '/process', description: 'Process monthly payroll batch', auth: true },
        { method: 'GET', path: '/', description: 'List payroll records', auth: true },
        { method: 'GET', path: '/:id', description: 'Get payroll details', auth: true },
        { method: 'GET', path: '/:id/slip', description: 'Generate and retrieve payslip', auth: true },
      ],
    },
    {
      group: 'Cash Advances',
      prefix: '/api/cash-advances',
      endpoints: [
        { method: 'POST', path: '/', description: 'Apply for salary advance (kasbon)', auth: true },
        { method: 'GET', path: '/', description: 'List cash advance applications', auth: true },
        { method: 'PUT', path: '/:id/status', description: 'Approve or reject cash advance', auth: true },
      ],
    },
    {
      group: 'Social Feed & Forum',
      prefix: '/api/posts',
      endpoints: [
        { method: 'GET', path: '/', description: 'Get social feed and forum posts', auth: true },
        { method: 'POST', path: '/', description: 'Create post', auth: true },
        { method: 'GET', path: '/:id', description: 'Get single post with author and like status', auth: true },
        { method: 'DELETE', path: '/:id', description: 'Delete post', auth: true },
        { method: 'POST', path: '/:id/like', description: 'Toggle like/unlike post', auth: true },
        { method: 'GET', path: '/:id/comments', description: 'Get post comments', auth: true },
        { method: 'POST', path: '/:id/comments', description: 'Add comment to post', auth: true },
        { method: 'DELETE', path: '/comments/:commentId', description: 'Delete comment', auth: true },
      ],
    },
    {
      group: 'Direct Messages',
      prefix: '/api/messages',
      endpoints: [
        { method: 'POST', path: '/', description: 'Send direct message to coworker', auth: true },
        { method: 'GET', path: '/', description: 'List active conversations with unread counter', auth: true },
        { method: 'GET', path: '/:userId', description: 'Get conversation history and mark as read', auth: true },
        { method: 'PUT', path: '/:messageId/read', description: 'Mark message as read', auth: true },
      ],
    },
    {
      group: 'Announcements',
      prefix: '/api/announcements',
      endpoints: [
        { method: 'GET', path: '/', description: 'List company announcements', auth: true },
        { method: 'GET', path: '/:id', description: 'Get announcement details', auth: true },
        { method: 'POST', path: '/', description: 'Create announcement draft (Admin only)', auth: true },
        { method: 'PUT', path: '/:id/publish', description: 'Publish announcement (Admin only)', auth: true },
        { method: 'PUT', path: '/:id', description: 'Update announcement (Admin only)', auth: true },
        { method: 'DELETE', path: '/:id', description: 'Delete announcement (Admin only)', auth: true },
      ],
    },
    {
      group: 'Shifts',
      prefix: '/api/shifts',
      endpoints: [
        { method: 'GET', path: '/', description: 'List shift definitions', auth: true },
        { method: 'POST', path: '/', description: 'Create shift definition', auth: true },
        { method: 'PUT', path: '/:id', description: 'Update shift definition', auth: true },
        { method: 'DELETE', path: '/:id', description: 'Delete shift definition', auth: true },
        { method: 'POST', path: '/assign', description: 'Assign shift to employee', auth: true },
        { method: 'GET', path: '/calendar', description: 'Get monthly shift calendar', auth: true },
        { method: 'POST', path: '/swap', description: 'Swap shift between employees', auth: true },
        { method: 'GET', path: '/current', description: 'Get employee current day shift', auth: true },
      ],
    },
  ],
};

async function checkServiceHealth(url: string): Promise<'healthy' | 'unhealthy' | 'unreachable'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    return res.ok ? 'healthy' : 'unhealthy';
  } catch {
    return 'unreachable';
  }
}

export async function docsRoutes(app: FastifyInstance) {
  // Documentation catalog
  app.get('/docs', async () => {
    return apiCatalog;
  });

  // Aggregated healthcheck of all microservices
  app.get('/healthcheck', async () => {
    const [auth, employee, payroll, attendance, leave, social, shift] = await Promise.all([
      checkServiceHealth(process.env.AUTH_SERVICE_URL || 'http://localhost:3010'),
      checkServiceHealth(process.env.EMPLOYEE_SERVICE_URL || 'http://localhost:3011'),
      checkServiceHealth(process.env.PAYROLL_SERVICE_URL || 'http://localhost:3012'),
      checkServiceHealth(process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3013'),
      checkServiceHealth(process.env.LEAVE_SERVICE_URL || 'http://localhost:3014'),
      checkServiceHealth(process.env.SOCIAL_SERVICE_URL || 'http://localhost:3015'),
      checkServiceHealth(process.env.SHIFT_SERVICE_URL || 'http://localhost:3016'),
    ]);

    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: {
        auth,
        employee,
        payroll,
        attendance,
        leave,
        social,
        shift,
      },
    };
  });
}
