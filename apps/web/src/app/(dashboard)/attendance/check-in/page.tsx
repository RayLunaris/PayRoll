'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import MapView from '@/components/attendance/MapView';
import SelfieCamera from '@/components/attendance/SelfieCamera';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  MapPin,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  Sparkles,
  RotateCcw,
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
  checkInPhotoUrl?: string | null;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function CheckInPage() {
  const user = useAuthStore((state) => state.user);
  const isDevOrAdmin = process.env.NODE_ENV === 'development' || user?.role === 'super_admin' || user?.role === 'hr_admin';

  const [gpsPosition, setGpsPosition] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const isSimulatedRef = useRef(false);
  isSimulatedRef.current = isSimulated;
  const bestPositionRef = useRef<GeolocationPosition | null>(null);

  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // Smart GPS tracking: Keep track of the best fix (lowest accuracy uncertainty)
  // so a poor fix (e.g. 25km GeoIP) doesn't overwrite a better fix,
  // while still updating if an equally good or better fix arrives.
  useEffect(() => {
    if (!navigator.geolocation) {
      Promise.resolve().then(() =>
        setGpsError('Perangkat tidak mendukung GPS.'),
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isSimulatedRef.current) return;

        const currentBest = bestPositionRef.current;
        // Accept new position if no current fix or if accuracy is acceptable/better
        if (!currentBest || pos.coords.accuracy <= currentBest.coords.accuracy * 1.5) {
          bestPositionRef.current = pos;
          setGpsPosition(pos);
        }
        setGpsError('');
      },
      () => {
        if (!isSimulatedRef.current && !bestPositionRef.current) {
          setGpsError('Tidak dapat mengakses lokasi. Mohon izinkan akses GPS.');
        }
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
        if (!isSimulatedRef.current) {
          bestPositionRef.current = pos;
          setGpsPosition(pos);
          setGpsError('');
        }
      },
      () => {
        if (!isSimulatedRef.current) {
          setGpsError('Tidak dapat mengakses lokasi. Mohon izinkan akses GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
  }, []);

  const handleSimulateLocation = (location: WorkLocation) => {
    const lat = typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude;
    const lng = typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    // Create a mock GeolocationPosition with high accuracy
    const mockPos: GeolocationPosition = {
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({ latitude: lat, longitude: lng, accuracy: 10 }),
      },
      timestamp: Date.now(),
      toJSON: () => ({ timestamp: Date.now() }),
    };

    setIsSimulated(true);
    setGpsPosition(mockPos);
    setSelectedLocation(location.id);
    setGpsError('');
    setError('');
  };

  const handleResetToRealGps = () => {
    setIsSimulated(false);
    bestPositionRef.current = null;
    retryGps();
  };

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
    if (!isSimulated && gpsPosition.coords.accuracy > 100) {
      setError(
        `Akurasi GPS (±${Math.round(
          gpsPosition.coords.accuracy
        )}m) tidak memenuhi syarat (wajib ≤ 100m). Browser mendeteksi IP/jaringan di kota lain. Silakan gunakan smartphone dengan GPS aktif atau hubungi admin.`
      );
      return;
    }
    if (!selfiePhoto) {
      setError('Wajib mengambil foto selfie presensi terlebih dahulu.');
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
        accuracy: gpsPosition.coords.accuracy,
        locationId: selectedLocation,
        photoUrl: selfiePhoto,
      });
      setSuccess('Check-in berhasil!');
      setTodayAttendance(res.data.data);
      setSelfiePhoto(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string; distance?: number; radius?: number } } };
      if (axiosErr.response?.status === 400 && axiosErr.response.data?.error === 'Outside work area') {
        const { distance, radius } = axiosErr.response.data;
        const distanceStr = distance && distance > 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
        setError(`Anda berada di luar area kerja (jarak: ${distanceStr} dari radius ${radius}m). Pastikan GPS Anda akurat.`);
      } else if (axiosErr.response?.status === 400 && axiosErr.response.data?.error === 'Low GPS accuracy') {
        setError(axiosErr.response.data.message || 'Akurasi GPS tidak memenuhi syarat (maksimal 100m).');
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
        accuracy: gpsPosition.coords.accuracy,
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

  const accuracy = gpsPosition?.coords?.accuracy ? Math.round(gpsPosition.coords.accuracy) : null;
  const isHighAccuracy = accuracy !== null && accuracy <= 100;
  const isMediumAccuracy = accuracy !== null && accuracy > 100 && accuracy <= 500;
  const isLowAccuracy = accuracy !== null && accuracy > 500;

  const selectedLocObj = workLocations.find((l) => l.id === selectedLocation);
  const distanceToSelected =
    selectedLocObj && gpsPosition
      ? calculateDistanceMeters(
          gpsPosition.coords.latitude,
          gpsPosition.coords.longitude,
          typeof selectedLocObj.latitude === 'string'
            ? parseFloat(selectedLocObj.latitude)
            : selectedLocObj.latitude,
          typeof selectedLocObj.longitude === 'string'
            ? parseFloat(selectedLocObj.longitude)
            : selectedLocObj.longitude,
        )
      : null;

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presensi Kehadiran</h1>
          <p className="text-gray-500 mt-1">Check-in menggunakan verifikasi lokasi GPS</p>
        </div>
        {isDevOrAdmin && (
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <Sparkles className="h-3.5 w-3.5" />
            Mode Dev / Admin
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Lokasi Anda</h3>
            {gpsPosition && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isSimulated
                    ? 'bg-purple-100 text-purple-700'
                    : isHighAccuracy
                    ? 'bg-emerald-100 text-emerald-700'
                    : isMediumAccuracy
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isSimulated
                  ? 'Lokasi Simulasi'
                  : isHighAccuracy
                  ? 'Akurasi Tinggi'
                  : isMediumAccuracy
                  ? 'Akurasi Sedang'
                  : 'Akurasi Rendah (GeoIP)'}
              </span>
            )}
          </div>

          <MapView
            userLocation={userMapLocation}
            userAccuracy={gpsPosition?.coords?.accuracy ?? null}
            workLocations={workLocations}
          />

          {gpsPosition && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {isSimulated ? 'Titik Simulasi Aktif' : 'Lokasi Terdeteksi'}
                    </p>
                    <p className="text-xs text-blue-600">
                      {gpsPosition.coords.latitude.toFixed(6)},{' '}
                      {gpsPosition.coords.longitude.toFixed(6)} (akurasi ±{accuracy}m)
                    </p>
                  </div>
                </div>
                {isSimulated ? (
                  <button
                    type="button"
                    onClick={handleResetToRealGps}
                    className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset GPS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={retryGps}
                    className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                )}
              </div>

              {/* Educational banner for Low Accuracy (e.g. laptop GeoIP detected in Kediri) */}
              {!isSimulated && isLowAccuracy && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Akurasi Rendah (±{accuracy}m) — Terdeteksi via Jaringan/IP (Kediri Node)</span>
                  </div>
                  <p className="text-amber-700 leading-relaxed">
                    Laptop/PC tidak memiliki sensor GPS satelit fisik. Browser membaca lokasi berdasarkan jaringan internet ISP yang memusatkan rute regional di Kediri.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-amber-800">
                    <span className="font-medium">💡 Saran:</span>
                    <span className="bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">Buka via browser HP (ada GPS)</span>
                    <span className="bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">Aktifkan Wi-Fi router kantor</span>
                    {isDevOrAdmin && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-medium">
                        Atau gunakan tombol Simulasi Pengujian di samping
                      </span>
                    )}
                  </div>
                </div>
              )}
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

                {todayAttendance.checkInPhotoUrl && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={todayAttendance.checkInPhotoUrl}
                      alt="Selfie Check-in"
                      className="w-14 h-14 object-cover rounded-lg border border-gray-300 shadow-xs shrink-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-gray-900">Foto Selfie Presensi</p>
                      <p className="text-gray-500">Terekam & terverifikasi saat check-in</p>
                    </div>
                  </div>
                )}

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
                {/* Dev/Admin Location Simulation Panel */}
                {isDevOrAdmin && workLocations.length > 0 && (
                  <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Simulasi Lokasi Pengujian (Dev / Admin)
                      </span>
                      {isSimulated && (
                        <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-semibold">
                          Simulasi Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-purple-700 leading-normal">
                      Klik kantor untuk menyetel koordinat pengujian tepat di lokasi kerja (menghindari hambatan GeoIP laptop):
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {workLocations.map((loc) => {
                        const isChosen = isSimulated && selectedLocation === loc.id;
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleSimulateLocation(loc)}
                            className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-all ${
                              isChosen
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-100/80'
                            }`}
                          >
                            📍 {loc.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selfie Verification */}
                <SelfieCamera
                  photo={selfiePhoto}
                  onCapture={(photoDataUrl) => {
                    setSelfiePhoto(photoDataUrl);
                    setError('');
                  }}
                  onRetake={() => setSelfiePhoto(null)}
                  disabled={isSubmitting}
                />

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

                {/* Real-time distance indicator */}
                {selectedLocObj && distanceToSelected !== null && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      distanceToSelected <= selectedLocObj.radiusMeters
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Info className="h-4 w-4 shrink-0" />
                      <span>
                        Jarak ke {selectedLocObj.name}:{' '}
                        <strong>
                          {distanceToSelected > 1000
                            ? `${(distanceToSelected / 1000).toFixed(1)} km`
                            : `${distanceToSelected} m`}
                        </strong>{' '}
                        (Radius izin: {selectedLocObj.radiusMeters}m)
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        distanceToSelected <= selectedLocObj.radiusMeters
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {distanceToSelected <= selectedLocObj.radiusMeters
                        ? 'Dalam Jangkauan'
                        : 'Di Luar Jangkauan'}
                    </span>
                  </div>
                )}

                {/* Strict Accuracy Enforcement Warning */}
                {!isSimulated && accuracy !== null && accuracy > 100 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1.5 text-red-900">
                    <div className="flex items-center gap-1.5 font-semibold text-red-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>Check-in Terkunci: Akurasi GPS Belum Memenuhi Syarat (±{accuracy}m)</span>
                    </div>
                    <p className="text-red-700 leading-relaxed">
                      Sistem mewajibkan akurasi GPS satelit ≤ 100m. Laptop tidak memiliki GPS fisik sehingga terdeteksi dari IP/jaringan di luar kota (Kediri).
                      Silakan buka halaman ini di browser HP untuk check-in, atau gunakan mode simulasi untuk pengujian.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCheckIn}
                  disabled={
                    isSubmitting ||
                    !gpsPosition ||
                    locationsLoading ||
                    !selectedLocation ||
                    !selfiePhoto ||
                    (!isSimulated && accuracy !== null && accuracy > 100) ||
                    !!locationsError
                  }
                  className="btn btn-primary w-full py-4 text-base"
                >
                  {isSubmitting
                    ? 'Memproses...'
                    : !selfiePhoto
                    ? 'Ambil Foto Selfie Dahulu'
                    : !isSimulated && accuracy !== null && accuracy > 100
                    ? 'GPS Tidak Memenuhi Syarat (Wajib ≤ 100m)'
                    : 'Check-in Sekarang'}
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