'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ShiftTabs from '@/components/shift/ShiftTabs';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { CalendarCheck, Save, Info } from 'lucide-react';

const assignSchema = z.object({
  employeeId: z.string().uuid('Pilih karyawan'),
  shiftId: z.string().uuid('Pilih shift'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal dengan benar'),
});

type AssignForm = z.infer<typeof assignSchema>;

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  isActive: boolean;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

function formatTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

const ADMIN_ROLES = ['manager', 'hr_admin', 'super_admin'];

export default function ShiftAssignPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
  });

  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const [empRes, shiftRes] = await Promise.all([
          api.get<{ data: Employee[] }>('/employees?page=1&limit=100'),
          api.get<{ data: Shift[] }>('/shifts'),
        ]);
        setEmployees(empRes.data.data || []);
        setShifts(shiftRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router, isAdmin]);

  const onSubmit = async (data: AssignForm) => {
    if (!isAdmin) return;
    setSaving(true);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.post('/shifts/assign', data);
      setSuccessMessage(
        'Shift berhasil ditugaskan. Penugasan pada tanggal dan karyawan yang sama akan diperbarui.',
      );
      reset({ employeeId: data.employeeId, shiftId: data.shiftId, date: '' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setFormError(
        axiosErr.response?.data?.error || 'Gagal menugaskan shift',
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = (hasError: boolean) =>
    `${hasError ? 'border-red-500' : ''} input`;

  return (
    <div>
      <Breadcrumb />
      <ShiftTabs />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <CalendarCheck className="h-6 w-6 text-blue-600" />
            Penugasan Shift
          </h1>
          <p className="text-gray-500 mt-1">
            Tugaskan shift ke karyawan pada tanggal tertentu
          </p>
        </div>
      </div>

      <div className="card mb-6 bg-blue-50">
        <div className="flex items-start gap-3 text-blue-700 text-sm">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p>
              Minimal jeda antar shift adalah <strong>11 jam</strong> (aturan
              istirahat). Penugasan ke tanggal yang sama akan memperbarui shift
              karyawan tersebut.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {formError && !successMessage && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="employeeId" className="label">
              Karyawan
            </label>
            <select
              id="employeeId"
              {...register('employeeId')}
              className={inputClasses(!!errors.employeeId)}
            >
              <option value="">Pilih karyawan</option>
              {employees
                .filter((e) => e.isActive)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.nip})
                  </option>
                ))}
            </select>
            {errors.employeeId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.employeeId.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="shiftId" className="label">
              Shift
            </label>
            <select
              id="shiftId"
              {...register('shiftId')}
              className={inputClasses(!!errors.shiftId)}
            >
              <option value="">Pilih shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})
                </option>
              ))}
            </select>
            {errors.shiftId && (
              <p className="mt-1 text-sm text-red-600">
                {errors.shiftId.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="date" className="label">
              Tanggal
            </label>
            <input
              id="date"
              type="date"
              {...register('date')}
              className={inputClasses(!!errors.date)}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving || loading}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Tugaskan Shift'}
          </button>
        </div>
      </form>
    </div>
  );
}