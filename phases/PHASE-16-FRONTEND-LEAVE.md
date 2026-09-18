# Phase 16: Frontend Leave

**Objective:** Implementasi pengajuan cuti, riwayat, kuota, dan approval  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 15 selesai

---

## Tasks

### 16.1 Create Leave Request Page

```bash
# src/app/(dashboard)/leave/request/page.tsx
cat > src/app/(dashboard)/leave/request/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { CalendarDays, Paperclip, CheckCircle, XCircle } from 'lucide-react';

const leaveSchema = z.object({
  leaveType: z.enum(['annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid']),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  reason: z.string().min(10, 'Alasan minimal 10 karakter'),
});

type LeaveForm = z.infer<typeof leaveSchema>;

const leaveTypes = [
  { value: 'annual', label: 'Cuti Tahunan', quota: 12 },
  { value: 'sick', label: 'Cuti Sakit', quota: 12 },
  { value: 'maternity', label: 'Cuti Melahirkan', quota: 90 },
  { value: 'paternity', label: 'Cuti Ayah', quota: 3 },
  { value: 'special', label: 'Cuti Khusus', quota: 0 },
  { value: 'unpaid', label: 'Cuti Tanpa Gaji', quota: 0 },
];

export default function LeaveRequestPage() {
  const [quota, setQuota] = useState<Record<string, any>>({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
  });

  const selectedType = watch('leaveType');
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    fetchQuota();
  }, []);

  const fetchQuota = async () => {
    try {
      const response = await api.get('/api/leaves/quota');
      const quotas = response.data.data;
      const quotaMap = {};
      quotas.forEach((q) => {
        quotaMap[q.leaveType] = q;
      });
      setQuota(quotaMap);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startD = new Date(start);
    const endD = new Date(end);
    return Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const days = calculateDays(startDate, endDate);
  const selectedQuota = selectedType ? quota[selectedType] : null;
  const available = selectedQuota ? selectedQuota.totalQuota - selectedQuota.usedQuota : 0;

  const onSubmit = async (data: LeaveForm) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/leaves', data);
      setSuccess('Pengajuan cuti berhasil dikirim! Menunggu persetujuan manager.');
      
      // Reset form
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Terjadi kesalahan saat mengajukan cuti.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pengajuan Cuti</h1>
        <p className="text-gray-500 mt-1">Ajukan cuti dan lanjutkan melalui smartphone</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 card">
          {success && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-emerald-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Berhasil</p>
                <p className="text-xs text-emerald-600 mt-1">{success}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Tipe Cuti</label>
              <select {...register('leaveType')} className="input">
                <option value="">Pilih tipe cuti</option>
                {leaveTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.leaveType && (
                <p className="mt-1 text-sm text-red-600">{errors.leaveType.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tanggal Mulai</label>
                <input type="date" {...register('startDate')} className="input" />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="label">Tanggal Selesai</label>
                <input type="date" {...register('endDate')} className="input" />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Alasan</label>
              <textarea
                {...register('reason')}
                rows={4}
                className="input"
                placeholder="Jelaskan alasan pengajuan cuti..."
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            <div>
              <label className="label">Lampiran (Opsional)</label>
              <div className="flex items-center justify-center w-full">
                <label className="w-full flex flex-col items-center px-4 py-6 bg-gray-50 text-gray-400 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors">
                  <Paperclip className="h-8 w-8 mb-2" />
                  <span className="text-sm">Upload surat dokumen pendukung</span>
                  <span className="text-xs">PDF, JPG, PNG (maks 5MB)</span>
                  <input type="file" className="hidden" />
                </label>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full !py-3">
              {loading ? 'Mengirim...' : 'Kirim Pengajuan Cuti'}
            </button>
          </form>
        </div>

        {/* Quota info */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            <CalendarDays className="h-5 w-5 inline-block mr-2 text-blue-600" />
            Kuota Cuti 2024
          </h3>

          <div className="space-y-3">
            {leaveTypes.map((type) => {
              const q = quota[type.value];
              const remaining = q ? q.totalQuota - q.usedQuota : (type.quota || 0);
              const percentage = q ? (q.usedQuota / q.totalQuota) * 100 : 0;

              if (type.value === 'special' || type.value === 'unpaid') {
                return null;
              }

              return (
                <div key={type.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{type.label}</span>
                    <span className="text-xs font-medium text-gray-500">
                      {remaining}/{q?.totalQuota || type.quota} hari
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {days > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-blue-700">Total hari cuti</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{days} hari</p>
                {selectedQuota && (
                  <p className={`text-xs mt-2 ${days > available ? 'text-red-600' : 'text-blue-600'}`}>
                    {days > available 
                      ? `Kuota tidak cukup! Tersisa ${available} hari` 
                      : `Sisa kuota setelah pengajuan: ${available - days} hari`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
EOF
```

