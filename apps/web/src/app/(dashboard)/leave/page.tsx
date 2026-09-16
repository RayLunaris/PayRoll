import { redirect } from 'next/navigation';

export default function LeaveRootPage() {
  redirect('/leave/request');
}
