'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

export interface NamedCount {
  name: string;
  value: number;
}

interface EmployeeReportChartsProps {
  departmentData: NamedCount[];
  positionData: NamedCount[];
  statusData: NamedCount[];
}

export default function EmployeeReportCharts({
  departmentData,
  positionData,
  statusData,
}: EmployeeReportChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Per Departemen</h3>
        {departmentData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name} (${entry.value})`}
                >
                  {departmentData.map((entry, index) => (
                    <Cell
                      key={`dept-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-10">
            Belum ada data
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Per Jabatan</h3>
        {positionData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Jumlah" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-10">
            Belum ada data
          </p>
        )}
      </div>

      <div className="card lg:col-span-2">
        <h3 className="font-semibold text-gray-900 mb-4">
          Per Status Kepegawaian
        </h3>
        {statusData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => `${entry.name} (${entry.value})`}
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`status-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-10">
            Belum ada data
          </p>
        )}
      </div>
    </div>
  );
}
