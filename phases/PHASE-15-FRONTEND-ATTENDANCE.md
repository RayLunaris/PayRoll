# Phase 15: Frontend Attendance

**Objective:** Implementasi GPS check-in, riwayat kehadiran, dan laporan  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 14 selesai

---

## Tasks

### 15.1 Create Check-in Page

```bash
# src/app/(dashboard)/attendance/check-in/page.tsx
cat > src/app/(dashboard)/attendance/check-in/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import MapView from '@/components/attendance/MapView';
import api from '@/lib/api';
import {
  MapPin,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export default function CheckInPage() {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [todayAttendance, setTodayAttendance] = useState(null);

  // Get current position
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(pos),
        (err) => setError('Tidak dapat mengakses lokasi. Mohon izinkan akses GPS.')
      );
    }
  }, []);

  // Fetch work locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.get('/api/locations');
        setLocations(response.data.data);
      } catch (err) {
        console.error('Failed to fetch locations:', err);
      }
    };
    fetchLocations();
  }, []);

  // Fetch today's attendance
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const response = await api.get('/api/attendance/today');
        setTodayAttendance(response.data.data);
      } catch (err) {
        console.error('Failed to fetch today attendance:', err);
      }
    };
    fetchToday();
  }, []);

  const handleCheckIn = async () => {
    if (!location || !selectedLocation) {
      setError('Lokasi GPS dan lokasi kerja wajib dipilih.');
      return;
    }

    setCheckingIn(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/attendance/check-in', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        locationId: selectedLocation,
      });

      setSuccess('Check-in berhasil!');
      setTodayAttendance(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(err.response.data.error === 'Outside work area'
          ? `Anda berada di luar area kerja (jarak: ${err.response.data.distance}m dari radius ${err.response.data.radius}m)`
          : err.response.data.error);
      } else {
        setError('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!location) {
      setError('Lokasi GPS wajib diakses.');
      return;
    }

    setCheckingIn(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/attendance/check-out', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setSuccess('Check-out berhasil!');
      setTodayAttendance(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Presensi Kehadiran</h1>
        <p className="text-gray-500 mt-1">
          Check-in menggunakan verifikasi lokasi GPS
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Lokasi Anda
          </h3>

          <MapView
            userLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null}
            workLocations={locations}
          />

          {location && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Navigation className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Lokasi detected</p>
                <p className="text-xs text-blue-600">
                  {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Check-in Section */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Status Hari Ini
            </h3>

            {todayAttendance ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-900">Sudah Check-in</p>
                    <p className="text-xs text-emerald-600">{formatTime(todayAttendance.checkIn)}</p>
                  </div>
                </div>

                {todayAttendance.checkOut ? (
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Sudah Check-out</p>
                      <p className="text-xs text-red-600">{formatTime(todayAttendance.checkOut)}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={checkingIn}
                    className="btn btn-secondary w-full !py-4 !text-base"
                  >
                    {checkingIn ? 'Memproses...' : 'Check-out Sekarang'}
                  </button>
                )}

                {parseFloat(todayAttendance.overtimeHours) > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">Lembur</p>
                      <p className="text-xs text-yellow-600">{todayAttendance.overtimeHours} jam</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Pilih Lokasi Kerja</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="input"
                  >
                    <option value="">Pilih lokasi...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.radiusMeters}m)
                      </option>
                    ))}
                  </select>
                </div>

                {!location && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      Mohon izinkan akses lokasi untuk check-in
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || !location}
                  className="btn btn-primary w-full !py-4 !text-base"
                >
                  {checkingIn ? 'Memproses...' : 'Check-in Sekarang'}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Berhasil</p>
                <p className="text-xs text-emerald-600 mt-1">{success}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
EOF
```

### 15.2 Create Map View Component

