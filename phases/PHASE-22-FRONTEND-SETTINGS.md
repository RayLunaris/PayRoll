# Phase 22: Frontend Settings

**Objective:** Implementasi pengaturan sistem (BPJS, pajak, lembur, cuti, user management, audit log)
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 21 selesai

---

## Tasks

### 22.1 Create Settings Navigation Page

```bash
# src/app/(dashboard)/settings/page.tsx
cat > src/app/(dashboard)/settings/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import {
  Settings2, HeartHandshake, ReceiptText, Clock, CalendarDays,
  ShieldCheck, Users, LogOut, KeyRound, Building2, MapPin
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user]);

  const settingGroups = [
    {
      title: 'Konfigurasi Gaji',
      items: [
        { label: 'BPJS Kesehatan & Ketenagakerjaan', description: 'Atur persentase iuran BPJS', icon: HeartHandshake, href: '/settings/bpjs' },
        { label: 'Pajak (PPh 21)', description: 'Atur tarif pajak dan PTKP', icon: ReceiptText, href: '/settings/tax' },
        { label: 'Tarif Overtime', description: 'Atur tarif lembur per jam', icon: Clock, href: '/settings/overtime' },
      ],
    },
    {
      title: 'Kepegawaian',
      items: [
        { label: 'Konfigurasi Cuti', description: 'Atur kuota cuti default', icon: CalendarDays, href: '/settings/leave' },
        { label: 'Departemen & Jabatan', description: 'Kelola struktur organisasi', icon: Building2, href: '/settings/departments' },
        { label: 'Lokasi Perusahaan', description: 'Kelola lokasi absensi GPS', icon: MapPin, href: '/settings/locations' },
      ],
    },
    {
      title: 'Sistem & Keamanan',
      items: [
        { label: 'Manajemen User', description: 'Kelola akun dan role pengguna', icon: Users, href: '/settings/users' },
        { label: 'Audit Log', description: 'Riwayat aktivitas sistem', icon: ShieldCheck, href: '/settings/audit' },
        { label: 'Ubah Password', description: 'Perbarui password akun Anda', icon: KeyRound, href: '/settings/password' },
      ],
    },
  ];

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
EOF
```

### 22.2 Create BPJS Settings Page

```bash
# src/app/(dashboard)/settings/bpjs/page.tsx
cat > src/app/(dashboard)/settings/bpjs/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { HeartHandshake, Save, Loader2 } from 'lucide-react';

export default function BPJSSettingsPage() {
  const [config, setConfig] = useState({
    jkn: { employeeRate: 1, companyRate: 4 },
    jht: { employeeRate: 2, companyRate: 3.7 },
    jp: { employeeRate: 1, companyRate: 2 },
    jkk: { companyRate: 0.24 },
    jkm: { companyRate: 0.3 },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/settings/bpjs');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Failed to fetch BPJS config:', error);
    }
  };

  const handleChange = (section, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: Number(value) },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/api/settings/bpjs', config);
      setMessage('Konfigurasi BPJS berhasil disimpan!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'BPJS' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartHandshake className="h-6 w-6 text-emerald-600" />
          Konfigurasi BPJS
        </h1>
        <p className="text-gray-500 mt-1">Atur persentase iuran BPJS Kesehatan dan Ketenagakerjaan</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {/* BPJS Kesehatan (JKN) */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">BPJS Kesehatan (JKN)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Iuran Karyawan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jkn.employeeRate}
                onChange={(e) => handleChange('jkn', 'employeeRate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Iuran Perusahaan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jkn.companyRate}
                onChange={(e) => handleChange('jkn', 'companyRate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* BPJS Ketenagakerjaan */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Jaminan Hari Tua (JHT)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Iuran Karyawan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jht.employeeRate}
                onChange={(e) => handleChange('jht', 'employeeRate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Iuran Perusahaan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jht.companyRate}
                onChange={(e) => handleChange('jht', 'companyRate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Jaminan Pensiun (JP)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Iuran Karyawan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jp.employeeRate}
                onChange={(e) => handleChange('jp', 'employeeRate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Iuran Perusahaan (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jp.companyRate}
                onChange={(e) => handleChange('jp', 'companyRate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">JKK &amp; JKM (Ditanggung Perusahaan)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">JKK (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jkk.companyRate}
                onChange={(e) => handleChange('jkk', 'companyRate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">JKM (%)</label>
              <input
                type="number"
                step="0.01"
                value={config.jkm.companyRate}
                onChange={(e) => handleChange('jkm', 'companyRate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </form>
    </div>
  );
}
EOF
```

