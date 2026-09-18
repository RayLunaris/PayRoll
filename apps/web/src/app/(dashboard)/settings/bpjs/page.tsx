'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { HeartHandshake, Save, Loader2 } from 'lucide-react';

interface BpjsRow {
  id: string;
  component: string;
  employeeRate: string;
  employerRate: string;
  maxSalaryCap: string | null;
  isActive: boolean;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

const COMPONENT_LABEL: Record<string, string> = {
  JKK: 'Jaminan Kecelakaan Kerja (JKK)',
  JKM: 'Jaminan Kematian (JKM)',
  JP: 'Jaminan Pensiun (JP)',
  JHT: 'Jaminan Hari Tua (JHT)',
  BPJS_KES: 'BPJS Kesehatan (JKN)',
};

export default function BPJSSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [configs, setConfigs] = useState<BpjsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      try {
        const response = await api.get<{ data: BpjsRow[] }>('/bpjs-config');
        setConfigs(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch BPJS config:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const updateField = useCallback((id: string, field: keyof BpjsRow, value: string | boolean) => {
    setConfigs((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }, []);

  const handleSave = async (row: BpjsRow) => {
    setSavingId(row.id);
    setMessage('');
    try {
      await api.put(`/bpjs-config/${row.id}`, {
        employeeRate: Number(row.employeeRate),
        employerRate: Number(row.employerRate),
        maxSalaryCap:
          row.maxSalaryCap === '' || row.maxSalaryCap === null
            ? null
            : Number(row.maxSalaryCap),
        isActive: row.isActive,
      });
      setMessage(`Konfigurasi ${row.component} berhasil disimpan!`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(e?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartHandshake className="h-6 w-6 text-emerald-600" />
          Konfigurasi BPJS
        </h1>
        <p className="text-gray-500 mt-1">Atur persentase iuran BPJS Kesehatan dan Ketenagakerjaan</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          {configs.map((row) => (
            <div key={row.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {COMPONENT_LABEL[row.component] || row.component}
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) => updateField(row.id, 'isActive', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Aktif
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Iuran Karyawan (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.employeeRate}
                    onChange={(e) => updateField(row.id, 'employeeRate', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Iuran Perusahaan (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.employerRate}
                    onChange={(e) => updateField(row.id, 'employerRate', e.target.value)}
                    className="input"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="label">Batas Gaji Maksimal (Rp, kosongkan jika tanpa batas)</label>
                <input
                  type="number"
                  value={row.maxSalaryCap ?? ''}
                  onChange={(e) => updateField(row.id, 'maxSalaryCap', e.target.value)}
                  className="input"
                  placeholder="Tanpa batas"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSave(row)}
                disabled={savingId === row.id}
                className="btn btn-primary mt-4"
              >
                {savingId === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}