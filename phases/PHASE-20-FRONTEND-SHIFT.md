# Phase 20: Frontend Shift

**Objective:** Implementasi kalender shift, penugasan shift, dan swap  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 19 selesai

---

## Tasks

### 20.1 Create Shift Management Page

```bash
# src/app/(dashboard)/shift/page.tsx
cat > src/app/(dashboard)/shift/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Clock, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export default function ShiftPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const response = await api.get('/api/shifts');
      setShifts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user && ['hr_admin', 'super_admin'].includes(user.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = { name, startTime, endTime };

    try {
      if (editShift) {
        await api.put(`/api/shifts/${editShift.id}`, data);
      } else {
        await api.post('/api/shifts', data);
      }
      
      setShowForm(false);
      setEditShift(null);
      setName('');
      setStartTime('');
      setEndTime('');
      fetchShifts();
    } catch (error) {
      console.error('Failed to save shift:', error);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditShift(shift);
    setName(shift.name);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus shift ini?')) return;
    
    try {
      await api.delete(`/api/shifts/${id}`);
      fetchShifts();
    } catch (error) {
      console.error('Failed to delete shift:', error);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600" />
            Manajemen Shift
          </h1>
          <p className="text-gray-500 mt-1">Kelola jadwal shift kerja karyawan</p>
        </div>
        {isAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Tambah Shift
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && isAdmin && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editShift ? 'Edit Shift' : 'Tambah Shift Baru'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="label">Nama Shift</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Pagi"
                required
              />
            </div>
            <div>
              <label className="label">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Jam Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                {editShift ? 'Simpan' : 'Tambah'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditShift(null);
                  setName('');
                  setStartTime('');
                  setEndTime('');
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {shifts.map((shift) => (
          <div key={shift.id} className="card hover:shadow-card-hover transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{shift.name}</h3>
                  <p className="text-xs text-gray-500">
                    {shift.startTime} - {shift.endTime}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(shift)} className="p-1.5 text-gray-400 hover:text-yellow-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(shift.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Durasi kerja</span>
              <span className="text-sm font-medium">
                {shift.name === 'Malam'
                  ? '8 jam (semalam)'
                  : '8 jam'}
              </span>
            </div>
          </div>
        ))}

        {shifts.length === 0 && !loading && (
          <div className="col-span-full card text-center py-8 text-gray-500">
            <Clock className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada shift
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

### 20.2 Create Shift Calendar Page

```bash
# src/app/(dashboard)/shift/calendar/page.tsx
cat > src/app/(dashboard)/shift/calendar/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface EmployeeShift {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  shift?: { name: string; startTime: string; endTime: string };
}

const shiftColors: Record<string, string> = {
  Pagi: 'bg-blue-100 text-blue-800 border-blue-300',
  Siang: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Malam: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};

export default function ShiftCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<EmployeeShift[]>([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    try {
      const [shiftRes, assignRes] = await Promise.all([
        api.get('/api/shifts'),
        api.get(`/api/shifts/calendar?month=${month}&year=${year}`),
      ]);
      
      const shiftList = shiftRes.data.data;
      const shiftMap = {};
      shiftList.forEach((s) => { shiftMap[s.id] = s; });

      const assignmentsWithShift = assignRes.data.data.map((a) => ({
        ...a,
        shift: shiftMap[a.shiftId],
      }));

      setShifts(shiftList);
      setAssignments(assignmentsWithShift);
    } catch (error) {
      console.error('Failed to fetch shift data:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month - 1 + delta, 1));
  };

  // Generate calendar days
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const days = [];
  
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getAssignmentsForDay = (day: number) => {
    const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return assignments.filter((a) => a.date === date);
  };

  const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Kalender Shift
          </h1>
          <p className="text-gray-500 mt-1">Jadwal shift karyawan per bulan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="btn btn-secondary !p-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium text-gray-900 w-40 text-center">
            {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="btn btn-secondary !p-2">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {shifts.map((shift) => (
          <span key={shift.id} className={`badge border ${shiftColors[shift.name] || 'badge-gray'}`}>
            {shift.name} ({shift.startTime}-{shift.endTime})
          </span>
        ))}
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {weekdays.map((day) => (
            <div key={day} className="bg-gray-50 px-3 py-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="bg-white min-h-[80px]" />;
            }

            const dayAssignments = getAssignmentsForDay(day);
            const isToday = 
              new Date().getDate() === day && 
              new Date().getMonth() === month - 1 &&
              new Date().getFullYear() === year;

            return (
              <div
                key={day}
                className={`bg-white min-h-[80px] p-2 ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                <p className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                  {day}
                </p>
                <div className="space-y-1">
                  {dayAssignments.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        shiftColors[a.shift?.name] || 'bg-gray-100 text-gray-600'
                      } truncate`}
                      title={`Karyawan ${a.employeeId.slice(0, 8)}: ${a.shift?.name}`}
                    >
                      {a.shift?.name}
                    </div>
                  ))}
                  {dayAssignments.length > 3 && (
                    <p className="text-[10px] text-gray-400">+{dayAssignments.length - 3} lainnya</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
EOF
```

### 20.3 Create Shift Assignment Page

```bash
# src/app/(dashboard)/shift/assign/page.tsx
cat > src/app/(dashboard)/shift/assign/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CalendarClock, Save } from 'lucide-react';

export default function ShiftAssignmentPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [empRes, shiftRes] = await Promise.all([
        api.get('/api/employees?limit=100'),
        api.get('/api/shifts'),
      ]);
      setEmployees(empRes.data.data);
      setShifts(shiftRes.data.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api.post('/api/shifts/assign', {
        employeeId: selectedEmployee,
        shiftId: selectedShift,
        date,
      });
      setMessage('Shift berhasil ditugaskan!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-blue-600" />
          Penugasan Shift
        </h1>
        <p className="text-gray-500 mt-1">Tugaskan shift kerja ke karyawan</p>
      </div>

      <div className="card max-w-lg">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="label">Karyawan</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="input"
              required
            >
              <option value="">Pilih karyawan</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.nip})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="input"
              required
            >
              <option value="">Pilih shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime} - {shift.endTime})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary w-full">
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Penugasan'}
          </button>
        </form>
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] Shift list ditampilkan sebagai cards
- [ ] CRUD shift (HR only)
- [ ] Kalender shift per bulan
- [ ] Navigasi bulan bekerja
- [ ] Legend shift colors
- [ ] Penugasan shift ke karyawan
- [ ] Mobile responsive

---

## Next Phase

Setelah Phase 20 selesai, lanjut ke:
**[Phase 21: Frontend Reports](./PHASE-21-FRONTEND-REPORTS.md)**