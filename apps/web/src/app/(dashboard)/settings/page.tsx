'use client';

import { useState } from 'react';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  User,
  KeyRound,
  Bell,
  Shield,
  HeartHandshake,
  ReceiptText,
  Clock,
  Building2,
  Briefcase,
  MapPin,
  Users,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Mail,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';

const roleLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  super_admin: { label: 'Super Admin', variant: 'default' },
  hr_admin: { label: 'HR Administrator', variant: 'default' },
  manager: { label: 'Manager / Supervisor', variant: 'secondary' },
  employee: { label: 'Karyawan', variant: 'outline' },
};

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'hr_admin' || user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'account' | 'payroll' | 'organization' | 'system'>('account');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ text: string; isError: boolean } | null>(null);

  // Notification preferences state
  const [emailPayslip, setEmailPayslip] = useState(true);
  const [emailLeave, setEmailLeave] = useState(true);
  const [emailAttendance, setEmailAttendance] = useState(true);
  const [savedPrefs, setSavedPrefs] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({ text: 'Password saat ini wajib diisi.', isError: true });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ text: 'Password baru minimal 8 karakter.', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ text: 'Konfirmasi password baru tidak cocok.', isError: true });
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/auth/password', {
        currentPassword,
        newPassword,
      });
      setPasswordStatus({ text: 'Password Anda berhasil diperbarui!', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setPasswordStatus({
        text: error?.response?.data?.error || 'Gagal mengubah password. Pastikan password lama sesuai.',
        isError: true,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 3000);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Pengaturan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola profil akun, preferensi keamanan, dan konfigurasi sistem PayrollPro
          </p>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <Badge variant={roleLabels[user.role]?.variant || 'outline'} className="text-xs px-3 py-1">
              {roleLabels[user.role]?.label || user.role}
            </Badge>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'account'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <User className="h-4 w-4" />
          Akun & Keamanan
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'payroll'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ReceiptText className="h-4 w-4" />
              Payroll & Finansial
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('organization')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'organization'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Kepegawaian & Lokasi
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'system'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="h-4 w-4" />
              Sistem & Pengguna
            </button>
          </>
        )}
      </div>

      {/* Tab: Akun & Keamanan */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Info Profil & Preferensi */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profil Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">Informasi Profil</CardTitle>
                      <CardDescription>Rincian akun pengguna yang sedang aktif</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aktif
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Email Akun</label>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {user?.email || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Hak Akses / Peran</label>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <Shield className="h-4 w-4 text-gray-400" />
                      {roleLabels[user?.role || '']?.label || user?.role || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">ID Karyawan</label>
                    <div className="mt-1 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      {user?.employeeId || 'Akun Administrasi / Tidak Tertaut'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Zona Waktu & Bahasa</label>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <Globe className="h-4 w-4 text-gray-400" />
                      WIB (UTC+7) / Bahasa Indonesia
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preferensi Notifikasi Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Preferensi Notifikasi</CardTitle>
                    <CardDescription>Sesuaikan notifikasi sistem dan pemberitahuan email</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Email Pemberitahuan Slip Gaji</p>
                      <p className="text-xs text-gray-500">Kirimkan salinan payslip otomatis saat penggajian dirilis</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailPayslip}
                      onChange={(e) => setEmailPayslip(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Status Pengajuan Cuti & Lembur</p>
                      <p className="text-xs text-gray-500">Dapatkan alert persetujuan atau penolakan pengajuan</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailLeave}
                      onChange={(e) => setEmailLeave(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Pengingat Jadwal & Absensi</p>
                      <p className="text-xs text-gray-500">Kirim pemberitahuan saat jam check-in mendekati batas toleransi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAttendance}
                      onChange={(e) => setEmailAttendance(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between bg-gray-50/50 rounded-b-xl border-t px-6 py-3">
                <span className="text-xs text-gray-500">
                  {savedPrefs ? 'Preferensi berhasil disimpan.' : 'Perubahan tersimpan secara lokal pada profil Anda.'}
                </span>
                <Button size="sm" onClick={handleSavePreferences} className="gap-1.5">
                  <Save className="h-4 w-4" />
                  Simpan Preferensi
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Kolom Kanan: Form Ubah Password */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Keamanan Sandi</CardTitle>
                    <CardDescription>Perbarui kata sandi akun Anda secara berkala</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <form onSubmit={handlePasswordSubmit}>
                <CardContent className="space-y-4">
                  {passwordStatus && (
                    <div
                      className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                        passwordStatus.isError
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}
                    >
                      {passwordStatus.isError ? (
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <span>{passwordStatus.text}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Password Saat Ini</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Password Baru</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Konfirmasi Password Baru</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      required
                    />
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button type="submit" disabled={savingPassword} className="w-full gap-2">
                    {savingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Ubah Password
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Quick Links untuk Navigasi Lain */}
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Bantuan & Pusat Informasi
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Jika Anda mengalami kendala terkait hak akses, perubahan data NIP, atau departemen, silakan hubungi tim HR Administrasi perusahaan.
                </p>
                <div className="pt-1">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    Kembali ke Dashboard Utama
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Konfigurasi Gaji & Payroll (Admin Only) */}
      {isAdmin && activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Konfigurasi Penggajian & Pajak</h2>
            <p className="text-sm text-gray-500">Atur skema potongan BPJS, regulasi perpajakan PPh 21, dan tarif upah lembur.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-blue-50 rounded-lg w-fit mb-2 text-primary">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">BPJS Kesehatan & Ketenagakerjaan</CardTitle>
                <CardDescription>
                  Atur persentase iuran perusahaan dan karyawan untuk JKK, JKM, JHT, JP, dan JKN.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/bpjs" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Atur BPJS</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-amber-50 rounded-lg w-fit mb-2 text-amber-600">
                  <ReceiptText className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Pajak Penghasilan (PPh 21)</CardTitle>
                <CardDescription>
                  Konfigurasi tarif progresif, batasan PTKP (Penghasilan Tidak Kena Pajak), dan kategori TER.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/tax" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Atur PPh 21</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-purple-50 rounded-lg w-fit mb-2 text-purple-600">
                  <Clock className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Tarif Lembur (Overtime)</CardTitle>
                <CardDescription>
                  Kelola pengali tarif upah lembur per jam kerja normal, hari libur istirahat, dan hari libur resmi.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/overtime" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Atur Lembur</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Kepegawaian & Lokasi (Admin Only) */}
      {isAdmin && activeTab === 'organization' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Struktur Kepegawaian & Lokasi Kantor</h2>
            <p className="text-sm text-gray-500">Kelola hierarki organisasi perusahaan, posisi pekerjaan, dan titik geofence absensi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-emerald-50 rounded-lg w-fit mb-2 text-emerald-600">
                  <Building2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Departemen & Divisi</CardTitle>
                <CardDescription>
                  Kelola struktur departemen, penanggung jawab divisi, dan pengelompokan karyawan.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/departments" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Kelola Departemen</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-blue-50 rounded-lg w-fit mb-2 text-blue-600">
                  <Briefcase className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Jabatan & Grade Posisi</CardTitle>
                <CardDescription>
                  Atur daftar jabatan, tingkat tanggung jawab, acuan gaji pokok, serta tunjangan per posisi.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/positions" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Kelola Jabatan</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-red-50 rounded-lg w-fit mb-2 text-red-600">
                  <MapPin className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Lokasi Kantor GPS</CardTitle>
                <CardDescription>
                  Tentukan koordinat latitude/longitude dan radius geofence absensi untuk masing-masing kantor/cabang.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/locations" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Kelola Lokasi</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Sistem & Pengguna (Admin Only) */}
      {isAdmin && activeTab === 'system' && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Manajemen Sistem & Keamanan Akses</h2>
            <p className="text-sm text-gray-500">Kelola akun pengguna terdaftar, peran akses, dan kebijakan keamanan monorepo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-slate-100 rounded-lg w-fit mb-2 text-slate-700">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Manajemen User & Akun</CardTitle>
                <CardDescription>
                  Kelola pendaftaran akun, aktivasi user, penugasan role, dan reset kata sandi pengguna.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/settings/users" className="w-full">
                  <Button variant="outline" className="w-full justify-between">
                    <span>Kelola Pengguna</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="p-2.5 bg-indigo-50 rounded-lg w-fit mb-2 text-indigo-600">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle className="text-base">Kebijakan Keamanan</CardTitle>
                <CardDescription>
                  Audit log keamanan autentikasi JWT token, perlindungan CSRF cookie, dan rate limiting gateway.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <div className="w-full flex items-center justify-between text-xs text-gray-500 bg-gray-50 py-2.5 px-3 rounded-md">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sistem Terlindungi
                  </span>
                  <span>JWT + Bcrypt</span>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}