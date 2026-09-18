'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Building2, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

export default function DepartmentSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDepartments = async () => {
    const response = await api.get<{ data: Department[] }>('/departments');
    setDepartments(response.data.data || []);
  };

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      try {
        await fetchDepartments();
      } catch (error) {
        console.error('Failed to fetch departments:', error);
          setError('Gagal memuat data. Coba muat ulang halaman.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (editDept) {
        await api.put(`/departments/${editDept.id}`, { name, description });
      } else {
        await api.post('/departments', { name, description });
      }

      setShowForm(false);
      setEditDept(null);
      setName('');
      setDescription('');
      setMessage('Departemen berhasil disimpan!');
      await fetchDepartments();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMessage(error?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus departemen ini?')) return;

    try {
      await api.delete(`/departments/${id}`);
      await fetchDepartments();
    } catch (error) {
      console.error('Failed to delete department:', error);
      setError('Gagal menghapus. Silakan coba lagi.');
    }
  };

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Manajemen Departemen
          </h1>
          <p className="text-gray-500 mt-1">Kelola struktur organisasi perusahaan</p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Tambah Departemen
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editDept ? 'Edit Departemen' : 'Tambah Departemen'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nama Departemen</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Engineering"
                required
              />
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={2}
                placeholder="Deskripsi departemen"
              />
            </div>
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {message}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditDept(null);
                  setName('');
                  setDescription('');
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{dept.description || 'Tidak ada deskripsi'}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => handleEdit(dept)} className="p-1.5 text-gray-400 hover:text-yellow-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleDelete(dept.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {departments.length === 0 && !loading && !error && (
          <div className="col-span-full card text-center py-8 text-gray-500">
            <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada departemen
          </div>
        )}
      </div>
    </div>
  );
}