### 22.3 Create Tax (PPh 21) Settings Page

```bash
# src/app/(dashboard)/settings/tax/page.tsx
cat > src/app/(dashboard)/settings/tax/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { ReceiptText, Save, Plus, Trash2, Loader2 } from 'lucide-react';

const defaultBrackets = [
  { limit: 60000000, rate: 5 },
  { limit: 250000000, rate: 15 },
  { limit: 500000000, rate: 25 },
  { limit: 5000000000, rate: 30 },
  { limit: null, rate: 35 },
];

export default function TaxSettingsPage() {
  const [config, setConfig] = useState({
    ptkp: 54000000,
    brackets: defaultBrackets,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/settings/tax');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Failed to fetch tax config:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/api/settings/tax', config);
      setMessage('Konfigurasi pajak berhasil disimpan!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const addBracket = () => {
    setConfig((prev) => ({
      ...prev,
      brackets: [...prev.brackets, { limit: null, rate: 30 }],
    }));
  };

  const updateBracket = (index, field, value) => {
    const newBrackets = [...config.brackets];
    newBrackets[index] = { ...newBrackets[index], [field]: Number(value) };
    setConfig({ ...config, brackets: newBrackets });
  };

  const removeBracket = (index) => {
    const newBrackets = config.brackets.filter((_, i) => i !== index);
    setConfig({ ...config, brackets: newBrackets });
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Pajak PPh 21' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-orange-600" />
          Konfigurasi Pajak (PPh 21)
        </h1>
        <p className="text-gray-500 mt-1">Atur PTKP dan tarif progresif PPh 21</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Penghasilan Tidak Kena Pajak (PTKP)</h3>
          <div>
            <label className="label">PTKP per Tahun (Rp)</label>
            <input
              type="number"
              value={config.ptkp}
              onChange={(e) => setConfig({ ...config, ptkp: Number(e.target.value) })}
              className="input"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Default: Rp 54.000.000 (TK/0 - tidak kawin tanpa tanggungan)
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tarif Progresif (Lapisan)</h3>
            <button type="button" onClick={addBracket} className="btn btn-secondary !py-1 !text-xs">
              <Plus className="h-3 w-3" />
              Tambah Lapisan
            </button>
          </div>

          <div className="space-y-3">
            {config.brackets.map((bracket, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label">Batas Penghasilan (Rp/thn)</label>
                  <input
                    type="number"
                    value={bracket.limit ?? ''}
                    placeholder="Unlimited"
                    onChange={(e) => updateBracket(index, 'limit', e.target.value)}
                    className="input"
                  />
                </div>
                <div className="w-28">
                  <label className="label">Tarif (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={bracket.rate}
                    onChange={(e) => updateBracket(index, 'rate', e.target.value)}
                    className="input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeBracket(index)}
                  className="p-2 text-gray-400 hover:text-red-600"
                  title="Hapus lapisan"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </form>
    </div>
  );
}
EOF
```

### 22.4 Create Overtime & Leave Settings Pages

```bash
# src/app/(dashboard)/settings/overtime/page.tsx
cat > src/app/(dashboard)/settings/overtime/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Clock, Save, Loader2 } from 'lucide-react';

export default function OvertimeSettingsPage() {
  const [config, setConfig] = useState({
    weekdayRate: 1.5,
    holidayRate: 2,
    maxOvertimePerDay: 4,
    roundToMinutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/settings/overtime');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Failed to fetch overtime config:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/api/settings/overtime', config);
      setMessage('Konfigurasi lembur berhasil disimpan!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Tarif Lembur' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-orange-600" />
          Konfigurasi Lembur
        </h1>
        <p className="text-gray-500 mt-1">Atur tarif dan batas lembur karyawan</p>
      </div>

      <form onSubmit={handleSave} className="card max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tarif Hari Kerja (x gaji/jam)</label>
            <input
              type="number"
              step="0.1"
              value={config.weekdayRate}
              onChange={(e) => setConfig({ ...config, weekdayRate: Number(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Tarif Hari Libur (x gaji/jam)</label>
            <input
              type="number"
              step="0.1"
              value={config.holidayRate}
              onChange={(e) => setConfig({ ...config, holidayRate: Number(e.target.value) })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Maks Lembur per Hari (jam)</label>
            <input
              type="number"
              value={config.maxOvertimePerDay}
              onChange={(e) => setConfig({ ...config, maxOvertimePerDay: Number(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Pembulatan (menit)</label>
            <select
              value={config.roundToMinutes}
              onChange={(e) => setConfig({ ...config, roundToMinutes: Number(e.target.value) })}
              className="input"
            >
              <option value={15}>15 menit</option>
              <option value={30}>30 menit</option>
              <option value={60}>60 menit</option>
            </select>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </form>
    </div>
  );
}
EOF
```

