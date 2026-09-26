'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/stores/toast';
import { Plus, Search, Users, Pencil, Trash2, Eye, AlertTriangle, X } from 'lucide-react';

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
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal State for Payroll Protected Employee
  const [payrollModal, setPayrollModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
    canForce: boolean;
  }>({
    isOpen: false,
    employee: null,
    canForce: false,
  });

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
      setError('');
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setError('Gagal memuat data karyawan. Silakan coba lagi.');
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('search');
      if (q) {
        setSearchInput(q);
        setSearch(q);
      }
    }
  }, []);

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

  const canManage = user?.role === 'super_admin' || user?.role === 'hr_admin';

  // Toggle status Aktif / Nonaktif
  const handleToggleStatus = async (employee: Employee) => {
    const nextStatus = !employee.isActive;
    const actionLabel = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    if (!window.confirm(`Yakin ingin ${actionLabel} karyawan ${employee.fullName}?`)) return;

    try {
      await api.put(`/employees/${employee.id}`, { isActive: nextStatus });
      toast.success(
        `Karyawan ${employee.fullName} berhasil di-${nextStatus ? 'aktifkan' : 'nonaktifkan'}`
      );
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === employee.id ? { ...emp, isActive: nextStatus } : emp))
      );
    } catch (err: unknown) {
      console.error('Failed to update employee status:', err);
      toast.error('Gagal memperbarui status karyawan.');
    }
  };

  // Delete employee with payroll guard & force support
  const handleDelete = async (employee: Employee, force = false) => {
    if (!force && !window.confirm(`Yakin ingin menghapus karyawan ${employee.fullName}?`)) return;
    setError('');
    setActionLoading(true);

    try {
      await api.delete(`/employees/${employee.id}${force ? '?force=true' : ''}`);
      toast.success(
        force
          ? `Karyawan ${employee.fullName} dan riwayat payroll berhasil dihapus permanen.`
          : `Karyawan ${employee.fullName} berhasil dihapus.`
      );
      setPayrollModal({ isOpen: false, employee: null, canForce: false });

      if (employees.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await fetchEmployees();
      }
    } catch (err: unknown) {
      console.error('Failed to delete employee:', err);
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { error?: string; hasPayroll?: boolean; canForce?: boolean };
        };
      };
      const resData = axiosErr.response?.data;

      if (resData?.hasPayroll) {
        // Open the payroll protection modal with actions
        setPayrollModal({
          isOpen: true,
          employee,
          canForce: user?.role === 'super_admin' || resData?.canForce === true,
        });
      } else {
        const errorMsg = resData?.error || 'Gagal menghapus karyawan. Pastikan Anda memiliki izin akses.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Deactivate employee from protection modal
  const handleDeactivateFromModal = async () => {
    if (!payrollModal.employee) return;
    setActionLoading(true);
    try {
      await api.put(`/employees/${payrollModal.employee.id}`, { isActive: false });
      toast.success(
        `Status karyawan ${payrollModal.employee.fullName} berhasil diubah menjadi Nonaktif.`
      );
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === payrollModal.employee?.id ? { ...emp, isActive: false } : emp
        )
      );
      setPayrollModal({ isOpen: false, employee: null, canForce: false });
      setError('');
    } catch (err: unknown) {
      console.error('Failed to deactivate employee:', err);
      toast.error('Gagal menonaktifkan karyawan.');
    } finally {
      setActionLoading(false);
    }
  };

  const getDepartmentName = (id: string) => {
    const dept = departments.find((d) => d.id === id);
    return dept?.name || '-';
  };

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {payrollModal.employee && (
            <button
              type="button"
              onClick={handleDeactivateFromModal}
              disabled={actionLoading}
              className="btn btn-sm bg-red-600 hover:bg-red-700 text-white border-none whitespace-nowrap"
            >
              Nonaktifkan Sekarang
            </button>
          )}
        </div>
      )}

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
        {canManage && (
          <Link href="/employees/add" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Tambah Karyawan
          </Link>
        )}
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
                  {employees.length === 0 && !error ? (
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
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(employee)}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                                employee.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                              title={`Klik untuk ${employee.isActive ? 'menonaktifkan' : 'mengaktifkan'}`}
                            >
                              {employee.isActive ? 'Aktif' : 'Nonaktif'}
                            </button>
                          ) : (
                            <span
                              className={
                                employee.isActive
                                  ? 'badge badge-success'
                                  : 'badge badge-danger'
                              }
                            >
                              {employee.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          )}
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
                            {canManage && (
                              <>
                                <Link
                                  href={`/employees/${employee.id}/edit`}
                                  className="p-1.5 text-gray-500 hover:text-yellow-600 rounded-lg hover:bg-yellow-50"
                                  title="Edit data karyawan"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(employee)}
                                  className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Hapus karyawan"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
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

      {/* Modal Proteksi Payroll */}
      {payrollModal.isOpen && payrollModal.employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card max-w-md w-full bg-white shadow-2xl rounded-xl p-6 relative animate-in fade-in zoom-in duration-150">
            <button
              type="button"
              onClick={() => setPayrollModal({ isOpen: false, employee: null, canForce: false })}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              disabled={actionLoading}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-full flex-shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Riwayat Penggajian Terdeteksi
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Karyawan <strong className="text-gray-900">{payrollModal.employee.fullName}</strong> ({payrollModal.employee.nip}) sudah memiliki catatan slip gaji/payroll di sistem.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-5 leading-relaxed">
              <strong>Mengapa dilindungi?</strong> Untuk kepatuhan perpajakan (PPh 21) dan integritas audit keuangan, karyawan dengan slip gaji tidak boleh dihapus secara permanen.
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleDeactivateFromModal}
                disabled={actionLoading}
                className="btn btn-warning w-full justify-center text-sm py-2.5 font-medium shadow-sm"
              >
                {actionLoading ? 'Memproses...' : 'Ubah Status Menjadi Nonaktif (Disarankan)'}
              </button>

              {payrollModal.canForce && (
                <button
                  type="button"
                  onClick={() => handleDelete(payrollModal.employee!, true)}
                  disabled={actionLoading}
                  className="btn btn-danger w-full justify-center text-sm py-2.5 font-medium"
                >
                  {actionLoading ? 'Menghapus...' : 'Hapus Paksa (Hapus Karyawan & Payroll Dummy)'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setPayrollModal({ isOpen: false, employee: null, canForce: false })}
                disabled={actionLoading}
                className="btn btn-secondary w-full justify-center text-sm py-2"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}