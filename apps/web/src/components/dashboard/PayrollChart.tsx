'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import api from '@/lib/api';
import { Wallet } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface CompositionItem {
  name: string;
  value: number;
}

export default function PayrollChart() {
  const [data, setData] = useState<CompositionItem[]>([]);
  const [periodInfo, setPeriodInfo] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.get('/payrolls/composition');
        if (active && res.data?.data) {
          const { composition, periodMonth, periodYear } = res.data.data;
          if (Array.isArray(composition)) {
            setData(composition);
          }
          if (periodMonth && periodYear) {
            setPeriodInfo(`Periode: ${periodMonth}/${periodYear}`);
          }
        }
      } catch (err) {
        console.error('Failed to load payroll composition:', err);
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

      <div className="h-64">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-50/50 rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
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
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
