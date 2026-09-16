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

function MapViewInner({ userLocation, workLocations }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      const map = L.map(mapRef.current).setView([-6.2088, 106.8456], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      workLocations.forEach((loc) => {
        L.circle([loc.latitude, loc.longitude], {
          radius: loc.radiusMeters,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`${loc.name} (radius ${loc.radiusMeters}m)`);

        L.marker([loc.latitude, loc.longitude]).addTo(map).bindPopup(loc.name);
      });

      if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(239,68,68,0.3);"></div>',
            iconSize: [16, 16],
          }),
        })
          .addTo(map)
          .bindPopup('Lokasi Anda');

        map.setView([userLocation.lat, userLocation.lng], 15);
      }
    };

    if (isMounted) {
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
