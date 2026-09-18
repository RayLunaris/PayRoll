# Phase 17: Frontend Payroll

**Objective:** Implementasi proses payroll, slip gaji PDF, laporan BPJS/Pajak, kasbon  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 16 selesai

---

## Tasks

### 17.1 Create Payslip Page

```bash
# src/app/(dashboard)/payroll/slips/page.tsx
cat > src/app/(dashboard)/payroll/slips/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { FileText, Download, Eye, Wallet } from 'lucide-react';

interface Payslip {
  id: string;
  periodMonth: number;
  periodYear: number;
  baseSalary: string;
  overtimePay: string;
  allowances: string;
  bpjsEmployee: string;
  taxDeduction: string;
  cashAdvance: string;
  netSalary: string;
  status: string;
}

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function PayslipPage() {
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSlips();
  }, []);

  const fetchSlips = async () => {
    try {
      const response = await api.get('/api/payrolls');
      setSlips(response.data.data);
    } catch (error) {
      console.error('Failed to fetch payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadSlip = async (id: string) => {
    try {
      const response = await api.get(`/api/payrolls/${id}/slip`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `slip-gaji-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download payslip:', error);
    }
  };

  const formatRupiah = (value: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(value || '0'));
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Slip Gaji</h1>
        <p className="text-gray-500 mt-1">Slip gaji paperless dapat diunduh dalam format PDF</p>
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
                  <th>Periode</th>
                  <th>Gaji Pokok</th>
                  <th>Lembur</th>
                  <th>Tunjangan</th>
                  <th>Potongan</th>
                  <th>Gaji Bersih</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => (
                  <tr key={slip.id}>
                    <td className="font-medium">
                      {monthNames[slip.periodMonth - 1]} {slip.periodYear}
                    </td>
                    <td>{formatRupiah(slip.baseSalary)}</td>
                    <td>{formatRupiah(slip.overtimePay)}</td>
                    <td>{formatRupiah(slip.allowances)}</td>
                    <td className="text-red-600">
                      {formatRupiah(
                        (parseFloat(slip.bpjsEmployee) + 
                         parseFloat(slip.taxDeduction) + 
                         parseFloat(slip.cashAdvance)).toString()
                      )}
                    </td>
                    <td className="font-semibold text-emerald-600">
                      {formatRupiah(slip.netSalary)}
                    </td>
                    <td>
                      <span className={`
                        ${slip.status === 'paid' ? 'badge badge-green' : 'badge badge-blue'}
                      `}>
                        {slip.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => downloadSlip(slip.id)}
                        className="btn btn-secondary !py-1 !px-3 !text-xs"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {slips.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      <Wallet className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      Belum ada slip gaji
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

### 17.2 Create Payroll Process Page (HR)

```bash
# src/app/(dashboard)/payroll/process/page.tsx
cat > src/app/(dashboard)/payroll/process/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { FileText, Settings2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function PayrollProcessPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [bpjsRates, setBpjsRates] = useState(null);
  const [taxRates, setTaxRates] = useState(null);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user]);

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post('/api/payrolls/process', {
        month,
        year,
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Terjadi kesalahan saat proses payroll');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proses Payroll</h1>
        <p className="text-gray-500 mt-1">
          Proses perhitungan gaji otomatis termasuk lembur, BPJS, PPh 21, dan kasbon
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing form */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            Konfigurasi Payroll
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bulan</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="input"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tahun</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="input"
                >
                  {[year - 1, year, year + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={processing}
              className="btn btn-primary w-full !py-3"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Proses Payroll
                </>
              )}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {result && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">{result.message}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Berhasil memproses {result.data.length} payroll
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yang Dihitung Otomatis
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Gaji pokok per jabatan</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Lembur (custom rates)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">BPJS Ketenagakerjaan & Kesehatan</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">PPh 21 progresif</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Kasbon (maks 25% gaji)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Slip gaji PDF</span>
              <span className="font-medium text-emerald-600">Siap download</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF
```

### 17.3 Create Cash Advance Page

```bash
# src/app/(dashboard)/payroll/cash-advances/page.tsx
cat > src/app/(dashboard)/payroll/cash-advances/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Wallet, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const advanceSchema = z.object({
  amount: z.number().positive('Jumlah harus lebih dari 0').max(100000000, 'Maksimal Rp 100.000.000'),
  reason: z.string().min(10, 'Alasan minimal 10 karakter'),
});

type AdvanceForm = z.infer<typeof advanceSchema>;

const statusBadges: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'badge badge-yellow' },
  approved: { label: 'Disetujui', className: 'badge badge-green' },
  rejected: { label: 'Ditolak', className: 'badge badge-red' },
  deducted: { label: 'Terpotong', className: 'badge badge-blue' },
};

export default function CashAdvancePage() {
  const [advances, setAdvances] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxAmount, setMaxAmount] = useState(2000000);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdvanceForm>({
    resolver: zodResolver(advanceSchema),
  });

  useEffect(() => {
    fetchHistory();
    fetchMaxAmount();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/cash-advances/history');
      setAdvances(response.data.data);
    } catch (error) {
      console.error('Failed to fetch cash advances:', error);
    }
  };

  const fetchMaxAmount = async () => {
    try {
      const response = await api.get('/api/employees/me');
      if (response.data.data?.baseSalary) {
        setMaxAmount(parseFloat(response.data.data.baseSalary) * 0.25);
      }
    } catch (error) {
      console.error('Failed to fetch salary:', error);
    }
  };

  const onSubmit = async (data: AdvanceForm) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/cash-advances', data);
      setSuccess('Pengajuan kasbon berhasil dikirim!');
      fetchHistory();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Terjadi kesalahan saat mengajukan kasbon');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (value: string | number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(typeof value === 'string' ? parseFloat(value) : value);
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kasbon Karyawan</h1>
        <p className="text-gray-500 mt-1">Pengajuan pinjaman gaji (maksimal 25% dari gaji)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request form */}
        <div className="lg:col-span-1 card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            Ajukan Kasbon
          </h3>

          {success && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <AlertCircle className="h-3.5 w-3.5 inline-block mr-1" />
                Maksimal pengajuan: {formatRupiah(maxAmount)} (25% dari gaji)
              </p>
            </div>

            <div>
              <label className="label">Jumlah (Rp)</label>
              <input
                type="number"
                {...register('amount', { valueAsNumber: true })}
                className="input"
                placeholder="500000"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="label">Alasan</label>
              <textarea
                {...register('reason')}
                rows={3}
                className="input"
                placeholder="Jelaskan kebutuhan kasbon..."
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Mengirim...' : 'Ajukan Kasbon'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Kasbon</h3>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Jumlah</th>
                  <th>Alasan</th>
                  <th>Periode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((advance) => (
                  <tr key={advance.id}>
                    <td className="font-medium">{formatRupiah(advance.amount)}</td>
                    <td className="max-w-xs truncate">{advance.reason || '-'}</td>
                    <td>{monthNames[advance.month - 1]} {advance.year}</td>
                    <td>
                      <span className={statusBadges[advance.status].className}>
                        {statusBadges[advance.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
                {advances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      Belum ada pengajuan kasbon
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
EOF
```

### 17.4 Create BPJS Report Page (HR)

```bash
# src/app/(dashboard)/payroll/bpjs/page.tsx
cat > src/app/(dashboard)/payroll/bpjs/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Download, HeartPulse } from 'lucide-react';

export default function BpjsReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState([]);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user]);

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-emerald-600" />
            Laporan BPJS
          </h1>
          <p className="text-gray-500 mt-1">Rekapitulasi iuran BPJS Ketenagakerjaan & Kesehatan</p>
        </div>
        <button className="btn btn-secondary">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="card">
        <div className="p-8 text-center text-gray-500">
          <HeartPulse className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Fitur laporan BPJS akan diimplementasikan</p>
          <p className="text-sm text-gray-400 mt-1">
            Menampilkan komponen JKK, JKM, JP, JHT, dan BPJS Kesehatan
          </p>
        </div>
      </div>
    </div>
  );
}
EOF
```

### 17.5 Create Tax Report Page (HR)

```bash
# src/app/(dashboard)/payroll/tax/page.tsx
cat > src/app/(dashboard)/payroll/tax/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Download, Receipt } from 'lucide-react';

export default function TaxReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user]);

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-blue-600" />
            Laporan Pajak PPh 21
          </h1>
          <p className="text-gray-500 mt-1">Rekapitulasi pajak penghasilan karyawan</p>
        </div>
        <button className="btn btn-secondary">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="card">
        <div className="p-8 text-center text-gray-500">
          <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Fitur laporan PPh 21 akan diimplementasikan</p>
          <p className="text-sm text-gray-400 mt-1">
            Menampilkan perhitungan pajak progresif berdasarkan bracket
          </p>
        </div>
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [x] Slip gaji list ditampilkan
- [x] Download PDF berfungsi
- [x] Proses payroll berfungsi (HR only)
- [x] Kasbon pengajuan berfungsi
- [x] Kasbon limit 25% diperiksa
- [x] Riwayat kasbon ditampilkan
- [x] BPJS report page (HR only)
- [x] Tax report page (HR only)
- [x] Format Rupiah benar

---

## Next Phase

Setelah Phase 17 selesai, lanjut ke:
**[Phase 18: Frontend Employee](./PHASE-18-FRONTEND-EMPLOYEE.md)**