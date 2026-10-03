'use client';

import { useEffect, useState, memo } from 'react';
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '@/lib/api';
import { CircleCheck, Clock3, Users, UserX } from 'lucide-react';
import {
  ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/line-charts-9';

interface DailyAttendanceStat {
  date: string;
  fullDate: string;
  present: number;
  late: number;
  absent: number;
}

const DEFAULT_WEEK: DailyAttendanceStat[] = [
  { date: 'Sen', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Sel', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Rab', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Kam', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Jum', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Sab', fullDate: '', present: 0, late: 0, absent: 0 },
  { date: 'Min', fullDate: '', present: 0, late: 0, absent: 0 },
];

const chartConfig = {
  present: { label: 'Hadir', color: '#2563eb' },
  late: { label: 'Terlambat', color: '#d97706' },
  absent: { label: 'Absen', color: '#dc2626' },
} satisfies ChartConfig;

export default memo(function AttendanceChart() {
  const [data, setData] = useState<DailyAttendanceStat[]>(DEFAULT_WEEK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await api.get('/attendance/weekly-stats');
        if (active && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load weekly attendance stats:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const summary = data.reduce(
    (result, day) => ({
      present: result.present + day.present,
      late: result.late + day.late,
      absent: result.absent + day.absent,
    }),
    { present: 0, late: 0, absent: 0 },
  );
  const totalRecorded = summary.present + summary.late + summary.absent;
  const attendanceRate = totalRecorded > 0
    ? Math.round(((summary.present + summary.late) / totalRecorded) * 100)
    : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Statistik Kehadiran Mingguan</h3>
          <p className="mt-1 text-sm text-gray-500">Rekap kehadiran 7 hari terakhir</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-right">
          <p className="text-xs font-medium text-blue-700">Tingkat kehadiran</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-blue-900">{attendanceRate}%</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_208px] lg:items-stretch">
        <div className="h-64 min-w-0">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-50/70">
            <span className="text-sm text-gray-500">Memuat data kehadiran...</span>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50/60 px-5 text-center">
            <p className="text-sm font-semibold text-red-800">Data kehadiran belum dapat dimuat</p>
            <p className="mt-1 text-xs leading-5 text-red-700">Periksa koneksi service absensi, lalu muat ulang halaman.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-gray-300">
            <ComposedChart data={data} margin={{ top: 18, right: 10, left: -18, bottom: 4 }}>
              <defs>
                <linearGradient id="attendancePresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartConfig.present.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={chartConfig.present.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickMargin={10} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <ReferenceLine y={0} stroke="#d1d5db" />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => <><span className="text-gray-500">Karyawan</span><span className="ml-auto font-mono font-medium tabular-nums text-gray-900">{Number(value).toLocaleString('id-ID')}</span></>} />}
                cursor={{ strokeDasharray: '3 3', stroke: '#9ca3af', strokeOpacity: 0.6 }}
              />
              <Legend content={<ChartLegendContent className="hidden sm:flex" />} />
              <Line type="monotone" dataKey="present" stroke={chartConfig.present.color} strokeWidth={3} dot={{ r: 3, fill: chartConfig.present.color, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Hadir" />
              <Line type="monotone" dataKey="late" stroke={chartConfig.late.color} strokeWidth={2} dot={{ r: 3, fill: chartConfig.late.color, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Terlambat" />
              <Line type="monotone" dataKey="absent" stroke={chartConfig.absent.color} strokeWidth={2} dot={{ r: 3, fill: chartConfig.absent.color, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Absen" />
            </ComposedChart>
          </ChartContainer>
        )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <AttendanceMetric icon={<Users />} label="Total catatan" value={totalRecorded} tone="slate" />
          <AttendanceMetric icon={<CircleCheck />} label="Hadir" value={summary.present} tone="blue" />
          <AttendanceMetric icon={<Clock3 />} label="Terlambat" value={summary.late} tone="amber" />
          <AttendanceMetric icon={<UserX />} label="Absen" value={summary.absent} tone="red" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500" aria-label="Legenda statistik kehadiran">
        <LegendItem color="bg-blue-600" label="Hadir" />
        <LegendItem color="bg-amber-500" label="Terlambat" />
        <LegendItem color="bg-red-600" label="Absen" />
      </div>
    </div>
  );
});

const metricStyles = {
  slate: 'bg-gray-50 text-gray-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
} as const;

function AttendanceMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: keyof typeof metricStyles;
}) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${metricStyles[tone]}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
