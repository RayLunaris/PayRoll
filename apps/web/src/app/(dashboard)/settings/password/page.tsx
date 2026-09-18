'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { KeyRound, Save, Loader2, Eye, EyeOff } from 'lucide-react';

interface FormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePasswordPage() {
  const [form, setForm] = useState<FormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const handleChange = (field: keyof FormState, value: string) => {
    setForm({ ...form, [field]: value });
    setErrors({ ...errors, [field]: undefined });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.currentPassword) newErrors.currentPassword = 'Password saat ini wajib diisi';
    if (form.newPassword.length < 8) newErrors.newPassword = 'Password minimal 8 karakter';
    if (form.newPassword !== form.confirmPassword) newErrors.confirmPassword = 'Password tidak cocok';

    setErrors(newErrors);
    return Object.values(newErrors).every((err) => !err);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setMessage('');

    try {
      await api.put('/auth/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMessage('Password berhasil diubah!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMessage(error?.response?.data?.error || 'Gagal mengubah password');
    } finally {
      setSaving(false);
    }
  };

  const passwordField = (field: keyof FormState, label: string, placeholder: string) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={showPasswords ? 'text' : 'password'}
          value={form[field]}
          onChange={(e) => handleChange(field, e.target.value)}
          className={`input pr-10 ${errors[field] ? 'border-red-500' : ''}`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowPasswords(!showPasswords)}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {errors[field] && <p className="text-xs text-red-600 mt-1">{errors[field]}</p>}
    </div>
  );

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-blue-600" />
          Ubah Password
        </h1>
        <p className="text-gray-500 mt-1">Perbarui password untuk keamanan akun</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-md space-y-4">
        {passwordField('currentPassword', 'Password Saat Ini', 'Masukkan password lama')}
        {passwordField('newPassword', 'Password Baru', 'Minimal 8 karakter')}
        {passwordField('confirmPassword', 'Konfirmasi Password Baru', 'Ulangi password baru')}

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Ubah Password'}
        </button>
      </form>
    </div>
  );
}