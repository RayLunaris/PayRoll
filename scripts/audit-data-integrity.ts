import { db, client, users, employees, attendances, leaves, overtimeRequests, cashAdvances, shiftSwaps, isNull, sql } from '../packages/db/src/index';

async function runAudit() {
  console.log('====================================================');
  console.log('       PAYROLLPRO DATA INTEGRITY AUDIT (READ-ONLY)   ');
  console.log('====================================================\n');

  const issuesFound: { check: string; count: number; details: any[] }[] = [];

  try {
    // 1. Employees with null departmentId
    const employeesWithoutDept = await db
      .select({ id: employees.id, nip: employees.nip, fullName: employees.fullName, userId: employees.userId })
      .from(employees)
      .where(isNull(employees.departmentId));

    issuesFound.push({
      check: 'Employees with null departmentId (Risk of null === null bug)',
      count: employeesWithoutDept.length,
      details: employeesWithoutDept,
    });

    // 2. Orphaned employees (userId not found in users table)
    const orphanedEmployees = await db.execute(sql`
      SELECT e.id, e.nip, e.full_name, e.user_id
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE u.id IS NULL AND e.user_id IS NOT NULL;
    `);

    issuesFound.push({
      check: 'Employees with orphaned userId (User does not exist)',
      count: orphanedEmployees.length,
      details: orphanedEmployees as any[],
    });

    // 3. Attendances with orphaned employeeId
    const orphanedAttendances = await db.execute(sql`
      SELECT a.id, a.employee_id, a.date
      FROM attendances a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE e.id IS NULL OR a.employee_id IS NULL;
    `);

    issuesFound.push({
      check: 'Attendances with null or orphaned employeeId',
      count: orphanedAttendances.length,
      details: orphanedAttendances as any[],
    });

    // 4. Leaves with orphaned employeeId
    const orphanedLeaves = await db.execute(sql`
      SELECT l.id, l.employee_id, l.start_date, l.end_date, l.status
      FROM leaves l
      LEFT JOIN employees e ON l.employee_id = e.id
      WHERE e.id IS NULL OR l.employee_id IS NULL;
    `);

    issuesFound.push({
      check: 'Leaves with null or orphaned employeeId',
      count: orphanedLeaves.length,
      details: orphanedLeaves as any[],
    });

    // 5. Overtime requests with orphaned employeeId
    const orphanedOvertime = await db.execute(sql`
      SELECT o.id, o.employee_id, o.date, o.status
      FROM overtime_requests o
      LEFT JOIN employees e ON o.employee_id = e.id
      WHERE e.id IS NULL OR o.employee_id IS NULL;
    `);

    issuesFound.push({
      check: 'Overtime requests with null or orphaned employeeId',
      count: orphanedOvertime.length,
      details: orphanedOvertime as any[],
    });

    // 6. Cash advances with orphaned employeeId
    const orphanedCashAdvances = await db.execute(sql`
      SELECT c.id, c.employee_id, c.amount, c.status
      FROM cash_advances c
      LEFT JOIN employees e ON c.employee_id = e.id
      WHERE e.id IS NULL OR c.employee_id IS NULL;
    `);

    issuesFound.push({
      check: 'Cash advances with null or orphaned employeeId',
      count: orphanedCashAdvances.length,
      details: orphanedCashAdvances as any[],
    });

    // 7. Historical Self-Approvals in Leaves
    const selfApprovedLeaves = await db.execute(sql`
      SELECT l.id, l.employee_id, l.status, l.approved_by, e.full_name
      FROM leaves l
      INNER JOIN employees e ON l.employee_id = e.id
      WHERE l.approved_by = e.user_id AND l.status = 'approved';
    `);

    issuesFound.push({
      check: 'Historical self-approved leave requests (approvedBy === requester.userId)',
      count: selfApprovedLeaves.length,
      details: selfApprovedLeaves as any[],
    });

    // 8. Historical Self-Approvals in Overtime Requests
    const selfApprovedOvertime = await db.execute(sql`
      SELECT o.id, o.employee_id, o.status, o.approved_by, e.full_name
      FROM overtime_requests o
      INNER JOIN employees e ON o.employee_id = e.id
      WHERE o.approved_by = e.user_id AND o.status = 'approved';
    `);

    issuesFound.push({
      check: 'Historical self-approved overtime requests (approvedBy === requester.userId)',
      count: selfApprovedOvertime.length,
      details: selfApprovedOvertime as any[],
    });

    // 9. Historical Self-Approvals in Cash Advances
    const selfApprovedCashAdvances = await db.execute(sql`
      SELECT c.id, c.employee_id, c.status, c.approved_by, e.full_name
      FROM cash_advances c
      INNER JOIN employees e ON c.employee_id = e.id
      WHERE c.approved_by = e.user_id AND c.status = 'approved';
    `);

    issuesFound.push({
      check: 'Historical self-approved cash advances (approvedBy === requester.userId)',
      count: selfApprovedCashAdvances.length,
      details: selfApprovedCashAdvances as any[],
    });

    // 10. Historical Self-Approvals in Shift Swaps
    const selfApprovedSwaps = await db.execute(sql`
      SELECT s.id, s.requester_id, s.target_id, s.status, s.decided_by, e.full_name
      FROM shift_swaps s
      INNER JOIN employees e ON s.requester_id = e.id
      WHERE s.decided_by = e.user_id AND s.status = 'approved';
    `);

    issuesFound.push({
      check: 'Historical self-approved shift swaps (decidedBy === requester.userId)',
      count: selfApprovedSwaps.length,
      details: selfApprovedSwaps as any[],
    });

    // Print summary
    console.log('AUDIT RESULTS:');
    console.log('----------------------------------------------------');
    for (const item of issuesFound) {
      const statusStr = item.count === 0 ? ' [PASS] ' : ' [WARN] ';
      console.log(`${statusStr} ${item.check}: ${item.count} found`);
      if (item.count > 0 && item.count <= 10) {
        console.log('   Details:', JSON.stringify(item.details, null, 2));
      } else if (item.count > 10) {
        console.log(`   Details: (Showing first 5 of ${item.count})`, JSON.stringify(item.details.slice(0, 5), null, 2));
      }
    }
    console.log('----------------------------------------------------');
    console.log('Audit completed successfully.\n');

  } catch (error) {
    console.error('Audit failed with error:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runAudit();
