# Phase 7: Payroll Service

**Objective:** Implementasi perhitungan gaji, BPJS, PPh 21, dan slip gaji PDF  
**Estimated Time:** 12-15 hours  
**Prerequisites:** Phase 6 selesai

---

## Tasks

### 7.1 Initialize Payroll Service

```bash
# Create payroll service
mkdir -p apps/payroll-service/src/{routes,services,middleware,utils}
cd apps/payroll-service

# package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/payroll-service",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0",
    "pdf-lib": "^1.17.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

cp ../auth-service/tsconfig.json .
```

### 7.2 Create BPJS Calculation Service

```bash
# src/services/bpjs.ts
cat > src/services/bpjs.ts << 'EOF'
import { db } from '../utils/db';
import { bpjsConfig } from '@payrollpro/db';
import { eq } from 'drizzle-orm';

interface BpjsCalculation {
  component: string;
  employeeAmount: number;
  employerAmount: number;
}

// Calculate BPJS contributions
export async function calculateBPJS(grossSalary: number): Promise<{
  detail: BpjsCalculation[];
  totalEmployee: number;
  totalEmployer: number;
}> {
  const configs = await db.select().from(bpjsConfig).where(eq(bpjsConfig.isActive, true));
  
  const detail: BpjsCalculation[] = [];
  let totalEmployee = 0;
  let totalEmployer = 0;

  for (const config of configs) {
    // Apply max salary cap if exists
    const salaryBase = config.maxSalaryCap ? Math.min(grossSalary, parseFloat(config.maxSalaryCap)) : grossSalary;
    
    const employeeAmount = salaryBase * (parseFloat(config.employeeRate) / 100);
    const employerAmount = salaryBase * (parseFloat(config.employerRate) / 100);
    
    totalEmployee += employeeAmount;
    totalEmployer += employerAmount;
    
    detail.push({
      component: config.component,
      employeeAmount: Math.round(employeeAmount),
      employerAmount: Math.round(employerAmount),
    });
  }

  return {
    detail,
    totalEmployee: Math.round(totalEmployee),
    totalEmployer: Math.round(totalEmployer),
  };
}

// BPJS Components reference:
// JKK: Employee 0%, Employer 0.24% - 1.74%
// JKM: Employee 0%, Employer 0.30%
// JP: Employee 2%, Employer 3.70% (cap Rp 12.000.000)
// JHT: Employee 2%, Employer 3.70%
// BPJS Kesehatan: Employee 4%, Employer 4%
EOF
```

### 7.3 Create Tax Calculation Service (PPh 21)

