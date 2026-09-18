'use client';

import { useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  HeartHandshake,
  ReceiptText,
  Clock,
  Users,
  KeyRound,
  Building2,
  MapPin,
  Briefcase,
} from 'lucide-react';

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

const settingGroups = [
  {
    title: 'Konfigurasi Gaji',
    items: [
      {
        label: 'BPJS Kesehatan & Ketenagakerjaan',
        description: 'Atur persentase iuran BPJS',
        icon: HeartHandshake,
        href: '/settings/bpjs',
      },
      {
        label: 'Pajak (PPh 21)',
        description: 'Atur tarif pajak dan lapisan penghasilan',
        icon: ReceiptText,
        href: '/settings/tax',
      },
      {
        label: 'Tarif Overtime',
        description: 'Atur tarif lembur per jenis hari',
        icon: Clock,
        href: '/settings/overtime',
      },
    ],
  },
  {
    title: 'Kepegawaian',
    items: [
      {
        label: 'Departemen',
        description: 'Kelola departemen dan struktur organisasi',
        icon: Building2,
        href: '/settings/departments',
      },
      {
        label: 'Jabatan & Posisi',
        description: 'Kelola jenjang grade dan acuan gaji pokok',
        icon: Briefcase,
        href: '/settings/positions',
      },
      {
        label: 'Lokasi Perusahaan',
        description: 'Kelola lokasi absensi GPS',
        icon: MapPin,
        href: '/settings/locations',
      },
    ],
  },
  {
    title: 'Sistem & Keamanan',
    items: [
      {
        label: 'Manajemen User',
        description: 'Kelola akun dan role pengguna',
        icon: Users,
        href: '/settings/users',
      },
      {
        label: 'Ubah Password',
        description: 'Perbarui password akun Anda',
        icon: KeyRound,
        href: '/settings/password',
      },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-blue-600" />
          Pengaturan Sistem
        </h1>
        <p className="text-gray-500 mt-1">Konfigurasi aplikasi payroll perusahaan</p>
      </div>

      <div className="space-y-8">
        {settingGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="card text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
                >
                  <div className="p-2.5 bg-gray-50 rounded-lg mb-3 inline-flex">
                    <item.icon className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{item.label}</h3>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}