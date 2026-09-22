export type ActivityType =
  | 'attendance_check_in'
  | 'attendance_check_out'
  | 'leave_approved'
  | 'leave_rejected';

export interface ActivityItem {
  id: string;              // unik lintas-service: `${sourceService}:${originalId}`
  type: ActivityType;
  title: string;            // "Presensi masuk", "Cuti disetujui", dst
  description: string;      // "Sukamaju check-in di Kantor Pusat", dst
  employeeId: string;
  employeeName: string;
  timestamp: string;        // ISO 8601, dipakai untuk sorting
  sourceService: 'attendance-service' | 'leave-service';
}
