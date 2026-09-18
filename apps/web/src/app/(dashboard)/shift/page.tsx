'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ShiftTabs from '@/components/shift/ShiftTabs';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Repeat, Plus, Pencil, Trash2, Save, X, Clock } from 'lucide-react';

const shiftSchema = z.object({
  name: z.string().min(1, 'Nama shift wajib diisi'),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM'),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM'),
});

type ShiftForm = z.infer<typeof shiftSchema>;

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

function formatTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

const ADMIN_ROLES = ['manager', 'hr_admin', 'super_admin'];

export default function ShiftManagementPage() {
  const user = useAuthStore((state) => state.user);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
  });

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: Shift[] }>('/shifts');
      setShifts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchShifts();
    })();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    reset({ name: '', startTime: '', endTime: '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditingId(shift.id);
    reset({
      name: shift.name,
      startTime: formatTime(shift.startTime),
      endTime: formatTime(shift.endTime),
    });
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError('');
  };

  const onSubmit = async (data: ShiftForm) => {
    if (!isAdmin) return;
    setSaving(true);
    setFormError('');

    try {
      if (editingId) {
        await api.put(`/shifts/${editingId}`, data);
      } else {
        await api.post('/shifts', data);
      }
      await fetchShifts();
      closeForm();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setFormError(
        axiosErr.response?.data?.error ||
          (editingId ? 'Gagal memperbarui shift' : 'Gagal menambah shift'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus shift ini?')) return;

    try {
      await api.delete(`/shifts/${id}`);
      await fetchShifts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Gagal menghapus shift');
    }
  };

  const inputClasses = (hasError: boolean) =>
    `${hasError ? 'border-red-500' : ''} input`;

  return (
    <div>
      <Breadcrumb />
      <ShiftTabs />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Repeat className="h-6 w-6 text-blue-600" />
            Manajemen Shift
          </h1>
          <p className="text-gray-500 mt-1">
            Kelola shift kerja dan jadwalnya
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={formOpen ? closeForm : openAdd}
            className="btn btn-primary"
          >
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? 'Tutup Form' : 'Tambah Shift'}
          </button>
        )}
      </div>

      {/* Form tambah/edit shift */}
      {formOpen && isAdmin && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Shift' : 'Tambah Shift Baru'}
          </h3>

          {formError && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="name" className="label">
                Nama Shift
              </label>
              <input
                id="name"
                {...register('name')}
                className={inputClasses(!!errors.name)}
                placeholder="Shift Pagi"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="startTime" className="label">
                Jam Mulai
              </label>
              <input
                id="startTime"
                type="time"
                {...register('startTime')}
                className={inputClasses(!!errors.startTime)}
              />
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.startTime.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="endTime" className="label">
                Jam Selesai
              </label>
              <input
                id="endTime"
                type="time"
                {...register('endTime')}
                className={inputClasses(!!errors.endTime)}
              />
              {errors.endTime && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="btn btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Shift'}
            </button>
          </div>
        </form>
      )}

      {!isAdmin && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
          Anda login sebagai karyawan. Halaman ini hanya menampilkan daftar
          shift — pengelolaan dilakukan oleh Manajer / HR.
        </div>
      )}

      {/* Daftar shift */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          Belum ada shift. {isAdmin && 'Klik "Tambah Shift" untuk membuat shift pertama.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div key={shift.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {shift.name}
                </h3>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(shift)}
                      className="p-1.5 text-gray-500 hover:text-yellow-600 rounded-lg hover:bg-yellow-50"
                      title="Edit shift"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(shift.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Hapus shift"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-mono text-sm">
                  {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                </span>
              </div>
              <span className="badge badge-success">
                {formatTime(shift.startTime) <= '12:00' ? 'Pagi' : 'Sore'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}