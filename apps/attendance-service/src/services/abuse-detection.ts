import { db, abuseLogs, attendances, eq, and, desc, gte, lte } from '@payrollpro/db';
import { getWIBDateString } from '@payrollpro/shared-types';
import { detectSpoofing } from './gps.js';

export interface AbuseDetectionResult {
  detected: boolean;
  type?: string;
  severity?: 'low' | 'medium' | 'high';
  description?: string;
}

// Detect GPS spoofing
export async function detectGPSSpoofing(
  employeeId: string,
  locations: { latitude: number; longitude: number }[]
): Promise<AbuseDetectionResult> {
  const coordinates = locations.map(l => ({
    latitude: l.latitude,
    longitude: l.longitude,
  }));

  if (detectSpoofing(coordinates)) {
    await db.insert(abuseLogs).values({
      employeeId,
      abuseType: 'gps_spoofing',
      description: 'Rapid location changes detected',
      severity: 'high',
    });

    return {
      detected: true,
      type: 'gps_spoofing',
      severity: 'high',
      description: 'Potential GPS spoofing detected',
    };
  }

  return { detected: false };
}

// Detect buddy punching (same location multiple employees within short interval)
export async function detectBuddyPunching(
  locationId: string,
  checkInTime: Date,
  thresholdMinutes: number = 5
): Promise<AbuseDetectionResult> {
  const timeWindow = new Date(checkInTime.getTime() - thresholdMinutes * 60 * 1000);
  // Attendance.date is stored in WIB, so derive the key from the WIB calendar day.
  const todayStr = getWIBDateString(checkInTime);

  const recentCheckIns = await db.select().from(attendances)
    .where(and(
      eq(attendances.locationId, locationId),
      eq(attendances.date, todayStr),
    ))
    .orderBy(desc(attendances.checkIn));

  // Buddy punching is suspected when two DIFFERENT employees submit check-ins with
  // virtually identical GPS coordinates (e.g. same device / mock location) within a short window.
  const suspiciousCheckIns = recentCheckIns.filter(a => {
    if (!a.checkIn || !a.checkInLat || !a.checkInLng) return false;
    const checkIn = new Date(a.checkIn);
    return checkIn >= timeWindow && checkIn <= checkInTime;
  });

  const buddyPunchCandidates = suspiciousCheckIns.filter((a, idx) => {
    return suspiciousCheckIns.some((b, bIdx) => {
      if (idx === bIdx || a.employeeId === b.employeeId) return false;
      const latDiff = Math.abs(parseFloat(a.checkInLat || '0') - parseFloat(b.checkInLat || '0'));
      const lngDiff = Math.abs(parseFloat(a.checkInLng || '0') - parseFloat(b.checkInLng || '0'));
      // ~0.00002 degrees is approximately 2 meters
      return latDiff < 0.00002 && lngDiff < 0.00002;
    });
  });

  if (buddyPunchCandidates.length > 1) {
    for (const checkIn of buddyPunchCandidates) {
      await db.insert(abuseLogs).values({
        employeeId: checkIn.employeeId,
        abuseType: 'buddy_punching',
        description: `Identical GPS coordinates detected between different employees within ${thresholdMinutes} minutes`,
        severity: 'medium',
      });
    }

    return {
      detected: true,
      type: 'buddy_punching',
      severity: 'medium',
      description: 'Potential buddy punching detected (identical GPS coordinates)',
    };
  }

  return { detected: false };
}

// Detect abnormal overtime patterns
export async function detectAbnormalOvertime(
  employeeId: string,
  maxOvertimeHours: number = 60
): Promise<AbuseDetectionResult> {
  const now = new Date();
  const startDate = getWIBDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const endDate = getWIBDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const records = await db.select().from(attendances)
    .where(and(
      eq(attendances.employeeId, employeeId),
      gte(attendances.date, startDate),
      lte(attendances.date, endDate)
    ));

  const totalOvertime = records.reduce((sum, a) => sum + parseFloat(a.overtimeHours || '0'), 0);

  if (totalOvertime > maxOvertimeHours) {
    await db.insert(abuseLogs).values({
      employeeId,
      abuseType: 'abnormal_overtime',
      description: `Total overtime ${totalOvertime.toFixed(1)} hours exceeds limit of ${maxOvertimeHours} hours`,
      severity: 'medium',
    });

    return {
      detected: true,
      type: 'abnormal_overtime',
      severity: 'medium',
      description: 'Abnormal overtime pattern detected',
    };
  }

  return { detected: false };
}
