'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

interface SettingsMapProps {
  lat: number;
  lng: number;
  radius: number;
  onMove: (lat: number, lng: number) => void;
}

function SettingsMapInner({ lat, lng, radius, onMove }: SettingsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      const center: [number, number] = [lat, lng];

      const map = L.map(mapRef.current).setView(center, 15);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      circleRef.current = L.circle(center, {
        radius,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'settings-pin-icon',
        html: '<div style="background-color: #dc2626; color: white; width: 26px; height: 26px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.25);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(45deg);"></div></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });

      markerRef.current = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.bindPopup('<strong>Lokasi</strong><br/>Geser atau klik untuk memindahkan');

      // Click on map -> move marker + circle
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const newLat = Number(e.latlng.lat.toFixed(6));
        const newLng = Number(e.latlng.lng.toFixed(6));
        markerRef.current.setLatLng([newLat, newLng]);
        circleRef.current.setLatLng([newLat, newLng]);
        onMove(newLat, newLng);
      });

      markerRef.current.on('dragend', () => {
        const position = markerRef.current.getLatLng();
        const newLat = Number(position.lat.toFixed(6));
        const newLng = Number(position.lng.toFixed(6));
        circleRef.current.setLatLng([newLat, newLng]);
        onMove(newLat, newLng);
      });
    };

    if (isMounted) {
      initMap();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(radius);
  }, [lat, lng, radius]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapRef} className="h-64 w-full" />
    </div>
  );
}

export default dynamic(() => Promise.resolve(SettingsMapInner), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});