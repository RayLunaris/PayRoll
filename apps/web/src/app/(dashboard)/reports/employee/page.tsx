'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
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
import api from '@/lib/api';
import { Users, Loader2 } from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  departmentId: string | null;
  positionId: string | null;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function EmployeeStatisticPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/reports');
      return;
    }

    void (async () => {
      try {
        const [empRes, deptRes, posRes] = await Promise.all([
          api.get<{ data: Employee[] }>('/employees?page=1&limit=100'),
          api.get<{ data: Department[] }>('/departments'),
          api.get<{ data: Position[] }>('/positions'),
        ]);
        setEmployees(empRes.data.data || []);
        setDepartments(deptRes.data.data || []);
        setPositions(posRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch employee statistics:', error);
        setError('Gagal memuat data laporan. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const nameOf = (
    list: { id: string; name: string }[],
    id: string | null,
  ) => list.find((item) => item.id === id)?.name || 'Tanpa penempatan';

  const countBy = (key: (emp: Employee) => string) =>
    employees.reduce<Record<string, number>>((acc, emp) => {
      const value = key(emp);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  const departmentData = Object.entries(countBy((e) => nameOf(departments, e.departmentId)))
    .map(([name, value]) => ({ name, value }));
  const positionData = Object.entries(countBy((e) => nameOf(positions, e.positionId)))
    .map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(countBy((e) => (e.isActive ? 'Aktif' : 'Non-Aktif')))
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Users className="h-6 w-6 text-blue-600" />
          Statistik Karyawan
        </h1>
        <p className="text-gray-500 mt-1">Distribusi karyawan perusahaan</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      ) : (
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
      )}
    </div>
  );
}