'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useParams } from 'next/navigation';
import {
  User,
  Building2,
  Wallet,
  MapPin,
  Phone,
  Calendar,
  Pencil,
} from 'lucide-react';

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
  isActive: boolean;
}

interface NamedEntity {
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

function formatSalary(value: string | number): string {
  return Number(value || 0).toLocaleString('id-ID');
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [positions, setPositions] = useState<NamedEntity[]>([]);
  const [locations, setLocations] = useState<NamedEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const [employeeRes, deptRes, posRes, locRes] = await Promise.all([
        api.get<{ data: Employee }>(`/employees/${params.id}`),
        api.get<{ data: NamedEntity[] }>('/departments').catch(() => ({
          data: { data: [] },
        })),
        api.get<{ data: NamedEntity[] }>('/positions').catch(() => ({
          data: { data: [] },
        })),
        api.get<{ data: NamedEntity[] }>('/locations').catch(() => ({
          data: { data: [] },
        })),
      ]);
      setEmployee(employeeRes.data.data);
      setDepartments(deptRes.data.data || []);
      setPositions(posRes.data.data || []);
      setLocations(locRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch employee:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void (async () => {
      await fetchEmployee();
    })();
  }, [fetchEmployee]);

  const getName = (list: NamedEntity[], id: string) =>
    list.find((item) => item.id === id)?.name || '-';

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
        <button type="button" className="btn btn-primary">
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
            <h2 className="text-xl font-bold text-gray-900">
              {employee.fullName}
            </h2>
            <p className="text-gray-500">NIP: {employee.nip}</p>
            <span
              className={`mt-2 ${
                employee.isActive ? 'badge badge-success' : 'badge badge-danger'
              }`}
            >
              {employee.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Data Pribadi
          </h3>
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
                {employee.birthDate ? formatDate(employee.birthDate) : '-'}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              <span className="text-sm text-gray-600 w-32">Alamat</span>
              <span className="text-sm font-medium flex-1">
                {employee.address || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Job info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Data Pekerjaan
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Departemen</span>
              <span className="text-sm font-medium">
                {getName(departments, employee.departmentId)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Jabatan</span>
              <span className="text-sm font-medium">
                {getName(positions, employee.positionId)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Lokasi Kerja</span>
              <span className="text-sm font-medium">
                {getName(locations, employee.locationId)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 w-32">Tanggal Bergabung</span>
              <span className="text-sm font-medium">
                {formatDate(employee.joinDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Financial info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            Data Keuangan
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">Gaji Pokok</span>
              <span className="text-sm font-medium">
                Rp {formatSalary(employee.baseSalary)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">Bank</span>
              <span className="text-sm font-medium">
                {employee.bankName
                  ? `${employee.bankName} ${employee.bankAccount || ''}`
                  : '-'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32">NPWP</span>
              <span className="text-sm font-mono">{employee.npwp || '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}