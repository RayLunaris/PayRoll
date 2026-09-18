'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Plus, Search, Users, Pencil, Trash2, Eye } from 'lucide-react';

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string;
  positionId: string;
  locationId: string;
  phone: string;
  joinDate: string;
  baseSalary: string;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function EmployeeListPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get<{ data: Department[] }>('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (search) params.append('search', search);

      const response = await api.get<{
        data: Employee[];
        pagination: { totalPages: number };
      }>(`/employees?${params}`);
      setEmployees(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    void (async () => {
      await fetchDepartments();
    })();
  }, [user, router, fetchDepartments]);

  useEffect(() => {
    void (async () => {
      await fetchEmployees();
    })();
  }, [fetchEmployees]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus karyawan ini?')) return;

    try {
      await api.delete(`/employees/${id}`);
      if (employees.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await fetchEmployees();
      }
    } catch (error) {
      console.error('Failed to delete employee:', error);
    }
  };

  const getDepartmentName = (id: string) => {
    const dept = departments.find((d) => d.id === id);
    return dept?.name || '-';
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-6 w-6 text-blue-600" />
            Manajemen Karyawan
          </h1>
          <p className="text-gray-500 mt-1">
            Kelola data karyawan, departemen, dan jabatan
          </p>
        </div>
        <Link href="/employees/add" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          Tambah Karyawan
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama karyawan..."
              className="input pl-10"
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Cari
          </button>
        </form>
      </div>

      {/* Employee table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>NIP</th>
                    <th>Nama</th>
                    <th>Departemen</th>
                    <th>No. HP</th>
                    <th>Tanggal Bergabung</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Tidak ada data karyawan
                      </td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="font-mono text-sm">{employee.nip}</td>
                        <td className="font-medium">{employee.fullName}</td>
                        <td>{getDepartmentName(employee.departmentId)}</td>
                        <td>{employee.phone || '-'}</td>
                        <td>{formatDate(employee.joinDate)}</td>
                        <td>
                          <span
                            className={
                              employee.isActive
                                ? 'badge badge-success'
                                : 'badge badge-danger'
                            }
                          >
                            {employee.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/employees/${employee.id}`}
                              className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                              title="Lihat detail"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:text-yellow-600 rounded-lg hover:bg-yellow-50"
                              title="Edit (segera hadir)"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(employee.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                              title="Hapus karyawan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Halaman {page} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-sm btn-secondary"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-sm btn-secondary"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}