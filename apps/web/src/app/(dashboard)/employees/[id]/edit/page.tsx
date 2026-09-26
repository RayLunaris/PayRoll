'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Save, X, AlertCircle } from 'lucide-react';
import { formatRupiah } from '@/lib/csv';
import { useRequireRole } from '@/hooks/useAuth';
import { toast } from '@/stores/toast';

const employeeEditSchema = z.object({
  nip: z.string().min(1, 'NIP wajib diisi'),
  fullName: z.string().min(1, 'Nama lengkap wajib diisi'),
  departmentId: z.string().uuid('Pilih departemen'),
  positionId: z.string().uuid('Pilih jabatan'),
  locationId: z.string().uuid('Pilih lokasi kerja'),
  joinDate: z.string().min(1, 'Tanggal bergabung wajib diisi'),
  baseSalary: z.number().positive('Gaji pokok wajib diisi'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  npwp: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

type EmployeeEditForm = z.infer<typeof employeeEditSchema>;

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  code?: string | null;
  grade?: string | null;
  baseSalary: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  positionAllowance?: number | null;
}

interface Location {
  id: string;
  name: string;
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { isLoading: roleLoading } = useRequireRole('super_admin', 'hr_admin');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EmployeeEditForm>({
    resolver: zodResolver(employeeEditSchema),
  });

  const selectedPosition = useWatch({ control, name: 'positionId' });
  const currentSalary = useWatch({ control, name: 'baseSalary' });
  const activePosition = positions.find((p) => p.id === selectedPosition);

  const isOutOfRange =
    activePosition &&
    currentSalary &&
    ((activePosition.minSalary && currentSalary < Number(activePosition.minSalary)) ||
      (activePosition.maxSalary && currentSalary > Number(activePosition.maxSalary)));

  useEffect(() => {
    if (!params?.id) return;

    void (async () => {
      setFetching(true);
      setError('');
      try {
        const [empRes, deptRes, posRes, locRes] = await Promise.all([
          api.get<{ data: any }>(`/employees/${params.id}`),
          api.get<{ data: Department[] }>('/departments'),
          api.get<{ data: Position[] }>('/positions'),
          api.get<{ data: Location[] }>('/locations'),
        ]);

        const emp = empRes.data.data;
        setDepartments(deptRes.data.data || []);
        setPositions(posRes.data.data || []);
        setLocations(locRes.data.data || []);

        if (emp) {
          reset({
            nip: emp.nip || '',
            fullName: emp.fullName || '',
            departmentId: emp.departmentId || '',
            positionId: emp.positionId || '',
            locationId: emp.locationId || '',
            joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : '',
            baseSalary: Number(emp.baseSalary || 0),
            phone: emp.phone || '',
            address: emp.address || '',
            birthDate: emp.birthDate ? emp.birthDate.split('T')[0] : '',
            npwp: emp.npwp || '',
            bankName: emp.bankName || '',
            bankAccount: emp.bankAccount || '',
            isActive: emp.isActive !== false,
          });
        }
      } catch (err: unknown) {
        console.error('Failed to load employee edit data:', err);
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || 'Gagal memuat data karyawan');
      } finally {
        setFetching(false);
      }
    })();
  }, [params?.id, reset]);

  const onSubmit = async (data: EmployeeEditForm) => {
    setSubmitting(true);
    setError('');

    try {
      await api.put(`/employees/${params.id}`, {
        nip: data.nip.trim(),
        fullName: data.fullName.trim(),
        departmentId: data.departmentId,
        positionId: data.positionId,
        locationId: data.locationId,
        joinDate: data.joinDate,
        baseSalary: Number(data.baseSalary),
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        birthDate: data.birthDate?.trim() || null,
        npwp: data.npwp?.trim() || null,
        bankName: data.bankName?.trim() || null,
        bankAccount: data.bankAccount?.trim() || null,
        isActive: data.isActive,
      });
      toast.success('Data karyawan berhasil diperbarui');
      router.push(`/employees/${params.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          'Terjadi kesalahan saat memperbarui data karyawan',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = (hasError: boolean) =>
    `${hasError ? 'border-red-500' : ''} input`;

  if (roleLoading || fetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Data Karyawan
          </h1>
          <p className="text-gray-500 mt-1">Perbarui data karyawan dan status kepegawaian</p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          <X className="h-4 w-4" />
          Batal
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Pribadi */}
          <div className="card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Data Pribadi
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nip" className="label">
                    NIP
                  </label>
                  <input
                    id="nip"
                    {...register('nip')}
                    className={inputClasses(!!errors.nip)}
                    placeholder="EMP001"
                  />
                  {errors.nip && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.nip.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="fullName" className="label">
                    Nama Lengkap
                  </label>
                  <input
                    id="fullName"
                    {...register('fullName')}
                    className={inputClasses(!!errors.fullName)}
                    placeholder="Nama Karyawan"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="birthDate" className="label">
                    Tanggal Lahir
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    {...register('birthDate')}
                    className={inputClasses(!!errors.birthDate)}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="label">
                    No. HP
                  </label>
                  <input
                    id="phone"
                    {...register('phone')}
                    className={inputClasses(!!errors.phone)}
                    placeholder="08xxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="label">
                  Alamat
                </label>
                <textarea
                  id="address"
                  {...register('address')}
                  rows={3}
                  className={inputClasses(!!errors.address)}
                  placeholder="Alamat lengkap"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    {...register('isActive')}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Karyawan Aktif
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Data Pekerjaan */}
          <div className="card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Data Pekerjaan
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="departmentId" className="label">
                  Departemen
                </label>
                <select
                  id="departmentId"
                  {...register('departmentId')}
                  className={inputClasses(!!errors.departmentId)}
                >
                  <option value="">Pilih departemen</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.departmentId.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="positionId" className="label">
                  Jabatan
                </label>
                <select
                  id="positionId"
                  {...register('positionId')}
                  className={inputClasses(!!errors.positionId)}
                >
                  <option value="">Pilih jabatan</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name} {pos.code ? `[${pos.code}]` : ''} - Rp{' '}
                      {Number(pos.baseSalary).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                {errors.positionId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.positionId.message}
                  </p>
                )}

                {activePosition && (
                  <div className="mt-2 text-xs space-y-1 bg-blue-50/70 border border-blue-100 p-2.5 rounded-lg text-blue-900">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Jenjang / Grade:</span>
                      <span className="font-semibold">{activePosition.grade || 'Grade 1'}</span>
                    </div>
                    {(activePosition.minSalary || activePosition.maxSalary) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rentang Gaji Acuan:</span>
                        <span className="font-mono font-medium">
                          {activePosition.minSalary ? formatRupiah(Number(activePosition.minSalary)) : 'Rp 0'} -{' '}
                          {activePosition.maxSalary ? formatRupiah(Number(activePosition.maxSalary)) : 'Tak Terbatas'}
                        </span>
                      </div>
                    )}
                    {Number(activePosition.positionAllowance || 0) > 0 && (
                      <div className="flex justify-between text-indigo-700">
                        <span>Tunjangan Jabatan Otomatis:</span>
                        <span className="font-mono font-bold">
                          {formatRupiah(Number(activePosition.positionAllowance))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="locationId" className="label">
                  Lokasi Kerja
                </label>
                <select
                  id="locationId"
                  {...register('locationId')}
                  className={inputClasses(!!errors.locationId)}
                >
                  <option value="">Pilih lokasi</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {errors.locationId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.locationId.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="joinDate" className="label">
                    Tanggal Bergabung
                  </label>
                  <input
                    id="joinDate"
                    type="date"
                    {...register('joinDate')}
                    className={inputClasses(!!errors.joinDate)}
                  />
                  {errors.joinDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.joinDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="baseSalary" className="label">
                    Gaji Pokok (Rp)
                  </label>
                  <input
                    id="baseSalary"
                    type="number"
                    {...register('baseSalary', { valueAsNumber: true })}
                    className={inputClasses(!!errors.baseSalary)}
                    placeholder="8000000"
                  />
                  {errors.baseSalary && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.baseSalary.message}
                    </p>
                  )}
                </div>
              </div>

              {isOutOfRange && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Peringatan Rentang Gaji (Salary Band):</span> Gaji yang dimasukkan ({formatRupiah(Number(currentSalary))}) berada di luar rentang standar jabatan ini ({activePosition.minSalary ? formatRupiah(Number(activePosition.minSalary)) : 'Rp 0'} - {activePosition.maxSalary ? formatRupiah(Number(activePosition.maxSalary)) : '∞'}).
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data Bank */}
          <div className="lg:col-span-2 card h-fit">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Data Bank & NPWP
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="bankName" className="label">
                  Nama Bank
                </label>
                <input
                  id="bankName"
                  {...register('bankName')}
                  className={inputClasses(!!errors.bankName)}
                  placeholder="BCA"
                />
              </div>
              <div>
                <label htmlFor="bankAccount" className="label">
                  No. Rekening
                </label>
                <input
                  id="bankAccount"
                  {...register('bankAccount')}
                  className={inputClasses(!!errors.bankAccount)}
                  placeholder="1234567890"
                />
              </div>
              <div>
                <label htmlFor="npwp" className="label">
                  NPWP
                </label>
                <input
                  id="npwp"
                  {...register('npwp')}
                  className={inputClasses(!!errors.npwp)}
                  placeholder="00.000.000.0-000.000"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/employees/${params.id}`)}
            className="btn btn-secondary"
          >
            Batal
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            <Save className="h-4 w-4" />
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
