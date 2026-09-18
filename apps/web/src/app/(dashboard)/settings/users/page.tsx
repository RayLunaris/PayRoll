'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Save,
  Loader2,
} from 'lucide-react';

interface ManagedUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  manager: 'Manager',
  employee: 'Employee',
};

const roleBadges: Record<string, string> = {
  super_admin: 'badge-danger',
  hr_admin: 'badge-info',
  manager: 'badge-warning',
  employee: 'badge-gray',
};

export default function UserManagementPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    const response = await api.get<{ data: ManagedUser[] }>('/auth/users');
    setUsers(response.data.data || []);
  };

  useEffect(() => {
    if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      try {
        await fetchUsers();
      } catch (error) {
        console.error('Failed to fetch users:', error);
          setError('Gagal memuat data. Coba muat ulang halaman.');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (editUser) {
        await api.put(`/auth/users/${editUser.id}/role`, { role });
        setMessage('Role berhasil diperbarui!');
      } else {
        await api.post('/auth/users', { email, password, role });
        setMessage('User berhasil dibuat!');
      }

      setShowForm(false);
      setEditUser(null);
      setEmail('');
      setPassword('');
      setRole('employee');
      await fetchUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMessage(error?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (user: ManagedUser) => {
    setEditUser(user);
    setRole(user.role);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus user ini? Aksi tidak dapat dibatalkan.')) return;

    try {
      await api.delete(`/auth/users/${id}`);
      await fetchUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMessage(error?.response?.data?.error || 'Gagal menghapus user');
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase()),
  );

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
            <Users className="h-6 w-6 text-blue-600" />
            Manajemen User
          </h1>
          <p className="text-gray-500 mt-1">Kelola akun dan role pengguna</p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Tambah User
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editUser ? 'Edit Role User' : 'Tambah User'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editUser ? (
              <div>
                <label className="label">Email</label>
                <p className="text-sm font-medium text-gray-700">{editUser.email}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="user@company.com"
                    required
                  />
                </div>
                <div>
                  <label className="label">Password (min. 6 karakter)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
                  setEditUser(null);
                  setEmail('');
                  setPassword('');
                  setRole('employee');
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari user..."
            className="input pl-9"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.email}
                  {currentUser?.id === u.id && (
                    <span className="ml-2 badge badge-info">Anda</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${roleBadges[u.role] || 'badge-gray'}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? 'badge-success' : 'badge-gray'}`}>
                    {u.isActive ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => handleEdit(u)}
                    disabled={currentUser?.id === u.id}
                    className="p-1.5 text-gray-400 hover:text-yellow-600 disabled:opacity-40"
                    title={currentUser?.id === u.id ? 'Tidak dapat mengubah role sendiri' : 'Ubah role'}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id)}
                    disabled={currentUser?.id === u.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-40"
                    title={currentUser?.id === u.id ? 'Tidak dapat menghapus akun sendiri' : 'Hapus user'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Tidak ada user ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}