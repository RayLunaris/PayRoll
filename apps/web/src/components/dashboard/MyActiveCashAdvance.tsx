'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, ArrowRight, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface CashAdvanceRecord {
  id: string;
  amount: string | number;
  monthlyDeduction?: string | number;
  repaymentMonths?: number;
  remainingAmount?: string | number;
  status: 'pending' | 'approved' | 'rejected' | 'repaid' | 'cancelled' | string;
  reason?: string;
  createdAt: string;
}

function formatRupiah(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export default function MyActiveCashAdvance({
  onStatusLoaded,
}: {
  onStatusLoaded?: (hasData: boolean) => void;
}) {
  const [activeAdvance, setActiveAdvance] = useState<CashAdvanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const res = await api.get('/cash-advances/history');
        if (active && Array.isArray(res.data?.data)) {
          // An active cash advance is one that is 'approved' (in progress of repayment)
          const activeItem = res.data.data.find(
            (ca: CashAdvanceRecord) => ca.status === 'approved'
          );
          setActiveAdvance(activeItem || null);
          onStatusLoaded?.(Boolean(activeItem));
        } else {
          onStatusLoaded?.(false);
        }
      } catch (err) {
        console.error('Failed to load active cash advance:', err);
        if (active) onStatusLoaded?.(false);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [onStatusLoaded]);

  // Strict Rule: If not loading and no active cash advance exists, return null so nothing renders in DOM
  if (!loading && !activeAdvance) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-card p-5 animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-1/3 mb-4" />
        <div className="h-10 bg-gray-100 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex flex-col justify-between border-l-4 border-l-amber-500">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Kasbon Aktif</h3>
              <p className="text-xs text-gray-500">Cicilan berjalan melalui potongan gaji</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
            Aktif
          </span>
        </div>

        {activeAdvance && (
          <div className="my-2 p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-2">
            <div>
              <span className="text-xs text-gray-500 font-medium">Total Pinjaman</span>
              <p className="text-xl font-bold text-gray-900">
                {formatRupiah(activeAdvance.amount)}
              </p>
            </div>
            {activeAdvance.monthlyDeduction && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/50 text-gray-600">
                <span>Potongan Bulanan:</span>
                <span className="font-semibold text-gray-800">
                  {formatRupiah(activeAdvance.monthlyDeduction)} / bln
                </span>
              </div>
            )}
            {activeAdvance.repaymentMonths && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Tenor:</span>
                <span className="font-semibold text-gray-800">
                  {activeAdvance.repaymentMonths} bulan
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          Dipotong otomatis dari slip gaji
        </span>
        <Link
          href="/payroll/cash-advances"
          className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1 hover:underline"
        >
          <span>Detail</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
