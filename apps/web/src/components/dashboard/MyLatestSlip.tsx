'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import api from '@/lib/api';

interface PayrollRecord {
  id: string;
  periodMonth: number;
  periodYear: number;
  netSalary: string | number;
  status: 'draft' | 'processed' | 'approved' | 'paid' | string;
  createdAt: string;
}

const MONTH_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatRupiah(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export default function MyLatestSlip() {
  const [latestSlip, setLatestSlip] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const res = await api.get('/payrolls/my');
        if (active && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          // Find the latest processed/approved/paid slip
          const processedSlips = res.data.data.filter((p: PayrollRecord) =>
            ['paid', 'approved', 'processed'].includes(p.status)
          );
          if (processedSlips.length > 0) {
            setLatestSlip(processedSlips[0]);
          } else {
            setLatestSlip(null);
          }
        }
      } catch (err) {
        console.error('Failed to load latest payroll slip:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Dibayarkan
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" />
            Disetujui
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
            <Clock className="w-3 h-3" />
            Diproses
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Slip Gaji Terbaru</h3>
              <p className="text-xs text-gray-500">Take-home pay & rincian pendapatan</p>
            </div>
          </div>
          {latestSlip && getStatusBadge(latestSlip.status)}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3 my-4">
            <div className="h-6 bg-gray-100 rounded w-1/3" />
            <div className="h-10 bg-gray-100 rounded w-2/3" />
          </div>
        ) : latestSlip ? (
          <div className="my-3 p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <p className="text-xs text-gray-500 font-medium">
              Periode {MONTH_NAMES[latestSlip.periodMonth] || latestSlip.periodMonth} {latestSlip.periodYear}
            </p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {formatRupiah(latestSlip.netSalary)}
            </p>
            <p className="text-xs text-gray-500 pt-1">
              Gaji bersih yang ditransfer ke rekening Anda
            </p>
          </div>
        ) : (
          <div className="my-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Menunggu diproses HR
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Slip gaji untuk periode berjalan belum diterbitkan atau sedang dalam tahap kalkulasi tim payroll.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500">Histori & download PDF</span>
        <Link
          href="/payroll/slips"
          className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 hover:underline"
        >
          <span>Buka Slip Gaji</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
