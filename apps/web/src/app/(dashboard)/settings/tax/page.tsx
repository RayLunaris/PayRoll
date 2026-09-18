'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ReceiptText, Plus, Trash2, Loader2 } from 'lucide-react';

interface TaxRow {
  id: string;
  bracketFrom: string;
  bracketTo: string | null;
  rate: string;
  fixedAmount: string;
  isActive: boolean;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

export default function TaxSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [brackets, setBrackets] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchConfig = async () => {
    const response = await api.get<{ data: TaxRow[] }>('/tax-config');
    setBrackets(response.data.data || []);
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
        console.error('Failed to fetch tax config:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const updateField = (id: string, field: keyof TaxRow, value: string | boolean) => {
    setBrackets((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const handleSave = async (row: TaxRow) => {
    setBusy(row.id);
    setMessage('');
    try {
      await api.put(`/tax-config/${row.id}`, {
        bracketTo:
          row.bracketTo === '' || row.bracketTo === null ? null : Number(row.bracketTo),
        rate: Number(row.rate),
        fixedAmount: Number(row.fixedAmount || 0),
        isActive: row.isActive,
      });
      setMessage('Lapisan pajak berhasil disimpan!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(e?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus lapisan pajak ini?')) return;
    setBusy(id);
    setMessage('');
    try {
      await api.delete(`/tax-config/${id}`);
      setBrackets((prev) => prev.filter((row) => row.id !== id));
      setMessage('Lapisan pajak berhasil dihapus!');
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
      const response = await api.post<{ data: TaxRow }>('/tax-config', {
        bracketFrom: 0,
        bracketTo: 120000000,
        rate: 5,
        fixedAmount: 0,
        isActive: true,
      });
      setBrackets((prev) => [...prev, response.data.data]);
      setMessage('Lapisan pajak baru ditambahkan!');
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
          <ReceiptText className="h-6 w-6 text-orange-600" />
          Konfigurasi Pajak (PPh 21)
        </h1>
        <p className="text-gray-500 mt-1">Atur tarif dan lapisan penghasilan PPh 21</p>
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

      <div className="card mb-6 max-w-2xl">
        <h3 className="font-semibold text-gray-900 mb-1">Penghasilan Tidak Kena Pajak (PTKP)</h3>
        <p className="text-sm text-gray-600 mb-2">Rp 54.000.000 per tahun (TK/0 — tidak kawin tanpa tanggungan)</p>
        <p className="text-xs text-gray-500">
          Nilai PTKP disebutkan di slip gaji &amp; laporan pajak; dihitung dari profil karyawan.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="card max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tarif Progresif (Lapisan)</h3>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy === 'new'}
              className="btn btn-secondary !py-1 !text-xs"
            >
              <Plus className="h-3 w-3" />
              Tambah Lapisan
            </button>
          </div>

          <div className="space-y-3">
            {brackets.map((bracket) => (
              <div key={bracket.id} className="p-3 rounded-lg border border-gray-100 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="label">Dari (Rp)</label>
                    <input
                      type="number"
                      value={bracket.bracketFrom}
                      disabled
                      className="input bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="label">Sampai (Rp)</label>
                    <input
                      type="number"
                      value={bracket.bracketTo ?? ''}
                      placeholder="Unlimited"
                      onChange={(e) => updateField(bracket.id, 'bracketTo', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Tarif (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={bracket.rate}
                      onChange={(e) => updateField(bracket.id, 'rate', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Potongan Tetap (Rp)</label>
                    <input
                      type="number"
                      value={bracket.fixedAmount}
                      onChange={(e) => updateField(bracket.id, 'fixedAmount', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bracket.isActive}
                      onChange={(e) => updateField(bracket.id, 'isActive', e.target.checked)}
                      className="h-4 w-4"
                    />
                    Aktif
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSave(bracket)}
                      disabled={busy === bracket.id}
                      className="btn btn-primary !py-1.5 !text-xs"
                    >
                      {busy === bracket.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Simpan'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(bracket.id)}
                      disabled={busy === bracket.id}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Hapus lapisan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {brackets.length === 0 && (
              <p className="text-center py-6 text-gray-500">Belum ada lapisan pajak</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}