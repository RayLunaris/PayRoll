'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useForm, useWatch } from 'react-hook-form';
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

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  baseSalary: number;
}

interface Location {
  id: string;
  name: string;
}

export default function AddEmployeePage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
  });

  const selectedPosition = useWatch({ control, name: 'positionId' });

  useEffect(() => {
    void (async () => {
      try {
        const [deptRes, posRes, locRes] = await Promise.all([
          api.get<{ data: Department[] }>('/departments'),
          api.get<{ data: Position[] }>('/positions'),
          api.get<{ data: Location[] }>('/locations'),
        ]);
        setDepartments(deptRes.data.data || []);
        setPositions(posRes.data.data || []);
        setLocations(locRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch dropdowns:', err);
      }
    })();
  }, []);

  // Auto-suggest salary from selected position (only when field is still empty)
  useEffect(() => {
    const position = positions.find((p) => p.id === selectedPosition);
    if (position && !getValues('baseSalary')) {
      setValue('baseSalary', position.baseSalary);
    }
  }, [selectedPosition, positions, setValue, getValues]);

  const onSubmit = async (data: EmployeeForm) => {
    setLoading(true);
    setError('');

    try {
      await api.post('/employees', {
        ...data,
        phone: data.phone || undefined,
        address: data.address || undefined,
        birthDate: data.birthDate || undefined,
        npwp: data.npwp || undefined,
        bankName: data.bankName || undefined,
        bankAccount: data.bankAccount || undefined,
      });
      router.push('/employees');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          'Terjadi kesalahan saat menambah karyawan',
      );
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
          <h1 className="text-2xl font-bold text-gray-900">
            Tambah Karyawan Baru
          </h1>
          <p className="text-gray-500 mt-1">Lengkapi data karyawan berikut</p>
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
                      {pos.name} - Rp{' '}
                      {Number(pos.baseSalary).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                {errors.positionId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.positionId.message}
                  </p>
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
            onClick={() => router.push('/employees')}
            className="btn btn-secondary"
          >
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