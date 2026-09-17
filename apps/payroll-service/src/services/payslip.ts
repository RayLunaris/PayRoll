import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db, payrolls, employees, positions, departments, eq } from '@payrollpro/db';

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

// Generate payslip PDF in memory
export async function generatePayslip(payrollId: string): Promise<Buffer> {
  const payroll = await db.select().from(payrolls).where(eq(payrolls.id, payrollId)).limit(1);
  if (payroll.length === 0) {
    throw new Error('Payroll not found');
  }

  const p = payroll[0];
  if (!p.employeeId) {
    throw new Error('Employee ID missing on payroll record');
  }

  const employee = await db.select().from(employees).where(eq(employees.id, p.employeeId)).limit(1);
  if (employee.length === 0) {
    throw new Error('Employee not found');
  }

  const emp = employee[0];
  const position = emp.positionId ? await db.select().from(positions).where(eq(positions.id, emp.positionId)).limit(1) : [];
  const department = emp.departmentId ? await db.select().from(departments).where(eq(departments.id, emp.departmentId)).limit(1) : [];

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Header Title
  page.drawText('PAYROLLPRO INDONESIA', {
    x: 50,
    y: height - 50,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.7),
  });

  page.drawText('SLIP GAJI KARYAWAN (OFFICIAL PAYSLIP)', {
    x: 50,
    y: height - 75,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Employee Information Box
  page.drawRectangle({
    x: 50,
    y: height - 210,
    width: 495,
    height: 120,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  const infoY = height - 110;
  page.drawText(`Nama Karyawan : ${emp.fullName}`, { x: 65, y: infoY, size: 10, font });
  page.drawText(`NIP           : ${emp.nip}`, { x: 65, y: infoY - 18, size: 10, font });
  page.drawText(`Departemen    : ${department[0]?.name || '-'}`, { x: 65, y: infoY - 36, size: 10, font });
  page.drawText(`Jabatan       : ${position[0]?.name || '-'}`, { x: 65, y: infoY - 54, size: 10, font });
  page.drawText(`Periode Gaji  : Bulan ${p.periodMonth} / ${p.periodYear}`, { x: 65, y: infoY - 72, size: 10, font });
  page.drawText(`Status        : ${(p.status || 'draft').toUpperCase()}`, { x: 65, y: infoY - 90, size: 10, font: fontBold });

  // Income Section
  let currentY = height - 240;
  page.drawText('PENDAPATAN (EARNINGS)', { x: 50, y: currentY, size: 11, font: fontBold, color: rgb(0.1, 0.5, 0.1) });

  const incomeItems = [
    { label: 'Gaji Pokok (Base Salary)', value: parseFloat(p.baseSalary) },
    { label: 'Uang Lembur (Overtime Pay)', value: parseFloat(p.overtimePay || '0') },
    { label: 'Tunjangan Operasional (Allowances)', value: parseFloat(p.allowances || '0') },
  ];

  currentY -= 20;
  for (const item of incomeItems) {
    page.drawText(item.label, { x: 65, y: currentY, size: 10, font });
    page.drawText(formatRupiah(item.value), { x: 420, y: currentY, size: 10, font });
    currentY -= 18;
  }

  const totalIncome = incomeItems.reduce((acc, curr) => acc + curr.value, 0);
  page.drawLine({ start: { x: 50, y: currentY + 6 }, end: { x: 545, y: currentY + 6 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  page.drawText('TOTAL PENDAPATAN KOTOR', { x: 65, y: currentY - 8, size: 10, font: fontBold });
  page.drawText(formatRupiah(totalIncome), { x: 420, y: currentY - 8, size: 10, font: fontBold });

  // Deduction Section
  currentY -= 36;
  page.drawText('POTONGAN (DEDUCTIONS)', { x: 50, y: currentY, size: 11, font: fontBold, color: rgb(0.7, 0.1, 0.1) });

  const deductionItems = [
    { label: 'BPJS Ketenagakerjaan & Kes (Karyawan)', value: parseFloat(p.bpjsEmployee || '0') },
    { label: 'Pajak Penghasilan PPh 21', value: parseFloat(p.taxDeduction || '0') },
    { label: 'Potongan Kasbon (Cash Advance)', value: parseFloat(p.cashAdvance || '0') },
    { label: 'Potongan Lain-lain', value: parseFloat(p.otherDeductions || '0') },
  ];

  currentY -= 20;
  for (const item of deductionItems) {
    page.drawText(item.label, { x: 65, y: currentY, size: 10, font });
    page.drawText(formatRupiah(item.value), { x: 420, y: currentY, size: 10, font });
    currentY -= 18;
  }

  const totalDeduction = deductionItems.reduce((acc, curr) => acc + curr.value, 0);
  page.drawLine({ start: { x: 50, y: currentY + 6 }, end: { x: 545, y: currentY + 6 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  page.drawText('TOTAL POTONGAN', { x: 65, y: currentY - 8, size: 10, font: fontBold });
  page.drawText(formatRupiah(totalDeduction), { x: 420, y: currentY - 8, size: 10, font: fontBold });

  // Net Salary Box
  currentY -= 50;
  page.drawRectangle({
    x: 50,
    y: currentY - 20,
    width: 495,
    height: 45,
    borderColor: rgb(0.1, 0.5, 0.1),
    borderWidth: 2,
    color: rgb(0.95, 0.99, 0.95),
  });

  page.drawText('GAJI BERSIH (TAKE HOME PAY)', { x: 65, y: currentY - 6, size: 12, font: fontBold });
  page.drawText(formatRupiah(parseFloat(p.netSalary)), {
    x: 390,
    y: currentY - 6,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.6, 0.1),
  });

  // Footer Note
  page.drawText('Dokumen ini digenerate secara otomatis oleh PayrollPro System dan sah tanpa tanda tangan basah.', {
    x: 50,
    y: 40,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