```bash
# src/app/(dashboard)/settings/leave/page.tsx
cat > src/app/(dashboard)/settings/leave/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { CalendarDays, Save, Loader2, Plus, Trash2 } from 'lucide-react';

const leaveTypes = [
  { id: 'annual', label: 'Cuti Tahunan' },
  { id: 'sick', label: 'Cuti Sakit' },
  { id: 'maternity', label: 'Cuti Bersalin' },
  { id: 'paternity', label: 'Cuti Suami Istri' },
  { id: 'special', label: 'Cuti Khusus' },
];

export default function LeaveSettingsPage() {
  const [config, setConfig] = useState({
    quotas: {
      annual: 12,
      sick: 12,
      maternity: 90,
      paternity: 3,
      special: 5,
    },
    maxConsecutive: 15,
    requireApproval: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/api/settings/leave');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Failed to fetch leave config:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.put('/api/settings/leave', config);
      setMessage('Konfigurasi cuti berhasil disimpan!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Cuti' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-purple-600" />
          Konfigurasi Cuti
        </h1>
        <p className="text-gray-500 mt-1">Atur kuota cuti default untuk setiap jenis cuti</p>
      </div>

      <form onSubmit={handleSave} className="card max-w-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leaveTypes.map((type) => (
            <div key={type.id}>
              <label className="label">{type.label} (hari)</label>
              <input
                type="number"
                value={config.quotas[type.id]}
                onChange={(e) => setConfig({
                  ...config,
                  quotas: { ...config.quotas, [type.id]: Number(e.target.value) },
                })}
                className="input"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Maks Cuti Berturut-turut (hari)</label>
            <input
              type="number"
              value={config.maxConsecutive}
              onChange={(e) => setConfig({ ...config, maxConsecutive: Number(e.target.value) })}
              className="input"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.requireApproval}
                onChange={(e) => setConfig({ ...config, requireApproval: e.target.checked })}
                className="form-checkbox h-4 w-4"
              />
              <span className="text-sm text-gray-700">Wajib persetujuan atasan</span>
            </label>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </form>
    </div>
  );
}
EOF
```

### 22.5 Create Departments & Locations Settings Pages

```bash
# src/app/(dashboard)/settings/departments/page.tsx
cat > src/app/(dashboard)/settings/departments/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Building2, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react';

export default function DepartmentSettingsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (editDept) {
        await api.put(`/api/departments/${editDept.id}`, { name, description });
      } else {
        await api.post('/api/departments', { name, description });
      }
      
      setShowForm(false);
      setEditDept(null);
      setName('');
      setDescription('');
      setMessage('Departemen berhasil disimpan!');
      fetchDepartments();
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (dept) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus departemen ini?')) return;
    
    try {
      await api.delete(`/api/departments/${id}`);
      fetchDepartments();
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Departemen' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Manajemen Departemen
          </h1>
          <p className="text-gray-500 mt-1">Kelola struktur organisasi perusahaan</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
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
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
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
                onClick={() => { setShowForm(false); setEditDept(null); setName(''); setDescription(''); }}
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
                <button onClick={() => handleEdit(dept)} className="p-1.5 text-gray-400 hover:text-yellow-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(dept.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              {dept.employeeCount || 0} karyawan
            </div>
          </div>
        ))}

        {departments.length === 0 && !loading && (
          <div className="col-span-full card text-center py-8 text-gray-500">
            <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada departemen
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

```bash
# src/app/(dashboard)/settings/locations/page.tsx
cat > src/app/(dashboard)/settings/locations/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { MapPin, Plus, Pencil, Trash2, Save, Loader2, Target } from 'lucide-react';

