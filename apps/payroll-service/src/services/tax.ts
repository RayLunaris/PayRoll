import { db, taxConfig, eq, asc } from '@payrollpro/db';

// PTKP (Penghasilan Tidak Kena Pajak) 2024
export const PTKP: Record<string, number> = {
  'TK/0': 54000000,
  'TK/1': 58500000,
  'TK/2': 63000000,
  'TK/3': 67500000,
  'K/0': 58500000,
  'K/1': 63000000,
  'K/2': 67500000,
  'K/3': 72000000,
};

export interface TaxResult {
  annualGrossIncome: number;
  annualNetIncome: number;
  annualTaxableIncome: number;
  annualTax: number;
  monthlyTax: number;
  totalEmployeeBPJS?: number;
  totalEmployerBPJS?: number;
}

export async function calculatePPh21(
  monthlyGrossSalary: number,
  annualBonus: number = 0,
  maritalStatus: string = 'TK/0',
  hasNPWP: boolean = true
): Promise<TaxResult> {
  // Annual gross income = monthly gross * 12 + bonus
  const annualGross = monthlyGrossSalary * 12 + annualBonus;

  // Biaya jabatan (5% dari bruto tahunan, maks Rp 6.000.000/tahun)
  const jabatanFee = Math.min(annualGross * 0.05, 6000000);

  // Iuran pensiun / jaminan hari tua (2% JHT + 1% JP = 3%, NOT 4%)
  const pensionFee = (monthlyGrossSalary * 12) * 0.03;

  // Annual net income
  const annualNet = Math.max(0, annualGross - jabatanFee - pensionFee);

  // PTKP
  const ptkpAmount = PTKP[maritalStatus] || PTKP['TK/0'];

  // PKP (Penghasilan Kena Pajak) dibulatkan ke bawah ribuan
  const pkp = Math.max(0, Math.floor((annualNet - ptkpAmount) / 1000) * 1000);

  // Get active progressive tax brackets ordered from lowest
  const brackets = await db.select().from(taxConfig)
    .where(eq(taxConfig.isActive, true))
    .orderBy(asc(taxConfig.bracketFrom));

  // Calculate progressive tax
  let annualTax = 0;
  let remainingIncome = pkp;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const from = parseFloat(bracket.bracketFrom);
    const to = bracket.bracketTo ? parseFloat(bracket.bracketTo) : Infinity;
    const bracketRange = to - from;

    const taxable = Math.min(remainingIncome, bracketRange);
    annualTax += taxable * (parseFloat(bracket.rate) / 100);
    remainingIncome -= taxable;
  }

  // Indonesian tax rule: 20% higher tax if employee does not possess an NPWP
  if (!hasNPWP) {
    annualTax = Math.round(annualTax * 1.2);
  }

  const monthlyTax = Math.round(annualTax / 12);

  return {
    annualGrossIncome: annualGross,
    annualNetIncome: annualNet,
    annualTaxableIncome: pkp,
    annualTax: Math.round(annualTax),
    monthlyTax,
  };
}
