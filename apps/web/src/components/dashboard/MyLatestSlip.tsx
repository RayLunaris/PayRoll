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
    <div className="bg-white rounded-xl shadow-card p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Slip Gaji Terbaru</h3>
              <p className="text-xs text-gray-500">Take-home pay & rincian pendapatan</p>
            </div>
          </div>
          {latestSlip ? (
            getStatusBadge(latestSlip.status)
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3" />
              Periode Berjalan
            </span>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2.5 my-2">
            <div className="h-16 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded w-full" />
          </div>
        ) : latestSlip ? (
          <div className="space-y-2.5 my-2">
            <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">
                  Periode {MONTH_NAMES[latestSlip.periodMonth] || latestSlip.periodMonth} {latestSlip.periodYear}
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-200">
                  Gaji Bersih
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">
                {formatRupiah(latestSlip.netSalary)}
              </p>
              <p className="text-xs text-gray-500 pt-0.5">
                Ditransfer ke rekening terdaftar
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[11px] text-gray-500">Status Transfer</p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">Selesai Dibayar</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[11px] text-gray-500">Dokumen Slip</p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">PDF Digital Resmi</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 my-2">
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Menunggu Kalkulasi Tim Payroll
                </p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Slip periode berjalan belum diterbitkan atau sedang dalam tahap validasi jam kerja & rekap lembur.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Alur Siklus Penggajian
                </span>
                <span className="text-[10px] text-gray-400">Estimasi akhir bulan</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1 rounded bg-white border border-gray-150">
                  <span className="block text-gray-400">1. Presensi</span>
                  <span className="text-emerald-600 font-semibold">Tercatat</span>
                </div>
                <div className="p-1 rounded bg-blue-50/70 border border-blue-200/60">
                  <span className="block text-blue-700">2. Review HR</span>
                  <span className="text-blue-700 font-semibold">Proses</span>
                </div>
                <div className="p-1 rounded bg-white border border-gray-150">
                  <span className="block text-gray-400">3. Terbit</span>
                  <span className="text-gray-400 font-semibold">Menunggu</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2.5 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500">Histori & unduh arsip PDF</span>
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
