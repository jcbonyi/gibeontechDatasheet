'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { compressImageDataUrl } from '../utils/compressImage';

interface PhotoUploadProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  datasheetId?: number;
}

/** Prefer server/object storage URL; fall back to compressed data URL. */
export function PhotoUpload({
  label,
  required,
  value,
  onChange,
  error,
  datasheetId,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (datasheetId) form.append('datasheetId', String(datasheetId));
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onChange(data.url);
          return;
        }
      }
      const compressed = await compressImageDataUrl(file);
      onChange(compressed);
    } catch {
      try {
        const compressed = await compressImageDataUrl(file);
        onChange(compressed);
      } catch {
        onChange('');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src={value} alt={label} className="h-44 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-red-600 shadow-md transition-transform hover:scale-105"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow transition-opacity group-hover:opacity-100"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 transition-all hover:border-brand-400 hover:bg-brand-50/40"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <ImagePlus className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            {uploading ? 'Uploading…' : 'Drop image or click to upload'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Stored securely · PNG/JPG · max 8MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="form-error">{error}</p>}
      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
        <Camera className="h-3 w-3" /> Field-friendly camera capture supported
      </p>
    </div>
  );
}
