# Phase 18: Frontend Employee

**Objective:** Implementasi manajemen karyawan, departments, positions, locations  
**Estimated Time:** 10-12 hours  
**Prerequisites:** Phase 17 selesai

---

## Tasks

### 18.1 Create Employee List Page

```bash
# src/app/(dashboard)/employees/page.tsx
cat > src/app/(dashboard)/employees/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
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

export default function EmployeeListPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
    fetchDepartments();
  }, [user]);

  useEffect(() => {
    fetchEmployees();
  }, [page, selectedDept]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (search) params.append('search', search);
      if (selectedDept) params.append('departmentId', selectedDept);

      const response = await api.get(`/api/employees?${params}`);
      setEmployees(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmployees();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus karyawan ini?')) return;
    
    try {
      await api.delete(`/api/employees/${id}`);
      fetchEmployees();
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Manajemen Karyawan
          </h1>
          <p className="text-gray-500 mt-1">Kelola data karyawan, departemen, dan jabatan</p>
        </div>
        <Link href="/employees/add" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          Tambah Karyawan
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau NIP..."
                className="input pl-10"
              />
            </div>
          </form>
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="input !w-auto"
          >
            <option value="">Semua Departemen</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="table-container">
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
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="font-mono text-sm">{employee.nip}</td>
                      <td className="font-medium">{employee.fullName}</td>
                      <td>{getDepartmentName(employee.departmentId)}</td>
                      <td>{employee.phone || '-'}</td>
                      <td>{new Date(employee.joinDate).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}</td>
                      <td>
                        <span className={employee.isActive ? 'badge badge-green' : 'badge badge-red'}>
                          {employee.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/employees/${employee.id}`} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button className="p-1.5 text-gray-500 hover:text-yellow-600 rounded-lg hover:bg-yellow-50">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(employee.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Tidak ada data karyawan
                      </td>
                    </tr>
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary !py-1.5 !text-xs"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary !py-1.5 !text-xs"
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
EOF
```

### 18.2 Create Add Employee Form

```bash
# src/app/(dashboard)/employees/add/page.tsx
cat > src/app/(dashboard)/employees/add/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Save, X } from 'lucide-react';

