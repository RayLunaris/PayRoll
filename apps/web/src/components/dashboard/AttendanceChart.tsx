'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api from '@/lib/api';

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

export default function AttendanceChart() {
  const [data, setData] = useState<DailyAttendanceStat[]>(DEFAULT_WEEK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.get('/attendance/weekly-stats');
        if (active && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load weekly attendance stats:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Statistik Kehadiran Mingguan
        </h3>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Memuat data...</span>
        )}
      </div>

      <div className="h-64">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-50/50 rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip
                formatter={(value: any, name: any) => [
                  `${value} karyawan`,
                  name === 'present' ? 'Hadir' : name === 'late' ? 'Terlambat' : 'Absen',
                ]}
                labelFormatter={(label, payload) => {
                  const full = payload?.[0]?.payload?.fullDate;
                  return full ? `${label} (${full})` : label;
                }}
              />
              <Area
                type="monotone"
                dataKey="present"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Hadir"
              />
              <Area
                type="monotone"
                dataKey="late"
                stackId="1"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
                name="Terlambat"
              />
              <Area
                type="monotone"
                dataKey="absent"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                name="Absen"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