### 16.2 Create Leave History Page

```bash
# src/app/(dashboard)/leave/history/page.tsx
cat > src/app/(dashboard)/leave/history/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';

interface Leave {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Cuti Sakit',
  maternity: 'Cuti Melahirkan',
  paternity: 'Cuti Ayah',
  special: 'Cuti Khusus',
  unpaid: 'Cuti Tanpa Gaji',
};

const statusBadges: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'badge badge-yellow' },
  approved: { label: 'Disetujui', className: 'badge badge-green' },
  rejected: { label: 'Ditolak', className: 'badge badge-red' },
};

export default function LeaveHistoryPage() {
  const [history, setHistory] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/leaves/history');
      setHistory(response.data.data);
    } catch (error) {
      console.error('Failed to fetch leave history:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    return Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Cuti</h1>
        <p className="text-gray-500 mt-1">Semua pengajuan cuti Anda</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Jenis Cuti</th>
                  <th>Tanggal</th>
                  <th>Durasi</th>
                  <th>Alasan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((leave) => (
                  <tr key={leave.id}>
                    <td className="font-medium">{leaveTypeLabels[leave.leaveType]}</td>
                    <td>
                      {new Date(leave.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' - '}
                      {new Date(leave.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>{calculateDays(leave.startDate, leave.endDate)} hari</td>
                    <td className="max-w-xs truncate">{leave.reason}</td>
                    <td>
                      <span className={statusBadges[leave.status].className}>
                        {statusBadges[leave.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Belum ada pengajuan cuti
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

### 16.3 Create Leave Approval Page (Manager)

```bash
# src/app/(dashboard)/leave/approvals/page.tsx
cat > src/app/(dashboard)/leave/approvals/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Check, X, Clock } from 'lucide-react';

interface LeaveRequest extends Leave {
  employeeName: string;
}

export default function LeaveApprovalsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !['hr_admin', 'manager', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
    fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/api/leaves/approvals');
      setRequests(response.data.data);
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id: string, approved: boolean) => {
    try {
      const response = await api.put(`/api/leaves/${id}/approve`, { approved });
      // Refresh
      fetchRequests();
    } catch (error) {
      console.error('Failed to process leave decision:', error);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Persetujuan Cuti</h1>
        <p className="text-gray-500 mt-1">Pengajuan cuti yang menunggu persetujuan</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{request.employeeName || 'Karyawan'}</p>
                    <p className="text-sm text-gray-500">{request.leaveType}</p>
                  </div>
                  <span className="badge badge-yellow">
                    <Clock className="h-3 w-3 mr-1" />
                    Menunggu
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1 mb-3">
                  <p>📅 {new Date(request.startDate).toLocaleDateString('id-ID')} - {new Date(request.endDate).toLocaleDateString('id-ID')}</p>
                  <p>📝 {request.reason}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(request.id, true)}
                    className="btn btn-success flex-1 !py-1.5"
                  >
                    <Check className="h-4 w-4" />
                    Setujui
                  </button>
                  <button
                    onClick={() => handleDecision(request.id, false)}
                    className="btn btn-danger flex-1 !py-1.5"
                  >
                    <X className="h-4 w-4" />
                    Tolak
                  </button>
                </div>
              </div>
            ))}

            {requests.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                Tidak ada pengajuan cuti yang menunggu
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [x] Form pengajuan cuti berfungsi
- [x] Validasi form bekerja
- [x] Kuota ditampilkan dan diperiksa
- [x] Riwayat cuti ditampilkan
- [x] Status badge ditampilkan
- [x] Manager dapat approve/reject
- [x] Data ter-refresh setelah aksi

---

## Next Phase

Setelah Phase 16 selesai, lanjut ke:
**[Phase 17: Frontend Payroll](./PHASE-17-FRONTEND-PAYROLL.md)**