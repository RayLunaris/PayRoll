'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MOCK_DATA = [
  { name: 'Gaji Pokok', value: 500000000 },
  { name: 'Lembur', value: 30000000 },
  { name: 'Tunjangan', value: 40000000 },
  { name: 'BPJS', value: 60000000 },
  { name: 'Pajak', value: 80000000 },
];

export default function PayrollChart() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Komposisi Payroll
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={MOCK_DATA}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {MOCK_DATA.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
