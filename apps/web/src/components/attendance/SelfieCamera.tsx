'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Upload, Check, AlertCircle } from 'lucide-react';

interface SelfieCameraProps {
  photo: string | null;
  onCapture: (photoDataUrl: string) => void;
  onRetake: () => void;
  disabled?: boolean;
}

export default function SelfieCamera({
  photo,
  onCapture,
  onRetake,
  disabled = false,
}: SelfieCameraProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setIsStarting(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung. Silakan gunakan opsi upload.');
      }

      stopStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Camera access failed:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError('Izin akses kamera ditolak. Mohon izinkan kamera atau upload foto.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('Tidak ada kamera ditemukan pada perangkat ini.');
      } else {
        setCameraError(error.message || 'Gagal membuka kamera. Silakan gunakan tombol upload.');
      }
      stopStream();
    } finally {
      setIsStarting(false);
    }
  }, [stopStream]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image for front-facing natural look
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    onCapture(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError('File yang dipilih harus berupa gambar.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        stopStream();
        onCapture(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetakeClick = () => {
    onRetake();
    void startCamera();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label mb-0 flex items-center gap-1.5 font-semibold text-gray-800">
          <Camera className="h-4 w-4 text-blue-600" />
          Verifikasi Foto Selfie Presensi
          <span className="text-red-500">*</span>
        </label>
        {photo && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <Check className="h-3 w-3" />
            Foto Terverifikasi
          </span>
        )}
      </div>

      {/* When Photo is Already Captured */}
      {photo ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-gray-900 group aspect-video max-h-52 w-full flex items-center justify-center shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt="Selfie Presensi"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              disabled={disabled}
              onClick={handleRetakeClick}
              className="btn btn-secondary text-xs flex items-center gap-1.5 shadow-md"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Ambil Ulang Foto
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={handleRetakeClick}
            className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-medium px-2.5 py-1 rounded-md shadow flex items-center gap-1 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Ganti Foto
          </button>
        </div>
      ) : isCameraActive ? (
        /* Active Video Viewfinder */
        <div className="relative rounded-xl overflow-hidden border-2 border-blue-500 bg-black aspect-video max-h-56 w-full flex items-center justify-center shadow-sm">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover transform -scale-x-100"
          />
          {/* Oval face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-28 rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>

          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3 px-4">
            <button
              type="button"
              disabled={disabled}
              onClick={handleCapture}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <Camera className="h-4 w-4" />
              Potret Wajah
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={stopStream}
              className="bg-gray-800/80 hover:bg-gray-800 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : (
        /* Camera Start / Upload Placeholder */
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center bg-gray-50/70 hover:bg-gray-50 transition-colors">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-2.5">
            <Camera className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-gray-800">
            Wajib Ambil Foto Wajah (Selfie)
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs mx-auto">
            Foto digunakan untuk memastikan kehadiran fisik Anda di lokasi kerja secara nyata.
          </p>

          {cameraError && (
            <div className="mt-2.5 flex items-center justify-center gap-1 text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={disabled || isStarting}
              onClick={() => void startCamera()}
              className="btn btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3.5 shadow-sm"
            >
              <Camera className="h-3.5 w-3.5" />
              {isStarting ? 'Membuka Kamera...' : 'Buka Kamera Langsung'}
            </button>

            <span className="text-xs text-gray-400">atau</span>

            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <Upload className="h-3.5 w-3.5" />
              Pilih / Upload Foto
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
