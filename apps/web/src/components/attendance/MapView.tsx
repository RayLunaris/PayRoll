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

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [-6.2088, 106.8456];

      const map = L.map(mapRef.current).setView(defaultCenter, userLocation ? 15 : 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

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

      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'user-pin-icon',
          html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(239,68,68,0.35);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<strong>Lokasi Anda</strong>');
      }
    };

    if (isMounted) {
      initMap();
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
