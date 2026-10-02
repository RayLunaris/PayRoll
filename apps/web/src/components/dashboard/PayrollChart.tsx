'use client';

import { useEffect, useState, memo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import api from '@/lib/api';
import { Wallet } from 'lucide-react';
import { formatRupiahNumber } from '@/lib/formatCurrency';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface CompositionItem {
  name: string;
  value: number;
}

interface BudgetInfo {
  hasBudget: boolean;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercentage: number;
  status: 'unavailable' | 'exceeded' | 'warning' | 'on_track';
}

export default memo(function PayrollChart() {
  const [data, setData] = useState<CompositionItem[]>([]);
  const [periodInfo, setPeriodInfo] = useState<string>('');
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await api.get('/payrolls/composition?month=9&year=2027');
        if (active && res.data?.data) {
          const { composition, periodMonth, periodYear, budget: budgetInfo } = res.data.data;
          if (Array.isArray(composition)) {
            setData(composition);
          }
          if (periodMonth && periodYear) {
            setPeriodInfo(`Periode: ${periodMonth}/${periodYear}`);
          }
          setBudget(budgetInfo ?? null);
        }
      } catch (err) {
        console.error('Failed to load payroll composition:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Komposisi Payroll
          </h3>
          {periodInfo && (
            <p className="text-xs text-gray-500">{periodInfo}</p>
          )}
        </div>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Memuat...</span>
        )}
      </div>

      <div className="h-56">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-50/50 rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50/60 px-5 text-center">
            <p className="text-sm font-semibold text-red-800">Data payroll belum dapat dimuat</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-red-700">
              Layanan payroll sedang tidak terhubung. Coba muat ulang setelah service aktif.
            </p>
          </div>
        ) : totalValue === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-4 bg-gray-50/50 rounded-lg">
            <Wallet className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-600">Belum ada data payroll</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Grafik akan terisi otomatis saat payroll periode ini telah diproses
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && !error && totalValue > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3">
          {data.map((item, index) => (
            <div key={item.name} className="flex min-w-0 items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-gray-600">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-gray-900">
                {formatRupiahNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {budget && (
        <div className="mt-4 border-t border-gray-100 pt-4" aria-label="Realisasi anggaran payroll">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Anggaran payroll</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {budget.hasBudget ? formatRupiahNumber(budget.spentAmount) : 'Belum tersedia'}
                {budget.hasBudget && <span className="font-normal text-gray-400"> / {formatRupiahNumber(budget.allocatedAmount)}</span>}
              </p>
            </div>
            <span className={`text-xs font-medium ${
              budget.status === 'exceeded' ? 'text-red-600' :
              budget.status === 'warning' ? 'text-amber-600' :
              budget.status === 'on_track' ? 'text-emerald-600' : 'text-gray-500'
            }`}>
              {budget.status === 'exceeded' ? 'Melebihi pagu' :
               budget.status === 'warning' ? 'Mendekati pagu' :
               budget.status === 'on_track' ? `${budget.usagePercentage}% terpakai` : 'Belum diatur'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, budget.usagePercentage)} aria-label="Persentase pemakaian anggaran">
            <div
              className={`h-full rounded-full transition-all ${budget.status === 'exceeded' ? 'bg-red-500' : budget.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, budget.usagePercentage))}%` }}
            />
          </div>
          {budget.hasBudget && (
            <p className="mt-2 text-xs text-gray-500">
              Sisa anggaran {formatRupiahNumber(budget.remainingAmount)}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