const employeeSchema = z.object({
  nip: z.string().min(1, 'NIP wajib diisi'),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi'),
  departmentId: z.string().uuid('Pilih departemen'),
  positionId: z.string().uuid('Pilih jabatan'),
  locationId: z.string().uuid('Pilih lokasi kerja'),
  joinDate: z.string().min(1, 'Tanggal bergabung wajib diisi'),
  baseSalary: z.number().positive('Gaji pokok wajib diisi'),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  npwp: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

export default function AddEmployeePage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
  });

  const selectedPosition = watch('positionId');

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [deptRes, posRes, locRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/positions'),
        api.get('/api/locations'),
      ]);
      setDepartments(deptRes.data.data);
      setPositions(posRes.data.data);
      setLocations(locRes.data.data);
    } catch (error) {
      console.error('Failed to fetch dropdowns:', error);
    }
  };

  // Auto-suggest salary from position
  useEffect(() => {
    const position = positions.find((p) => p.id === selectedPosition);
    if (position) {
      // Set base salary input value
      const salaryInput = document.getElementById('baseSalary') as HTMLInputElement;
      if (salaryInput) {
        salaryInput.value = position.baseSalary;
      }
    }
  }, [selectedPosition, positions]);

  const onSubmit = async (data: EmployeeForm) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/employees', data);
      router.push('/employees');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Terjadi kesalahan saat menambah karyawan');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = (hasError: boolean) => 
    `${hasError ? 'border-red-500' : ''} input`;

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Karyawan Baru</h1>
          <p className="text-gray-500 mt-1">Lengkapi data karyawan berikut</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-secondary">
          <X className="h-4 w-4" />
          Batal
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Pribadi */}
          <div className="card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Pribadi</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">NIP</label>
                  <input {...register('nip')} className={inputClasses(!!errors.nip)} placeholder="EMP001" />
                  {errors.nip && <p className="mt-1 text-sm text-red-600">{errors.nip.message}</p>}
                </div>
                <div>
                  <label className="label">Nama Lengkap</label>
                  <input {...register('fullName')} className={inputClasses(!!errors.fullName)} placeholder="Nama Karyawan" />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tanggal Lahir</label>
                  <input type="date" {...register('birthDate')} className={inputClasses(!!errors.birthDate)} />
                </div>
                <div>
                  <label className="label">No. HP</label>
                  <input {...register('phone')} className={inputClasses(!!errors.phone)} placeholder="08xxxxxxxx" />
                </div>
              </div>

              <div>
                <label className="label">Alamat</label>
                <textarea {...register('address')} rows={3} className={inputClasses(!!errors.address)} placeholder="Alamat lengkap" />
              </div>
            </div>
          </div>

          {/* Data Pekerjaan */}
          <div className="card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Pekerjaan</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Departemen</label>
                <select {...register('departmentId')} className={inputClasses(!!errors.departmentId)}>
                  <option value="">Pilih departemen</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                {errors.departmentId && <p className="mt-1 text-sm text-red-600">{errors.departmentId.message}</p>}
              </div>

              <div>
                <label className="label">Jabatan</label>
                <select {...register('positionId')} className={inputClasses(!!errors.positionId)}>
                  <option value="">Pilih jabatan</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name} - Rp {parseInt(pos.baseSalary).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                {errors.positionId && <p className="mt-1 text-sm text-red-600">{errors.positionId.message}</p>}
              </div>

              <div>
                <label className="label">Lokasi Kerja</label>
                <select {...register('locationId')} className={inputClasses(!!errors.locationId)}>
                  <option value="">Pilih lokasi</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {errors.locationId && <p className="mt-1 text-sm text-red-600">{errors.locationId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tanggal Bergabung</label>
                  <input type="date" {...register('joinDate')} className={inputClasses(!!errors.joinDate)} />
                  {errors.joinDate && <p className="mt-1 text-sm text-red-600">{errors.joinDate.message}</p>}
                </div>
                <div>
                  <label className="label">Gaji Pokok (Rp)</label>
                  <input
                    id="baseSalary"
                    type="number"
                    {...register('baseSalary', { valueAsNumber: true })}
                    className={inputClasses(!!errors.baseSalary)}
                    placeholder="8000000"
                  />
                  {errors.baseSalary && <p className="mt-1 text-sm text-red-600">{errors.baseSalary.message}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Data Bank */}
          <div className="lg:col-span-2 card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Bank & NPWP</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Nama Bank</label>
                <input {...register('bankName')} className={inputClasses(!!errors.bankName)} placeholder="BCA" />
              </div>
              <div>
                <label className="label">No. Rekening</label>
                <input {...register('bankAccount')} className={inputClasses(!!errors.bankAccount)} placeholder="1234567890" />
              </div>
              <div>
                <label className="label">NPWP</label>
                <input {...register('npwp')} className={inputClasses(!!errors.npwp)} placeholder="00.000.000.0-000.000" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => router.push('/employees')} className="btn btn-secondary">
            Batal
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            <Save className="h-4 w-4" />
            {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
          </button>
        </div>
      </form>
    </div>
  );
}
EOF
```

### 18.3 Create Employee Detail Page

```bash
# src/app/(dashboard)/employees/[id]/page.tsx
cat > src/app/(dashboard)/employees/[id]/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useParams } from 'next/navigation';
import { User, Mail, Building2, Wallet, MapPin, Phone, Calendar, Pencil, Copy } from 'lucide-react';

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string;
  positionId: string;
  locationId: string;
  phone: string;
  birthDate: string;
  joinDate: string;
  baseSalary: string;
  bankName: string;
  bankAccount: string;
  npwp: string;
  address: string;
  photoUrl: string;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployee();
  }, [params.id]);

  const fetchEmployee = async () => {
    try {
      const response = await api.get(`/api/employees/${params.id}`);
      setEmployee(response.data.data);
    } catch (error) {
      console.error('Failed to fetch employee:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profil Karyawan</h1>
        <button className="btn btn-primary">
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>

      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="h-20 w-20 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{employee.fullName}</h2>
            <p className="text-gray-500">NIP: {employee.nip}</p>
            <span className="badge badge-green mt-2">Aktif</span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Pribadi</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">No. HP</span>
              <span className="text-sm font-medium">{employee.phone || '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Tanggal Lahir</span>
              <span className="text-sm font-medium">
                {employee.birthDate ? new Date(employee.birthDate).toLocaleDateString('id-ID') : '-'}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              <span className="text-sm text-gray-600 w-32">Alamat</span>
              <span className="text-sm font-medium flex-1">{employee.address || '-'}</span>
            </div>
          </div>
        </div>

        {/* Job info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Pekerjaan</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Departemen</span>
              <span className="text-sm font-medium">{employee.departmentId || '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Jabatan</span>
              <span className="text-sm font-medium">{employee.positionId || '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Tanggal Bergabung</span>
              <span className="text-sm font-medium">
                {new Date(employee.joinDate).toLocaleDateString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* Financial info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            <Wallet className="h-5 w-5 inline-block mr-2 text-blue-600" />
            Data Keuangan
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">Gaji Pokok</span>
              <span className="text-sm font-medium">
                Rp {parseInt(employee.baseSalary).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">Bank</span>
              <span className="text-sm font-medium">{employee.bankName || '-'} {employee.bankAccount || ''}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">NPWP</span>
              <span className="text-sm font-mono">{employee.npwp || '-'}</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">12</p>
              <p className="text-xs text-blue-700 mt-1">Sisa Cuti Tahunan</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-600">95%</p>
              <p className="text-xs text-emerald-700 mt-1">Kehadiran Bulan Ini</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF
```

### 18.4 Create Department Management Page

```bash
# src/app/(dashboard)/employees/departments/page.tsx (submenu)
# Atau bisa jadi bagian dari /settings
# Buat sebagai komponen terpisah di halaman pengaturan
```

---

## Verification Checklist

- [ ] Employee list dengan pagination
- [ ] Search dan filter bekerja
- [ ] Form tambah karyawan dengan validasi
- [ ] Auto-suggest gaji dari jabatan
- [ ] Detail karyawan ditampilkan
- [ ] Delete dengan konfirmasi
- [ ] Role check (HR only)
- [ ] Dropdown data terfetch

---

## Next Phase

Setelah Phase 18 selesai, lanjut ke:
**[Phase 19: Frontend Social](./PHASE-19-FRONTEND-SOCIAL.md)**