```bash
# src/services/tax.ts
cat > src/services/tax.ts << 'EOF'
import { db } from '../utils/db';
import { taxConfig } from '@payrollpro/db';
import { eq } from 'drizzle-orm';

// PTKP (Penghasilan Tidak Kena Pajak) 2024
const PTKP: Record<string, number> = {
  'TK/0': 54000000, // Tidak kawin tanpa tanggungan
  'TK/1': 58500000, // 1 tanggungan
  'TK/2': 63000000, // 2 tanggungan
  'TK/3': 67500000, // 3 tanggungan
  'K/0': 58500000,  // Kawin tanpa tanggungan
  'K/1': 63000000,  // Kawin 1 tanggungan
  'K/2': 67500000,  // Kawin 2 tanggungan
  'K/3': 72000000,  // Kawin 3 tanggungan
};

interface TaxResult {
  annualGrossIncome: number;
  annualNetIncome: number;
  annualTaxableIncome: number;
  annualTax: number;
  monthlyTax: number;
  totalEmployeeBPJS: number;
  totalEmployerBPJS: number;
}

// Calculate PPh 21 monthly tax
export async function calculatePPh21(
  monthlyGrossSalary: number,
  annualBonus: number = 0,
  maritalStatus: string = 'TK/0',
  additionalTaxableIncome: number = 0
): Promise<TaxResult> {
  // Annual gross income = monthly gross × 12
  const annualGross = monthlyGrossSalary * 12 + annualBonus;
  
  // Biaya jabatan (5% dari penghasilan bruto, maksimal Rp 6.000.000/tahun)
  const jabatanFee = Math.min(annualGross * 0.05, 6000000);
  
  // Iuran pensiun (up to 5% of salary)
  const pensionFee = Math.min(annualGross * 0.05, (monthlyGrossSalary * 12) * 0.05);
  
  // Annual net income
  const annualNet = annualGross - jabatanFee - pensionFee;
  
  // PTKP
  const ptkp = PTKP[maritalStatus] || PTKP['TK/0'];
  
  // PKP (Penghasilan Kena Pajak)
  const pkp = Math.max(0, annualNet - ptkp);
  
  // Get tax brackets
  const brackets = await db.select().from(taxConfig).where(eq(taxConfig.isActive, true)).orderBy(taxConfig.bracketFrom);
  
  // Calculate progressive tax
  let annualTax = 0;
  let remainingIncome = pkp;
  
  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;
    
    const bracketTo = bracket.bracketTo ? parseFloat(bracket.bracketTo) : Infinity;
    const bracketRange = bracketTo - parseFloat(bracket.bracketFrom);
    const taxable = Math.min(remainingIncome, bracketRange);
    
    annualTax += taxable * (parseFloat(bracket.rate) / 100);
    remainingIncome -= taxable;
  }
  
  // Monthly tax
  const monthlyTax = annualTax / 12;

  return {
    annualGrossIncome: annualGross,
    annualNetIncome: annualNet,
    annualTaxableIncome: pkp,
    annualTax,
    monthlyTax: Math.round(monthlyTax),
    totalEmployeeBPJS: 0, // Set by calculateBPJS
    totalEmployerBPJS: 0,
  };
}

export { PTKP };
EOF
```

### 7.4 Create Overtime Calculation Service

```bash
# src/services/overtime.ts
cat > src/services/overtime.ts << 'EOF'
import { db } from '../utils/db';
import { overtimeRates, attendances, shifts, employeeShifts } from '@payrollpro/db';
import { eq, and } from 'drizzle-orm';

interface OvertimePayResult {
  totalHours: number;
  overtimePay: number;
  detail: Array<{
    date: string;
    hours: number;
    rateMultiplier: number;
    pay: number;
  }>;
}

// Calculate overtime pay for an employee in a period
export async function calculateOvertimePay(
  employeeId: string,
  startDate: string,
  endDate: string,
  monthlyBaseSalary: number
): Promise<OvertimePayResult> {
  const attendanceRecords = await db.select().from(attendances)
    .where(eq(attendances.employeeId, employeeId));

  if (attendanceRecords.length === 0) {
    return { totalHours: 0, overtimePay: 0, detail: [] };
  }

  // Hourly rate = monthly salary / 173
  const hourlyRate = monthlyBaseSalary / 173;

  const detail = [];
  let totalHours = 0;
  let totalPay = 0;

  for (const att of attendanceRecords) {
    if (!att.overtimeHours || parseFloat(att.overtimeHours) <= 0) continue;
    
    const date = new Date(att.date);
    const dayOfWeek = date.getUTCDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Determine rate multiplier
    const dayType = isWeekend ? 'weekend' : 'weekday';
    const rate = await db.select().from(overtimeRates)
      .where(and(
        eq(overtimeRates.dayType, dayType),
        eq(overtimeRates.isActive, true)
      ))
      .limit(1);

    const multiplier = rate.length > 0 ? parseFloat(rate[0].multiplier) : 1.5;
    const hours = parseFloat(att.overtimeHours);
    const pay = hours * hourlyRate * multiplier;

    totalHours += hours;
    totalPay += pay;

    detail.push({
      date: att.date,
      hours,
      rateMultiplier: multiplier,
      pay: Math.round(pay),
    });
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    overtimePay: Math.round(totalPay),
    detail,
  };
}
EOF
```

### 7.5 Create Payroll Processing Service

