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

const MOCK_DATA = [
  { date: 'Sen', present: 45, absent: 3, late: 2 },
  { date: 'Sel', present: 47, absent: 1, late: 4 },
  { date: 'Rab', present: 46, absent: 2, late: 3 },
  { date: 'Kam', present: 48, absent: 1, late: 1 },
  { date: 'Jum', present: 44, absent: 4, late: 2 },
  { date: 'Sab', present: 25, absent: 10, late: 5 },
  { date: 'Min', present: 10, absent: 5, late: 1 },
];

export default function AttendanceChart() {
  const [data] = useState(MOCK_DATA);

  useEffect(() => {
    // TODO: replace with real API call when attendance-report endpoint is ready
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Statistik Kehadiran Mingguan
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
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
      </div>
    </div>
  );
}
