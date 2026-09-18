'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import MapView from '@/components/settings/MapView';
import { MapPin, Plus, Pencil, Trash2, Save, Loader2, Target } from 'lucide-react';

interface WorkLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number | string;
  longitude: number | string;
  radiusMeters: number;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

const DEFAULT_LAT = -6.2;
const DEFAULT_LNG = 106.816666;

const toNumber = (value: number | string) => Number(value);

export default function LocationSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editLoc, setEditLoc] = useState<WorkLocation | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [radius, setRadius] = useState(100);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchLocations = async () => {
    const response = await api.get<{ data: WorkLocation[] }>('/locations');
    setLocations(response.data.data || []);
  };

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      try {
        await fetchLocations();
      } catch (error) {
        console.error('Failed to fetch locations:', error);
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
      const data = { name, address, latitude: lat, longitude: lng, radiusMeters: radius };

      if (editLoc) {
        await api.put(`/locations/${editLoc.id}`, data);
      } else {
        await api.post('/locations', data);
      }

      setShowForm(false);
      setEditLoc(null);
      setName('');
      setAddress('');
      setMessage('Lokasi berhasil disimpan!');
      await fetchLocations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMessage(error?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (loc: WorkLocation) => {
    setEditLoc(loc);
    setName(loc.name);
    setAddress(loc.address || '');
    setLat(toNumber(loc.latitude));
    setLng(toNumber(loc.longitude));
    setRadius(toNumber(loc.radiusMeters));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus lokasi ini?')) return;

    try {
      await api.delete(`/locations/${id}`);
      await fetchLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
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
            <MapPin className="h-6 w-6 text-red-600" />
            Lokasi Perusahaan
          </h1>
          <p className="text-gray-500 mt-1">Kelola lokasi yang valid untuk absensi GPS</p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="label">Alamat</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input"
                  placeholder="Alamat lengkap"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <label className="label">Radius Absensi (meter)</label>
                <input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="input"
                  required
                />
              </div>
            </div>

            <MapView lat={lat} lng={lng} radius={radius} onMove={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }} />

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
                  setEditLoc(null);
                  setName('');
                  setAddress('');
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
                    {toNumber(loc.latitude).toFixed(5)}, {toNumber(loc.longitude).toFixed(5)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => handleEdit(loc)} className="p-1.5 text-gray-400 hover:text-yellow-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleDelete(loc.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {loc.address && (
              <p className="mt-2 text-xs text-gray-500">{loc.address}</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <Target className="h-3 w-3" />
              Radius {toNumber(loc.radiusMeters)} meter
            </div>
          </div>
        ))}

        {locations.length === 0 && !loading && !error && (
          <div className="col-span-full card text-center py-8 text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            Belum ada lokasi
          </div>
        )}
      </div>
    </div>
  );
}