import { redirect } from 'next/navigation';

export default function AttendanceRootPage() {
  redirect('/attendance/check-in');
}
