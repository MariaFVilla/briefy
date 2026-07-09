'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createEndClientQuick } from '@/lib/actions/clients';
import type { Platform } from '@/lib/types/database';

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
];

export function QuickClientForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['instagram']);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (platforms.length === 0) {
      setError('Selecciona al menos una plataforma');
      return;
    }
    startTransition(async () => {
      try {
        await createEndClientQuick({ name, description, platforms });
      } catch (err) {
        if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err;
        setError(err instanceof Error ? err.message : 'Error al crear');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      <div>
        <label className="label">Nombre del negocio *</label>
        <input
          required
          autoFocus
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Restaurante La Esquina"
        />
      </div>

      <div>
        <label className="label">¿Qué hace y qué vende? *</label>
        <textarea
          required
          className="input min-h-28"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cuéntanos en tus palabras: qué vende, a quién, qué lo hace especial. Incluye precios o promos si quieres que se mencionen. Ej: 'Restaurante de comida de mar en Cartagena, familiar, famoso por la cazuela. Almuerzo ejecutivo $28.000 entre semana.'"
        />
        <p className="mt-1 text-xs text-slate-400">
          Con esto alcanza para la primera muestra. Después puedes afinar tono, audiencia
          y palabras prohibidas en el perfil completo.
        </p>
      </div>

      <div>
        <label className="label">¿Dónde publica?</label>
        <div className="flex gap-2">
          {PLATFORM_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                platforms.includes(opt.value)
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={platforms.includes(opt.value)}
                onChange={() => togglePlatform(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">
        {pending ? 'Creando y generando…' : '⚡ Crear cliente y generar contenido de muestra'}
      </button>

      <p className="text-center text-xs text-slate-400">
        ¿Prefieres cargar el perfil completo de una vez?{' '}
        <Link href="/clients/new?full=1" className="font-medium text-brand-600">
          Usar formulario completo
        </Link>
      </p>
    </form>
  );
}
