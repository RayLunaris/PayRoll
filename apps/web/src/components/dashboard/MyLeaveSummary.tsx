'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus, Clock, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

interface LeaveQuota {
  leaveType: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota?: number;
}

interface LeaveRequest {
  id: string;
  leaveType: string;
  status: string;
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Cuti Sakit',
  maternity: 'Cuti Melahirkan',
  paternity: 'Cuti Ayah',
  unpaid: 'Cuti Tanpa Gaji',
};

export default function MyLeaveSummary() {
  const [quotas, setQuotas] = useState<LeaveQuota[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const [quotaRes, histRes] = await Promise.all([
          api.get('/leaves/quota').catch(() => ({ data: { data: [] } })),
          api.get('/leaves/history').catch(() => ({ data: { data: [] } })),
        ]);

        if (!active) return;
        const qList: LeaveQuota[] = Array.isArray(quotaRes.data?.data) ? quotaRes.data.data : [];
        setQuotas(qList);

        const hList: LeaveRequest[] = Array.isArray(histRes.data?.data) ? histRes.data.data : [];
        const pending = hList.filter((item) => item.status === 'pending').length;
        setPendingCount(pending);
      } catch (err) {
        console.error('Failed to load leave summary:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const annualQuota = quotas.find((q) => q.leaveType === 'annual');
  const annualTotal = annualQuota?.totalQuota ?? 12;
  const annualUsed = annualQuota?.usedQuota ?? 0;
  const annualRemaining = annualQuota?.remainingQuota ?? Math.max(0, annualTotal - annualUsed);

  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Ringkasan Cuti Saya</h3>
              <p className="text-xs text-gray-500">Tahun berjalan {new Date().getFullYear()}</p>
            </div>
          </div>
          <Link
            href="/leave/request"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajukan Cuti</span>
          </Link>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2.5 my-2">
            <div className="h-16 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded w-full" />
          </div>
        ) : (
          <div className="space-y-2.5 my-2">
            {/* Annual Leave highlight */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-800">Cuti Tahunan</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-blue-600">{annualRemaining}</span>
                  <span className="text-xs text-gray-500 ml-1">/ {annualTotal} hari tersisa</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, (annualRemaining / (annualTotal || 1)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-1 border-t border-gray-100">
                <span>Terpakai: <strong className="text-gray-700 font-semibold">{annualUsed}</strong> hari</span>
                <span>Total Hak Cuti: <strong className="text-gray-700 font-semibold">{annualTotal}</strong> hari</span>
              </div>
            </div>

            {/* Other Quotas */}
            {quotas.filter((q) => q.leaveType !== 'annual').length > 0 && (
              <div
                className={`grid ${
                  quotas.filter((q) => q.leaveType !== 'annual').length <= 3
                    ? 'grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-4'
                } gap-2 text-xs`}
              >
                {quotas
                  .filter((q) => q.leaveType !== 'annual')
                  .slice(0, 4)
                  .map((q) => {
                    const label = leaveTypeLabels[q.leaveType] || q.leaveType;
                    const remaining = q.remainingQuota ?? Math.max(0, q.totalQuota - q.usedQuota);
                    return (
                      <div
                        key={q.leaveType}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100/70 transition-colors rounded-lg border border-gray-100 flex flex-col justify-between"
                      >
                        <p className="text-[11px] font-medium text-gray-500 truncate" title={label}>
                          {label}
                        </p>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {remaining} <span className="text-[10px] font-normal text-gray-500">hari</span>
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-2.5 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        {pendingCount > 0 ? (
          <span className="text-amber-600 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {pendingCount} pengajuan menunggu persetujuan
          </span>
        ) : (
          <span className="text-gray-400">Tidak ada pengajuan cuti yang tertunda</span>
        )}
        <Link
          href="/leave/history"
          className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 hover:underline"
        >
          <span>Detail</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
