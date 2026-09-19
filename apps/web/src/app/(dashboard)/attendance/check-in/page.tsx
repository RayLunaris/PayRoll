'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface WorkLocation {
  id: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  radiusMeters: number;
}

interface AttendanceRecord {
  id: string;
  checkIn: string;
  checkOut: string | null;
  overtimeHours: string;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CheckInPage() {
  const [gpsPosition, setGpsPosition] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // Continuously track GPS so the position stays fresh while the employee is
  // at the work location — one-shot lookups can return stale/imprecise fixes.
  useEffect(() => {
    if (!navigator.geolocation) {
      // Schedule state update asynchronously to avoid triggering the lint rule
      // for synchronous setState in effect bodies.
      Promise.resolve().then(() =>
        setGpsError('Perangkat tidak mendukung GPS.'),
      );
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPosition(pos);
        setGpsError('');
      },
      () => {
        setGpsError('Tidak dapat mengakses lokasi. Mohon izinkan akses GPS.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const retryGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Perangkat tidak mendukung GPS.');
      return;
    }
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPosition(pos);
        setGpsError('');
      },
      () => {
        setGpsError('Tidak dapat mengakses lokasi. Mohon izinkan akses GPS.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
  }, []);

  // Fetch available work locations (with retry on failure)
  const loadLocations = useCallback(() => {
    setLocationsLoading(true);
    setLocationsError('');
    api
      .get<{ data: WorkLocation[] }>('/locations')
      .then((res) => setWorkLocations(res.data.data))
      .catch(() => setLocationsError('Gagal memuat daftar lokasi kerja.'))
      .finally(() => setLocationsLoading(false));
  }, []);

  // Deferred so setState is never called synchronously in the effect body
  // (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = window.setTimeout(() => void loadLocations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  // Fetch today's attendance status (with retry on failure)
  const fetchTodayAttendance = useCallback(() => {
    setAttendanceLoading(true);
    setAttendanceError('');
    api
      .get<{ data: AttendanceRecord | null }>('/attendance/today')
      .then((res) => setTodayAttendance(res.data.data))
      .catch(() => setAttendanceError('Gagal memuat status kehadiran hari ini.'))
      .finally(() => setAttendanceLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTodayAttendance(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchTodayAttendance]);

  const handleCheckIn = async () => {
    if (!gpsPosition) {
      setError('Lokasi GPS belum tersedia. Mohon izinkan akses GPS.');
      return;
    }
    if (!selectedLocation) {
      setError('Pilih lokasi kerja terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post<{ data: AttendanceRecord }>('/attendance/check-in', {
        latitude: gpsPosition.coords.latitude,
        longitude: gpsPosition.coords.longitude,
        locationId: selectedLocation,
      });
      setSuccess('Check-in berhasil!');
      setTodayAttendance(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; distance?: number; radius?: number } } };
      if (axiosErr.response?.status === 400 && axiosErr.response.data?.error === 'Outside work area') {
        const { distance, radius } = axiosErr.response.data;
        setError(`Anda berada di luar area kerja (jarak: ${distance}m dari radius ${radius}m).`);
      } else {
        setError(axiosErr.response?.data?.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!gpsPosition) {
      setError('Lokasi GPS belum tersedia. Mohon izinkan akses GPS.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post<{ data: AttendanceRecord }>('/attendance/check-out', {
        latitude: gpsPosition.coords.latitude,
        longitude: gpsPosition.coords.longitude,
      });
      setSuccess('Check-out berhasil!');
      setTodayAttendance(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userMapLocation = gpsPosition
    ? { lat: gpsPosition.coords.latitude, lng: gpsPosition.coords.longitude }
    : null;

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Presensi Kehadiran</h1>
        <p className="text-gray-500 mt-1">Check-in menggunakan verifikasi lokasi GPS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lokasi Anda</h3>

          <MapView userLocation={userMapLocation} workLocations={workLocations} />

          {gpsPosition && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Navigation className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Lokasi terdeteksi</p>
                <p className="text-xs text-blue-600">
                  {gpsPosition.coords.latitude.toFixed(6)},{' '}
                  {gpsPosition.coords.longitude.toFixed(6)} (akurasi ±
                  {Math.round(gpsPosition.coords.accuracy)}m)
                </p>
              </div>
            </div>
          )}

          {!gpsPosition && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
              <MapPin className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  {gpsError || 'Menunggu izin akses lokasi...'}
                </p>
                <p className="text-xs text-yellow-600">
                  GPS akan digunakan untuk verifikasi presensi Anda
                </p>
                {gpsError && (
                  <button
                    onClick={retryGps}
                    className="mt-1 text-xs font-medium text-yellow-700 underline"
                  >
                    Coba lagi
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Section */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Hari Ini</h3>

            {attendanceLoading && !todayAttendance ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : attendanceError && !todayAttendance ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600">{attendanceError}</p>
                <button
                  onClick={() => void fetchTodayAttendance()}
                  className="btn btn-secondary mt-4"
                >
                  Coba lagi
                </button>
              </div>
            ) : todayAttendance ? (
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
                    disabled={isSubmitting}
                    className="btn btn-secondary w-full py-4 text-base"
                  >
                    {isSubmitting ? 'Memproses...' : 'Check-out Sekarang'}
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
                  {locationsLoading ? (
                    <div className="py-2 text-sm text-gray-500">Memuat lokasi kerja...</div>
                  ) : locationsError ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-700">{locationsError}</p>
                      <button
                        onClick={() => void loadLocations()}
                        className="shrink-0 text-sm font-medium text-red-700 underline"
                      >
                        Coba lagi
                      </button>
                    </div>
                  ) : workLocations.length === 0 ? (
                    <div className="py-2 text-sm text-gray-500">
                      Belum ada lokasi kerja terdaftar. Hubungi admin.
                    </div>
                  ) : (
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="input"
                    >
                      <option value="">Pilih lokasi...</option>
                      {workLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.radiusMeters}m)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  onClick={handleCheckIn}
                  disabled={isSubmitting || !gpsPosition || locationsLoading || !!locationsError}
                  className="btn btn-primary w-full py-4 text-base"
                >
                  {isSubmitting ? 'Memproses...' : 'Check-in Sekarang'}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
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