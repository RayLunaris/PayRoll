import { redirect } from 'next/navigation';

export default function PayrollRootPage() {
  redirect('/payroll/slips');
}