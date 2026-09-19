'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

interface MapViewProps {
  userLocation: { lat: number; lng: number } | null;
  workLocations: Array<{
    id: string;
    name: string;
    latitude: number | string;
    longitude: number | string;
    radiusMeters: number;
  }>;
}

function MapViewInner({ userLocation, workLocations }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const locationsAddedRef = useRef(false);
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  // Create the map exactly once. GPS fixes stream in via watchPosition and the
  // location list loads on a separate request, so both are handled by their own
  // effects below instead of tearing the map down on every position tick.
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

      const start = userLocationRef.current;
      const defaultCenter: [number, number] = start
        ? [start.lat, start.lng]
        : [-6.2088, 106.8456];

      const map = L.map(mapRef.current).setView(defaultCenter, start ? 15 : 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (start) {
        const userIcon = L.divIcon({
          className: 'user-pin-icon',
          html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(239,68,68,0.35);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        userMarkerRef.current = L.marker([start.lat, start.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<strong>Lokasi Anda</strong>');
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      userMarkerRef.current = null;
      locationsAddedRef.current = false;
    };
  }, []);

  // Keep the user marker in sync with GPS fixes without rebuilding the map.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    const updateUserMarker = async () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        return;
      }
      const L = (await import('leaflet')).default;
      if (!mapInstanceRef.current) return;
      const userIcon = L.divIcon({
        className: 'user-pin-icon',
        html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(239,68,68,0.35);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Lokasi Anda</strong>');
    };

    void updateUserMarker();
  }, [userLocation]);

  // Draw work-location circles and pins once the (late-loaded) list arrives.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || workLocations.length === 0 || locationsAddedRef.current) return;

    const addLocations = async () => {
      const L = (await import('leaflet')).default;
      if (!mapInstanceRef.current || locationsAddedRef.current) return;
      locationsAddedRef.current = true;

      // Custom office icon to avoid broken image asset in Next.js Leaflet bundling
      const officeIcon = L.divIcon({
        className: 'office-pin-icon',
        html: `<div style="background-color: #2563eb; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
        </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      workLocations.forEach((loc) => {
        const lat = typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : loc.latitude;
        const lng = typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : loc.longitude;
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        L.circle([lat, lng], {
          radius: Number(loc.radiusMeters) || 100,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`<strong>${loc.name}</strong><br/>Radius: ${loc.radiusMeters}m`);

        L.marker([lat, lng], { icon: officeIcon })
          .addTo(map)
          .bindPopup(`<strong>${loc.name}</strong>`);
      });
    };

    void addLocations();
  }, [workLocations]);

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