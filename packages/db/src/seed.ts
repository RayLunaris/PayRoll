import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { users, employees, departments, positions, workLocations, shifts, bpjsConfig, taxConfig, overtimeRates } from './schema';
import { hash } from 'bcrypt';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('Seeding database...');

  // Seed Super Admin
  const passwordHash = await hash('admin123', 12);
  await db.insert(users).values({
    email: 'admin@payrollpro.com',
    passwordHash,
    role: 'super_admin',
    isActive: true,
  }).onConflictDoNothing();

  // Seed Departments
  await db.insert(departments).values([
    {
      name: 'Human Resources',
      description: 'HR Department',
    },
    {
      name: 'Information Technology',
      description: 'IT Department',
    },
    {
      name: 'Finance',
      description: 'Finance Department',
    },
  ]).onConflictDoNothing();

  // Seed Positions
  await db.insert(positions).values([
    {
      name: 'Manager',
      description: 'Department Manager',
      baseSalary: '15000000',
      grade: 'M1',
    },
    {
      name: 'Staff',
      description: 'Regular Staff',
      baseSalary: '8000000',
      grade: 'S1',
    },
    {
      name: 'Admin',
      description: 'Administrative Staff',
      baseSalary: '6000000',
      grade: 'A1',
    },
  ]).onConflictDoNothing();

  // Seed Work Locations
  await db.insert(workLocations).values([
    {
      name: 'Djavasoft',
      address: 'Kepatihan, Kec. Tulungagung, Kabupaten Tulungagung, Jawa Timur 66223',
      latitude: '-8.0618388',
      longitude: '111.9119472',
      radiusMeters: 100,
    },
    {
      name: 'Bu RINA - Aneka Jajanan',
      address: 'Balerejo, Kec. Kauman, Kabupaten Tulungagung, Jawa Timur 66215',
      latitude: '-8.0612821',
      longitude: '111.8738753',
      radiusMeters: 100,
    },
  ]).onConflictDoNothing();

  // Seed Default Employee Profile for Super Admin
  const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@payrollpro.com')).limit(1);
  const [hrDept] = await db.select().from(departments).where(eq(departments.name, 'Human Resources')).limit(1);
  const [managerPos] = await db.select().from(positions).where(eq(positions.name, 'Manager')).limit(1);
  const [headOffice] = await db.select().from(workLocations).where(eq(workLocations.name, 'Djavasoft')).limit(1);

  if (adminUser && hrDept && managerPos && headOffice) {
    const existingEmp = await db.select().from(employees).where(eq(employees.userId, adminUser.id)).limit(1);
    if (existingEmp.length === 0) {
      const [adminEmp] = await db.insert(employees).values({
        userId: adminUser.id,
        nip: 'EMP001',
        fullName: 'Administrator',
        departmentId: hrDept.id,
        positionId: managerPos.id,
        locationId: headOffice.id,
        joinDate: '2024-01-01',
        baseSalary: '15000000',
        isActive: true,
      }).returning();

      await db.update(users).set({ employeeId: adminEmp.id }).where(eq(users.id, adminUser.id));
    }
  }

  // Seed Shifts
  await db.insert(shifts).values([
    { name: 'Pagi', startTime: '08:00', endTime: '16:00' },
    { name: 'Siang', startTime: '12:00', endTime: '20:00' },
    { name: 'Malam', startTime: '20:00', endTime: '04:00' },
  ]).onConflictDoNothing();

  // Seed BPJS Config
  await db.insert(bpjsConfig).values([
    { component: 'JKK', employeeRate: '0', employerRate: '0.24', effectiveDate: '2024-01-01' },
    { component: 'JKM', employeeRate: '0', employerRate: '0.30', effectiveDate: '2024-01-01' },
    { component: 'JP', employeeRate: '2', employerRate: '3.70', maxSalaryCap: '12000000', effectiveDate: '2024-01-01' },
    { component: 'JHT', employeeRate: '2', employerRate: '3.70', effectiveDate: '2024-01-01' },
    { component: 'BPJS_KES', employeeRate: '1', employerRate: '4', effectiveDate: '2024-01-01' },
  ]).onConflictDoNothing();

  // Seed Tax Config (PPh 21 2024)
  await db.insert(taxConfig).values([
    { bracketFrom: '0', bracketTo: '60000000', rate: '5', fixedAmount: '0', effectiveDate: '2024-01-01' },
    { bracketFrom: '60000000', bracketTo: '250000000', rate: '15', fixedAmount: '3000000', effectiveDate: '2024-01-01' },
    { bracketFrom: '250000000', bracketTo: '500000000', rate: '25', fixedAmount: '31500000', effectiveDate: '2024-01-01' },
    { bracketFrom: '500000000', bracketTo: '5000000000', rate: '30', fixedAmount: '106500000', effectiveDate: '2024-01-01' },
    { bracketFrom: '5000000000', bracketTo: null, rate: '35', fixedAmount: '1606500000', effectiveDate: '2024-01-01' },
  ]).onConflictDoNothing();

  // Seed Overtime Rates
  await db.insert(overtimeRates).values([
    { name: 'Weekday', multiplier: '1.5', dayType: 'weekday' },
    { name: 'Weekend', multiplier: '2.0', dayType: 'weekend' },
    { name: 'Holiday', multiplier: '3.0', dayType: 'holiday' },
  ]).onConflictDoNothing();

  console.log('Seed completed!');
  await client.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
