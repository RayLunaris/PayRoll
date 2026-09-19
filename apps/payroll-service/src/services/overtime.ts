import { db, overtimeRates, attendances, eq, and, gte, lte } from '@payrollpro/db';

export interface OvertimePayResult {
  totalHours: number;
  overtimePay: number;
  detail: Array<{
    date: string;
    hours: number;
    rateMultiplier: number;
    pay: number;
  }>;
}

// Calculate overtime pay for an employee in a period with tiered rates
export async function calculateOvertimePay(
  employeeId: string,
  startDate: string,
  endDate: string,
  monthlyBaseSalary: number,
  holidays: string[] = []
): Promise<OvertimePayResult> {
  const records = await db.select().from(attendances)
    .where(and(
      eq(attendances.employeeId, employeeId),
      gte(attendances.date, startDate),
      lte(attendances.date, endDate)
    ));

  if (records.length === 0) {
    return { totalHours: 0, overtimePay: 0, detail: [] };
  }

  // Hourly rate according to Indonesian regulation = monthly salary / 173
  const hourlyRate = monthlyBaseSalary / 173;

  const detail = [];
  let totalHours = 0;
  let totalPay = 0;

  // Cache rate multipliers
  const activeRates = await db.select().from(overtimeRates).where(eq(overtimeRates.isActive, true));
  const rateMap: Record<string, number> = {};
  for (const r of activeRates) {
    if (r.dayType) {
      rateMap[r.dayType] = parseFloat(r.multiplier);
    }
  }

  const holidaySet = new Set(holidays);

  for (const att of records) {
    const hours = parseFloat(att.overtimeHours || '0');
    if (hours <= 0) continue;

    const date = new Date(att.date);
    const dayOfWeek = date.getUTCDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(att.date);

    let pay = 0;
    let effectiveMultiplier = 1.5;

    if (isHoliday) {
      const holidayMultiplier = rateMap['holiday'] || 3.0;
      pay = hours * hourlyRate * holidayMultiplier;
      effectiveMultiplier = holidayMultiplier;
    } else if (isWeekend) {
      const weekendMultiplier = rateMap['weekend'] || 2.0;
      pay = hours * hourlyRate * weekendMultiplier;
      effectiveMultiplier = weekendMultiplier;
    } else {
      // Indonesian Regulation: 1st hour is 1.5x, subsequent hours are 2.0x
      if (hours <= 1) {
        pay = hours * hourlyRate * (rateMap['weekday'] || 1.5);
        effectiveMultiplier = rateMap['weekday'] || 1.5;
      } else {
        const firstHourPay = 1 * hourlyRate * (rateMap['weekday'] || 1.5);
        const subsequentPay = (hours - 1) * hourlyRate * 2.0;
        pay = firstHourPay + subsequentPay;
        effectiveMultiplier = Number((pay / (hours * hourlyRate)).toFixed(2));
      }
    }

    const roundedPay = Math.round(pay);
    totalHours += hours;
    totalPay += roundedPay;

    detail.push({
      date: att.date,
      hours,
      rateMultiplier: effectiveMultiplier,
      pay: roundedPay,
    });
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    overtimePay: totalPay,
    detail,
  };
}