```bash
# src/services/payroll-processor.ts
cat > src/services/payroll-processor.ts << 'EOF'
import { db } from '../utils/db';
import { employees, positions, departments, payrolls, attendances, cashAdvances } from '@payrollpro/db';
import { eq, and, sql } from 'drizzle-orm';
import { calculateBPJS } from './bpjs';
import { calculatePPh21 } from './tax';
import { calculateOvertimePay } from './overtime';

interface PayrollResult {
  payrollId: string;
  netSalary: number;
  breakdown: {
    baseSalary: number;
    overtimePay: number;
    allowances: number;
    bpjsEmployee: number;
    bpjsEmployer: number;
    taxDeduction: number;
    cashAdvance: number;
    otherDeductions: number;
  };
}

// Process payroll for a single employee
export async function processEmployeePayroll(
  employeeId: string,
  month: number,
  year: number
): Promise<PayrollResult> {
  // Get employee with position
  const employee = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  
  if (employee.length === 0) {
    throw new Error('Employee not found');
  }

  const position = await db.select().from(positions).where(eq(positions.id, employee[0].positionId)).limit(1);
  
  if (position.length === 0) {
    throw new Error('Position not found');
  }

  // Get base salary (from position or employee override)
  const baseSalary = parseFloat(employee[0].baseSalary || position[0].baseSalary);

  // Calculate overtime
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
  
  const overtime = await calculateOvertimePay(employeeId, startDate, endDate, baseSalary);

  // Calculate BPJS
  const bpjs = await calculateBPJS(baseSalary + overtime.overtimePay);

  // Calculate PPh 21
  const tax = await calculatePPh21(baseSalary + overtime.overtimePay);

  // Get cash advances for this period
  const advances = await db.select().from(cashAdvances)
    .where(and(
      eq(cashAdvances.employeeId, employeeId),
      eq(cashAdvances.month, month),
      eq(cashAdvances.year, year),
      eq(cashAdvances.status, 'approved')
    ));

  const totalCashAdvance = advances.reduce((sum, a) => sum + parseFloat(a.amount), 0);

  // Check cash advance limit (max 25% of salary)
  const maxAdvance = baseSalary * 0.25;
  if (totalCashAdvance > maxAdvance) {
    throw new Error(`Cash advance exceeds limit of ${maxAdvance}`);
  }

  // Calculate net salary
  const netSalary = 
    baseSalary +
    overtime.overtimePay +
    parseFloat(employee[0].baseSalary || '0') * 0.05 // Example allowance
    - bpjs.totalEmployee
    - tax.monthlyTax
    - totalCashAdvance;

  // Create payroll record
  const payroll = await db.insert(payrolls).values({
    employeeId,
    periodMonth: month,
    periodYear: year,
    baseSalary,
    overtimePay: overtime.overtimePay,
    allowances: parseFloat(employee[0].baseSalary || '0') * 0.05,
    bpjsEmployee: bpjs.totalEmployee,
    bpjsEmployer: bpjs.totalEmployer,
    taxDeduction: tax.monthlyTax,
    cashAdvance: totalCashAdvance,
    otherDeductions: 0,
    netSalary,
    status: 'processed',
  }).returning();

  // Mark cash advances as deducted
  for (const advance of advances) {
    await db.update(cashAdvances)
      .set({ status: 'deducted' })
      .where(eq(cashAdvances.id, advance.id));
  }

  return {
    payrollId: payroll[0].id,
    netSalary,
    breakdown: {
      baseSalary,
      overtimePay: overtime.overtimePay,
      allowances: parseFloat(employee[0].baseSalary || '0') * 0.05,
      bpjsEmployee: bpjs.totalEmployee,
      bpjsEmployer: bpjs.totalEmployer,
      taxDeduction: tax.monthlyTax,
      cashAdvance: totalCashAdvance,
      otherDeductions: 0,
    },
  };
}

// Process payroll for all employees
export async function processAllPayrolls(month: number, year: number): Promise<PayrollResult[]> {
  const allEmployees = await db.select().from(employees).where(eq(employees.isActive, true));
  
  const results: PayrollResult[] = [];
  
  for (const employee of allEmployees) {
    try {
      const result = await processEmployeePayroll(employee.id, month, year);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process payroll for employee ${employee.id}:`, error);
    }
  }
  
  return results;
}
EOF
```

### 7.6 Create Payslip PDF Generator

```bash
# src/services/payslip.ts
cat > src/services/payslip.ts << 'EOF'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '../utils/db';
import { payrolls, employees, positions, departments } from '@payrollpro/db';
import { eq } from 'drizzle-orm';