```bash
# src/components/attendance/MapView.tsx
cat > src/components/attendance/MapView.tsx << 'EOF'
'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

interface MapViewProps {
  userLocation: { lat: number; lng: number } | null;
  workLocations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }>;
}

// Dynamic import for Leaflet (SSR compatible)
function MapViewInner({ userLocation, workLocations }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      
      // Initialize map
      const map = L.map(mapRef.current).setView([-6.2088, 106.8456], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Add work location circles
      workLocations.forEach((loc) => {
        L.circle([parseFloat(loc.latitude), parseFloat(loc.longitude)], {
          radius: loc.radiusMeters,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }).addTo(map).bindPopup(`${loc.name} (radius ${loc.radiusMeters}m)`);

        L.marker([parseFloat(loc.latitude), parseFloat(loc.longitude)])
          .addTo(map)
          .bindPopup(loc.name);
      });

      // Add user location marker
      if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(239,68,68,0.3);"></div>',
            iconSize: [16, 16],
          }),
        }).addTo(map).bindPopup('Lokasi Anda');

        map.setView([userLocation.lat, userLocation.lng], 15);
      }
    };

    if (isMounted) {
      // Need to import CSS for leaflet
      import('leaflet/dist/leaflet.css').then(() => {
        initMap();
      });
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation, workLocations]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapRef} className="h-64 w-full" />
    </div>
  );
}

export default dynamic(() => Promise.resolve(MapViewInner), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});
EOF
```

### 15.3 Create Attendance History Page

```bash
# src/app/(dashboard)/attendance/history/page.tsx
cat > src/app/(dashboard)/attendance/history/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { CalendarCheck, Clock } from 'lucide-react';

interface Attendance {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  overtimeHours: number;
}

const statusBadges: Record<string, { label: string; className: string }> = {
  present: { label: 'Hadir', className: 'badge badge-green' },
  late: { label: 'Terlambat', className: 'badge badge-yellow' },
  absent: { label: 'Absen', className: 'badge badge-red' },
  half_day: { label: 'Setengah Hari', className: 'badge badge-blue' },
  leave: { label: 'Cuti', className: 'badge badge-gray' },
};

export default function AttendanceHistoryPage() {
  const [history, setHistory] = useState<Attendance[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/api/attendance/history?${params.toString()}`);
      setHistory(response.data.data);
    } catch (error) {
      console.error('Failed to fetch attendance history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Kehadiran</h1>
          <p className="text-gray-500 mt-1">Riwayat presensi dan jam kerja Anda</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={fetchHistory} className="btn btn-primary">
            Filter
          </button>
        </div>
      </div>

      {/* History table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                  <th>Lembur</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {record.checkIn
                          ? new Date(record.checkIn).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </div>
                    </td>
                    <td>
                      {record.checkOut
                        ? new Date(record.checkOut).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td>
                      <span className={statusBadges[record.status]?.className}>
                        {statusBadges[record.status]?.label || record.status}
                      </span>
                    </td>
                    <td>
                      {parseFloat(record.overtimeHours) > 0
                        ? `${record.overtimeHours} jam`
                        : '-'}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Tidak ada data kehadiran
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

### 15.4 Create Attendance Report Page (HR)

```bash
# src/app/(dashboard)/attendance/report/page.tsx
cat > src/app/(dashboard)/attendance/report/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { FileText, Download, Building2 } from 'lucide-react';

export default function AttendanceReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (user && !['hr_admin', 'manager', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
    fetchDepartments();
  }, [user]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/attendance/report?month=${month}&year=${year}`);
      setReport(response.data.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // TODO: Export to Excel/PDF
    alert('Export functionality to be implemented');
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Kehadiran</h1>
          <p className="text-gray-500 mt-1">Rekapitulasi kehadiran karyawan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn btn-secondary">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="input"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="input"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchReport} className="btn btn-primary">
            <FileText className="h-4 w-4" />
            Tampilkan
          </button>
        </div>
      </div>

      {/* Report table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Total Hari</th>
                  <th>Hadir</th>
                  <th>Terlambat</th>
                  <th>Absen</th>
                  <th>Total Lembur</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{row.employeeId}</span>
                      </div>
                    </td>
                    <td>{row.totalDays}</td>
                    <td className="text-emerald-600">{row.presentDays}</td>
                    <td className="text-yellow-600">{row.lateDays}</td>
                    <td className="text-red-600">{row.absentDays}</td>
                    <td>{row.totalOvertime || 0} jam</td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      Belum ada data untuk periode ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] GPS location capture berfungsi
- [ ] Map menampilkan lokasi kerja
- [ ] Check-in menampilkan status
- [ ] Check-out berfungsi
- [ ] History table menampilkan data
- [ ] Filter tanggal bekerja
- [ ] Report page hanya HR/Manager yang bisa akses
- [ ] Error handling GPS ditampilkan

---

## Next Phase

Setelah Phase 15 selesai, lanjut ke:
**[Phase 16: Frontend Leave](./PHASE-16-FRONTEND-LEAVE.md)**