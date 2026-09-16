'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import type { LeaveType, LeaveQuota } from '@/types';
import { CalendarDays, Info, Calendar } from 'lucide-react';

interface LeaveTypeDisplay {
  type: LeaveType;
  label: string;
  description: string;
  defaultQuota: number;
}

const LEAVE_TYPES_INFO: LeaveTypeDisplay[] = [
  {
    type: 'annual',
    label: 'Cuti Tahunan',
    description: 'Hak cuti tahunan berbayar untuk setiap karyawan.',
    defaultQuota: 12,
  },
  {
    type: 'sick',
    label: 'Cuti Sakit',
    description: 'Cuti untuk pemulihan kesehatan dengan surat keterangan dokter.',
    defaultQuota: 12,
  },
  {
    type: 'maternity',
    label: 'Cuti Melahirkan',
    description: 'Cuti persalinan bagi karyawan wanita.',
    defaultQuota: 90,
  },
  {
    type: 'paternity',
    label: 'Cuti Ayah',
    description: 'Cuti pendampingan kelahiran bagi karyawan pria.',
    defaultQuota: 3,
  },
  {
    type: 'special',
    label: 'Cuti Khusus',
    description: 'Cuti acara penting keluarga (pernikahan, kedukaan, dll).',
    defaultQuota: 0,
  },
  {
    type: 'unpaid',
    label: 'Cuti Tanpa Gaji',
    description: 'Cuti di luar tanggungan perusahaan.',
    defaultQuota: 0,
  },
];

export default function LeaveQuotaPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [quotas, setQuotas] = useState<Record<string, LeaveQuota>>({});
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async (selectedYear: number) => {
    setLoading(true);
    try {
      const response = await api.get<{ data: LeaveQuota[] }>(
        `/leaves/quota?year=${selectedYear}`,
      );
      if (response.data.data) {
        const map: Record<string, LeaveQuota> = {};
        response.data.data.forEach((q) => {
          map[q.leaveType] = q;
        });
        setQuotas(map);
      }
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchQuota(year);
    })();
  }, [fetchQuota, year]);

  return (
    <div>
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kuota Cuti</h1>
          <p className="text-gray-500 mt-1">
            Informasi jatah dan penggunaan cuti Anda pada tahun {year}
          </p>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <label htmlFor="yearSelect" className="text-sm font-medium text-gray-700">
            Tahun:
          </label>
          <select
            id="yearSelect"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="input w-32"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEAVE_TYPES_INFO.map((item) => {
            const q = quotas[item.type];
            const isUnlimited = item.type === 'special' || item.type === 'unpaid';
            const total = q?.totalQuota ?? item.defaultQuota;
            const used = q?.usedQuota ?? 0;
            const remaining = isUnlimited ? null : Math.max(0, total - used);
            const percentage = !isUnlimited && total > 0 ? Math.min(100, (used / total) * 100) : 0;

            return (
              <div
                key={item.type}
                className="card flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-blue-600" />
                      {item.label}
                    </h3>
                    <span className="badge badge-info text-xs">
                      {isUnlimited ? 'Fleksibel' : `${total} Hari/Tahun`}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-6">{item.description}</p>

                  {isUnlimited ? (
                    <div className="p-4 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">Penggunaan Tercatat</p>
                      <p className="text-2xl font-bold text-gray-800">{used} hari</p>
                      <p className="text-xs text-gray-500 mt-1">Sesuai persetujuan atasan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 bg-emerald-50 rounded-lg">
                          <p className="text-xs font-medium text-emerald-700">Tersisa</p>
                          <p className="text-2xl font-bold text-emerald-900 mt-0.5">
                            {remaining}
                          </p>
                          <p className="text-xs text-emerald-600">hari</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium text-gray-600">Terpakai</p>
                          <p className="text-2xl font-bold text-gray-800 mt-0.5">
                            {used}
                          </p>
                          <p className="text-xs text-gray-500">hari</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Persentase Penggunaan</span>
                          <span className="font-semibold">{Math.round(percentage)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              percentage > 80
                                ? 'bg-red-500'
                                : percentage > 50
                                  ? 'bg-yellow-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>Periode tahun anggaran {year}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