// Dynamically import the map to avoid SSR issues
const MapView = dynamic(() => import('@/components/settings/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
      <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
    </div>
  ),
});

export default function LocationSettingsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState(-6.200000);
  const [lng, setLng] = useState(106.816666);
  const [radius, setRadius] = useState(100);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/api/locations');
      setLocations(response.data.data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const data = { name, latitude: lat, longitude: lng, radiusMeters: radius };
      
      if (editLoc) {
        await api.put(`/api/locations/${editLoc.id}`, data);
      } else {
        await api.post('/api/locations', data);
      }
      
      setShowForm(false);
      setEditLoc(null);
      setName('');
      setMessage('Lokasi berhasil disimpan!');
      fetchLocations();
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (loc) => {
    setEditLoc(loc);
    setName(loc.name);
    setLat(loc.latitude);
    setLng(loc.longitude);
    setRadius(loc.radiusMeters);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus lokasi ini?')) return;
    
    try {
      await api.delete(`/api/locations/${id}`);
      fetchLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Lokasi' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-red-600" />
            Lokasi Perusahaan
          </h1>
          <p className="text-gray-500 mt-1">Kelola lokasi yang valid untuk absensi GPS</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editLoc ? 'Edit Lokasi' : 'Tambah Lokasi'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Nama Lokasi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="e.g. Kantor Pusat"
                  required
                />
              </div>
              <div>
                <label className="label">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  className="input"
                  required
                />
              </div>
            </div>
            <div className="max-w-xs">
              <label className="label">Radius Absensi (meter)</label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="input"
                required
              />
            </div>

            {/* Map preview */}
            <MapView lat={lat} lng={lng} radius={radius} onMove={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }} />

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
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
                onClick={() => { setShowForm(false); setEditLoc(null); setName(''); }}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <div key={loc.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                  <p className="text-xs text-gray-500">
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(loc)} className="p-1.5 text-gray-400 hover:text-yellow-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(loc.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <Target className="h-3 w-3" />
              Radius {loc.radiusMeters} meter
            </div>
          </div>
        ))}

        {locations.length === 0 && !loading && (
          <div className="col-span-full card text-center py-8 text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada lokasi
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

```bash
# src/components/settings/MapView.tsx
'use client';

import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  lat: number;
  lng: number;
  radius: number;
  onMove: (lat: number, lng: number) => void;
}

function DraggableMarker({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  const icon = L.icon({
    iconUrl: '/images/marker-icon.svg',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          onMove(marker.getLatLng().lat, marker.getLatLng().lng);
        },
      }}
    />
  );
}

export default function MapView({ lat, lng, radius, onMove }: MapViewProps) {
  return (
    <div className="rounded-lg overflow-hidden h-64 border border-gray-200">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={[lat, lng]} radius={radius} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }} />
        <DraggableMarker lat={lat} lng={lng} onMove={onMove} />
      </MapContainer>
    </div>
  );
}
EOF
```

### 22.6 Create User Management & Audit Log Pages

```bash
# src/app/(dashboard)/settings/users/page.tsx
cat > src/app/(dashboard)/settings/users/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Users, Plus, Pencil, Trash2, ShieldCheck, Search, Save, Loader2 } from 'lucide-react';

const roleLabels = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  manager: 'Manager',
  employee: 'Employee',
};

const roleColors = {
  super_admin: 'badge-red',
  hr_admin: 'badge-blue',
  manager: 'badge-yellow',
  employee: 'badge-gray',
};

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users?limit=100');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (editUser) {
        await api.put(`/api/users/${editUser.id}/role`, { role });
        setMessage('Role berhasil diperbarui!');
      } else {
        await api.post('/api/users', { email, role });
        setMessage('User berhasil dibuat!');
      }
      
      setShowForm(false);
      setEditUser(null);
      setEmail('');
      setRole('employee');
      fetchUsers();
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus user ini?')) return;
    
    try {
      await api.delete(`/api/users/${id}`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Manajemen User' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Manajemen User
          </h1>
          <p className="text-gray-500 mt-1">Kelola akun dan role pengguna</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
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
            {!editUser && (
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
            )}
            {editUser && (
              <div>
                <label className="label">Email</label>
                <p className="text-sm font-medium text-gray-700">{editUser.email}</p>
              </div>
            )}
            <div>
              <label className="label">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
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
                onClick={() => { setShowForm(false); setEditUser(null); setEmail(''); setRole('employee'); }}
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

      <div className="table-container">
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
                <td className="font-medium">{u.email}</td>
                <td>
                  <span className={`badge ${roleColors[u.role]}`}>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {roleLabels[u.role]}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {u.isActive ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => {
                      setEditUser(u);
                      setRole(u.role);
                      setShowForm(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-yellow-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && !loading && (
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
EOF
```

```bash
# src/app/(dashboard)/settings/audit/page.tsx
cat > src/app/(dashboard)/settings/audit/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { ShieldCheck, Search, Loader2, UserCog, LogIn, FileText, Settings } from 'lucide-react';

const actionIcons = {
  login: LogIn,
  create: FileText,
  update: FileText,
  delete: FileText,
  settings: Settings,
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, search]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/audit-logs', {
        params: { page, limit: 20, search },
      });
      setLogs(response.data.data);
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Audit Log' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          Audit Log
        </h1>
        <p className="text-gray-500 mt-1">Riwayat aktivitas pengguna dalam sistem</p>
      </div>

      <div className="card mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari berdasarkan user atau aksi..."
            className="input pl-9"
          />
        </div>
      </div>

      <div className="card">
        <div className="divide-y divide-gray-100">
          {logs.map((log) => {
            const Icon = actionIcons[log.action] || Settings;
            return (
              <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
                <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                  <Icon className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{log.userEmail}</span>
                    <span className="text-gray-500"> melakukan </span>
                    <span className="font-medium capitalize">{log.action}</span>
                    <span className="text-gray-500"> pada </span>
                    <span className="font-medium">{log.entityType}</span>
                  </p>
                  {log.details && (
                    <p className="text-xs text-gray-400 mt-0.5">{log.details}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(log.createdAt)}</span>
              </div>
            );
          })}

          {logs.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              <ShieldCheck className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              Belum ada aktivitas
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn btn-secondary !py-1 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary !py-1 disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center pt-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
EOF
```

### 22.7 Create Change Password Page

```bash
# src/app/(dashboard)/settings/password/page.tsx
cat > src/app/(dashboard)/settings/password/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { KeyRound, Save, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
    setErrors({ ...errors, [field]: '' });
  };

  const validate = () => {
    const newErrors = {};
    
    if (!form.currentPassword) newErrors.currentPassword = 'Password saat ini wajib diisi';
    if (form.newPassword.length < 8) newErrors.newPassword = 'Password minimal 8 karakter';
    if (form.newPassword !== form.confirmPassword) newErrors.confirmPassword = 'Password tidak cocok';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setMessage('');

    try {
      await api.put('/api/auth/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMessage('Password berhasil diubah!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Gagal mengubah password');
    } finally {
      setSaving(false);
    }
  };

  const PasswordInput = ({ field, label, placeholder }: any) => (
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
      <Breadcrumb crumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Ubah Password' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-blue-600" />
          Ubah Password
        </h1>
        <p className="text-gray-500 mt-1">Perbarui password untuk keamanan akun</p>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-md space-y-4">
        <PasswordInput field="currentPassword" label="Password Saat Ini" placeholder="Masukkan password lama" />
        <PasswordInput field="newPassword" label="Password Baru" placeholder="Minimal 8 karakter" />
        <PasswordInput field="confirmPassword" label="Konfirmasi Password Baru" placeholder="Ulangi password baru" />

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
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
EOF
```

---

## Verification Checklist

- [ ] Halaman pengaturan dengan grouping cards
- [ ] Konfigurasi BPJS dapat disimpan
- [ ] Konfigurasi pajak dapat disimpan
- [ ] Konfigurasi tarif lembur dapat disimpan
- [ ] Konfigurasi kuota cuti dapat disimpan
- [ ] CRUD departemen
- [ ] CRUD lokasi dengan peta interaktif (Leaflet)
- [ ] Manajemen user (create, edit role, delete)
- [ ] Audit log dengan pencarian dan pagination
- [ ] Ubah password dengan validasi
- [ ] Semua halaman hanya untuk HR Admin / Super Admin

---

## Next Phase

Setelah Phase 22 selesai, lanjut ke:
**[Phase 23: Integrasi & Testing](./PHASE-23-INTEGRATION-TESTING.md)**