import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, departments, positions, workLocations, shifts, bpjsConfig, taxConfig, overtimeRates } from './schema';
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
  });

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
  ]);

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
  ]);

  // Seed Work Locations
  await db.insert(workLocations).values([
    {
      name: 'Head Office',
      address: 'Jl. Sudirman No. 123, Jakarta',
      latitude: '-6.2088',
      longitude: '106.8456',
      radiusMeters: 100,
    },
    {
      name: 'Branch Office Bandung',
      address: 'Jl. Asia Afrika No. 456, Bandung',
      latitude: '-6.9175',
      longitude: '107.6191',
      radiusMeters: 100,
    },
  ]);

  // Seed Shifts
  await db.insert(shifts).values([
    { name: 'Pagi', startTime: '08:00', endTime: '16:00' },
    { name: 'Siang', startTime: '12:00', endTime: '20:00' },
    { name: 'Malam', startTime: '20:00', endTime: '04:00' },
  ]);

  // Seed BPJS Config
  await db.insert(bpjsConfig).values([
    { component: 'JKK', employeeRate: '0', employerRate: '0.24', effectiveDate: '2024-01-01' },
    { component: 'JKM', employeeRate: '0', employerRate: '0.30', effectiveDate: '2024-01-01' },
    { component: 'JP', employeeRate: '2', employerRate: '3.70', maxSalaryCap: '12000000', effectiveDate: '2024-01-01' },
    { component: 'JHT', employeeRate: '2', employerRate: '3.70', effectiveDate: '2024-01-01' },
    { component: 'BPJS_KES', employeeRate: '1', employerRate: '4', effectiveDate: '2024-01-01' },
  ]);

  // Seed Tax Config (PPh 21 2024)
  await db.insert(taxConfig).values([
    { bracketFrom: '0', bracketTo: '60000000', rate: '5', fixedAmount: '0', effectiveDate: '2024-01-01' },
    { bracketFrom: '60000000', bracketTo: '250000000', rate: '15', fixedAmount: '3000000', effectiveDate: '2024-01-01' },
    { bracketFrom: '250000000', bracketTo: '500000000', rate: '25', fixedAmount: '31500000', effectiveDate: '2024-01-01' },
    { bracketFrom: '500000000', bracketTo: '5000000000', rate: '30', fixedAmount: '106500000', effectiveDate: '2024-01-01' },
    { bracketFrom: '5000000000', bracketTo: null, rate: '35', fixedAmount: '1606500000', effectiveDate: '2024-01-01' },
  ]);

  // Seed Overtime Rates
  await db.insert(overtimeRates).values([
    { name: 'Weekday', multiplier: '1.5', dayType: 'weekday' },
    { name: 'Weekend', multiplier: '2.0', dayType: 'weekend' },
    { name: 'Holiday', multiplier: '3.0', dayType: 'holiday' },
  ]);

  console.log('Seed completed!');
  await client.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