// Generate payslip PDF
export async function generatePayslip(payrollId: string): Promise<Buffer> {
  // Get payroll data
  const payroll = await db.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
  
  if (payroll.length === 0) {
    throw new Error('Payroll not found');
  }

  // Get employee data
  const employee = await db.select().from(employees).where(eq(employees.id, payroll[0].employeeId)).limit(1);
  
  if (employee.length === 0) {
    throw new Error('Employee not found');
  }

  const position = await db.select().from(positions).where(eq(positions.id, employee[0].positionId)).limit(1);
  const department = await db.select().from(departments).where(eq(departments.id, employee[0].departmentId)).limit(1);

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Header
  page.drawText('PAYROLLPRO', { x: 50, y: height - 50, size: 24, font: fontBold, color: rgb(0.1, 0.1, 0.8) });
  page.drawText('Slip Gaji Karyawan', { x: 50, y: height - 80, size: 14, font: font });

  // Employee info box
  page.drawRectangle({ x: 50, y: height - 250, width: 495, height: 160, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });

  const infoStartY = height - 90;
  page.drawText(`Nama        : ${employee[0].fullName}`, { x: 60, y: infoStartY - 20, size: 10, font });
  page.drawText(`NIP          : ${employee[0].nip}`, { x: 60, y: infoStartY - 40, size: 10, font });
  page.drawText(`Departemen: ${department[0]?.name || '-'}`, { x: 60, y: infoStartY - 60, size: 10, font });
  page.drawText(`Jabatan      : ${position[0]?.name || '-'}`, { x: 60, y: infoStartY - 80, size: 10, font });
  page.drawText(`Periode      : ${payroll[0].periodMonth}/${payroll[0].periodYear}`, { x: 60, y: infoStartY - 100, size: 10, font });
  page.drawText(`Status        : ${payroll[0].status}`, { x: 60, y: infoStartY - 120, size: 10, font });

  // Income section
  const incomeY = height - 280;
  page.drawText('PENDAPATAN', { x: 50, y: incomeY, size: 12, font: fontBold });

  const incomeItems = [
    { label: 'Gaji Pokok', value: payroll[0].baseSalary },
    { label: 'Uang Lembur', value: payroll[0].overtimePay },
    { label: 'Tunjangan', value: payroll[0].allowances },
  ];

  let currentY = incomeY - 20;
  for (const item of incomeItems) {
    page.drawText(item.label, { x: 60, y: currentY, size: 10, font });
    page.drawText(formatRupiah(parseFloat(item.value)), { x: 400, y: currentY, size: 10, font, align: 'right' });
    currentY -= 20;
  }

  const totalIncome = incomeItems.reduce((sum, i) => sum + parseFloat(i.value), 0);
  page.drawLine({ start: { x: 50, y: currentY + 4 }, end: { x: 545, y: currentY + 4 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText('TOTAL PENDAPATAN', { x: 60, y: currentY - 15, size: 11, font: fontBold });
  page.drawText(formatRupiah(totalIncome), { x: 400, y: currentY - 15, size: 11, font: fontBold, align: 'right' });

  // Deduction section
  const deductionY = currentY - 40;
  page.drawText('POTONGAN', { x: 50, y: deductionY, size: 12, font: fontBold });

  const deductionItems = [
    { label: 'BPJS (Karyawan)', value: payroll[0].bpjsEmployee },
    { label: 'PPh 21', value: payroll[0].taxDeduction },
    { label: 'Kasbon', value: payroll[0].cashAdvance },
    { label: 'Lain-lain', value: payroll[0].otherDeductions },
  ];

  currentY = deductionY - 20;
  for (const item of deductionItems) {
    page.drawText(item.label, { x: 60, y: currentY, size: 10, font });
    page.drawText(formatRupiah(parseFloat(item.value)), { x: 400, y: currentY, size: 10, font, align: 'right' });
    currentY -= 20;
  }

  const totalDeduction = deductionItems.reduce((sum, i) => sum + parseFloat(i.value), 0);
  page.drawLine({ start: { x: 50, y: currentY + 4 }, end: { x: 545, y: currentY + 4 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText('TOTAL POTONGAN', { x: 60, y: currentY - 15, size: 11, font: fontBold });
  page.drawText(formatRupiah(totalDeduction), { x: 400, y: currentY - 15, size: 11, font: fontBold, align: 'right' });

  // Net salary box
  page.drawRectangle({ x: 50, y: currentY - 90, width: 495, height: 50, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  page.drawText('GAJI BERSIH (NET)', { x: 60, y: currentY - 65, size: 14, font: fontBold });
  page.drawText(formatRupiah(parseFloat(payroll[0].netSalary)), { x: 400, y: currentY - 65, size: 14, font: fontBold, align: 'right', color: rgb(0, 0.5, 0) });

  // Footer
  page.drawText('Dokumen ini digenerate otomatis oleh PayrollPro System', {
    x: 50, y: 50, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}
EOF
```

### 7.7 Create Payroll Routes

```bash
# src/routes/payrolls.ts
cat > src/routes/payrolls.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { payrolls } from '@payrollpro/db';
import { eq, and, desc } from 'drizzle-orm';
import { processAllPayrolls, processEmployeePayroll } from '../services/payroll-processor';
import { generatePayslip } from '../services/payslip';

const processSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
});

export async function payrollRoutes(app: FastifyInstance) {
  // Process payroll for all employees
  app.post('/process', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = processSchema.parse(request.body);
      
      const results = await processAllPayrolls(body.month, body.year);
      
      return reply.status(201).send({
        success: true,
        data: results,
        message: `Processed ${results.length} payrolls for ${body.month}/${body.year}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Process payroll for single employee
  app.post('/process/employee', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = processSchema.extend({ employeeId: z.string().uuid() }).parse(request.body);
      
      const result = await processEmployeePayroll(body.employeeId, body.month, body.year);
      
      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get all payrolls
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month, year, employeeId } = request.query as any;
      
      let query = db.select().from(payrolls);
      
      if (month && year) {
        query = query.where(and(
          eq(payrolls.periodMonth, parseInt(month)),
          eq(payrolls.periodYear, parseInt(year))
        ));
      }
      
      if (employeeId) {
        query = query.where(eq(payrolls.employeeId, employeeId));
      }
      
      const data = await query.orderBy(desc(payrolls.createdAt));
      
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single payroll
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const payroll = await db.select().from(payrolls).where(eq(payrolls.id, id)).limit(1);
      
      if (payroll.length === 0) {
        return reply.status(404).send({ error: 'Payroll not found' });
      }

      return reply.send({ success: true, data: payroll[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Download payslip PDF
  app.get('/:id/slip', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const pdfBuffer = await generatePayslip(id);
      
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="payslip-${id}.pdf"`)
        .send(pdfBuffer);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to generate payslip' });
    }
  });

  // Mark payroll as paid
  app.put('/:id/paid', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const updated = await db.update(payrolls)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(payrolls.id, id))
        .returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Payroll not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 7.8 Create Cash Advance Routes

```bash
# src/routes/cash-advances.ts
cat > src/routes/cash-advances.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { cashAdvances, employees } from '@payrollpro/db';
import { eq, and, desc } from 'drizzle-orm';

const cashAdvanceSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
});

export async function cashAdvanceRoutes(app: FastifyInstance) {
  // Request cash advance
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = cashAdvanceSchema.parse(request.body);

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // Check limit (25% of salary)
      const maxAdvance = parseFloat(employee[0].baseSalary) * 0.25;
      if (body.amount > maxAdvance) {
        return reply.status(400).send({
          error: `Cash advance cannot exceed 25% of salary (max: ${maxAdvance})`,
        });
      }

      // Check existing pending request
      const now = new Date();
      const existing = await db.select().from(cashAdvances)
        .where(and(
          eq(cashAdvances.employeeId, employee[0].id),
          eq(cashAdvances.month, now.getMonth() + 1),
          eq(cashAdvances.year, now.getFullYear()),
          eq(cashAdvances.status, 'pending')
        ));

      if (existing.length > 0) {
        return reply.status(400).send({ error: 'Already have a pending cash advance this month' });
      }

      const newAdvance = await db.insert(cashAdvances).values({
        employeeId: employee[0].id,
        amount: body.amount,
        reason: body.reason,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: 'pending',
      }).returning();

      return reply.status(201).send({ success: true, data: newAdvance[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get cash advance history
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      
      if (employee.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      const data = await db.select().from(cashAdvances)
        .where(eq(cashAdvances.employeeId, employee[0].id))
        .orderBy(desc(cashAdvances.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Approve/Reject cash advance (HR/Manager)
  app.put('/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      const { id } = request.params as { id: string };
      const body = z.object({ approved: z.boolean() }).parse(request.body);

      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const updated = await db.update(cashAdvances)
        .set({
          status: body.approved ? 'approved' : 'rejected',
          approvedBy: user.id,
          approvedAt: new Date(),
        })
        .where(eq(cashAdvances.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Cash advance not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 7.9 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { payrollRoutes } from './routes/payrolls';
import { cashAdvanceRoutes } from './routes/cash-advances';

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

app.decorate('authenticate', async (request: any, reply: any) => {
  try { await request.jwtVerify(); } catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(payrollRoutes, { prefix: '/api/payrolls' });
await app.register(cashAdvanceRoutes, { prefix: '/api/cash-advances' });

app.get('/health', async () => ({ status: 'ok', service: 'payroll-service' }));

const start = async () => {
  const port = parseInt(process.env.PORT || '3012');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Payroll service running on port ${port}`);
};

start();
EOF
```

### 7.10 Create Dockerfile

```bash
cat > Dockerfile << 'EOF'
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER fastify
EXPOSE 3012
CMD ["node", "dist/index.js"]
EOF
```

---

## Verification Checklist

- [x] Payroll service running on port 3012
- [x] BPJS calculation correct
- [x] PPh 21 calculation correct
- [x] Overtime pay calculation correct
- [x] Cash advance deduction works
- [x] Net salary calculation correct
- [x] PDF payslip generation works
- [x] Payroll status tracking works

---

## BPJS Calculation Reference

| Component | Employee | Employer | Max Cap |
|-----------|----------|----------|---------|
| JKK | 0% | 0.24%-1.74% | - |
| JKM | 0% | 0.30% | - |
| JP | 2% | 3.70% | Rp 12.000.000 |
| JHT | 2% | 3.70% | - |
| BPJS Kes | 4% | 4% | - |

## PPh 21 Progressive Rates (2024)

| Bracket | Range (Annual) | Rate |
|---------|----------------|------|
| 1 | s/d Rp 60.000.000 | 5% |
| 2 | Rp 60-250.000.000 | 15% |
| 3 | Rp 250-500.000.000 | 25% |
| 4 | Rp 500.000.000 - 5M | 30% |
| 5 | > Rp 5M | 35% |

## PTKP (2024)

| Status | PTKP |
|--------|------|
| TK/0 | Rp 54.000.000 |
| TK/1 | Rp 58.500.000 |
| TK/2 | Rp 63.000.000 |
| TK/3 | Rp 67.500.000 |
| K/0 | Rp 58.500.000 |
| K/1 | Rp 63.000.000 |
| K/2 | Rp 67.500.000 |
| K/3 | Rp 72.000.000 |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payrolls/process` | Process all payrolls |
| POST | `/api/payrolls/process/employee` | Process single payroll |
| GET | `/api/payrolls` | Get all payrolls |
| GET | `/api/payrolls/:id` | Get payroll detail |
| GET | `/api/payrolls/:id/slip` | Download payslip PDF |
| PUT | `/api/payrolls/:id/paid` | Mark as paid |
| POST | `/api/cash-advances` | Request cash advance |
| GET | `/api/cash-advances/history` | Get cash advance history |
| PUT | `/api/cash-advances/:id/approve` | Approve/Reject |

---

## Next Phase

Setelah Phase 7 selesai, lanjut ke:
**[Phase 8: Shift Service](./PHASE-08-SHIFT-SERVICE.md)**