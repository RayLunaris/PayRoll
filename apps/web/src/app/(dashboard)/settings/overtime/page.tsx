'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Clock, Loader2, Plus, Save, Trash2 } from 'lucide-react';

interface OvertimeRow {
  id: string;
  name: string;
  multiplier: string;
  dayType: string | null;
  isActive: boolean;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

const DAY_TYPE_LABEL: Record<string, string> = {
  weekday: 'Hari Kerja',
  weekend: 'Akhir Pekan',
  holiday: 'Hari Libur',
};

export default function OvertimeSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [rates, setRates] = useState<OvertimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchConfig = async () => {
    const response = await api.get<{ data: OvertimeRow[] }>('/overtime-rates');
    setRates(response.data.data || []);
  };

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      try {
        await fetchConfig();
      } catch (error) {
        console.error('Failed to fetch overtime rates:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const updateField = (id: string, field: keyof OvertimeRow, value: string | boolean | null) => {
    setRates((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const handleSave = async (row: OvertimeRow) => {
    setBusy(row.id);
    setMessage('');
    try {
      await api.put(`/overtime-rates/${row.id}`, {
        name: row.name,
        multiplier: Number(row.multiplier),
        dayType: row.dayType,
        isActive: row.isActive,
      });
      setMessage('Tarif lembur berhasil disimpan!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(e?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus tarif lembur ini?')) return;
    setBusy(id);
    setMessage('');
    try {
      await api.delete(`/overtime-rates/${id}`);
      setRates((prev) => prev.filter((row) => row.id !== id));
      setMessage('Tarif lembur berhasil dihapus!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(e?.response?.data?.error || 'Gagal menghapus');
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async () => {
    setBusy('new');
    setMessage('');
    try {
      const response = await api.post<{ data: OvertimeRow }>('/overtime-rates', {
        name: 'Rate baru',
        multiplier: 1.5,
        dayType: 'weekday',
        isActive: true,
      });
      setRates((prev) => [...prev, response.data.data]);
      setMessage('Tarif lembur baru ditambahkan!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(e?.response?.data?.error || 'Gagal menambahkan');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-orange-600" />
          Konfigurasi Lembur
        </h1>
        <p className="text-gray-500 mt-1">Atur tarif lembur per jenis hari</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm max-w-xl ${
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
        <div className="card max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tarif per Jenis Hari (x gaji/jam)</h3>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy === 'new'}
              className="btn btn-secondary !py-1 !text-xs"
            >
              <Plus className="h-3 w-3" />
              Tambah Tarif
            </button>
          </div>

          <div className="space-y-3">
            {rates.map((rate) => (
              <div key={rate.id} className="p-3 rounded-lg border border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="label">Nama</label>
                    <input
                      type="text"
                      value={rate.name}
                      onChange={(e) => updateField(rate.id, 'name', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Pengali (x gaji/jam)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={rate.multiplier}
                      onChange={(e) => updateField(rate.id, 'multiplier', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rate.isActive}
                        onChange={(e) => updateField(rate.id, 'isActive', e.target.checked)}
                        className="h-4 w-4"
                      />
                      Aktif
                    </label>
                    {rate.dayType && (
                      <span className="badge badge-info">
                        {DAY_TYPE_LABEL[rate.dayType] || rate.dayType}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSave(rate)}
                      disabled={busy === rate.id}
                      className="btn btn-primary !py-1.5 !text-xs"
                    >
                      {busy === rate.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-3 w-3" />
                          Simpan
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rate.id)}
                      disabled={busy === rate.id}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Hapus tarif"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {rates.length === 0 && (
              <p className="text-center py-6 text-gray-500">Belum ada tarif lembur</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}