'use client';

import { useState, useTransition } from 'react';
import type { ClientFormData } from '@/lib/actions/clients';
import type { PieceFormat, Platform, PlatformConfig } from '@/lib/types/database';

const PLATFORM_FORMATS: Record<Platform, PieceFormat[]> = {
  instagram: ['post', 'carrusel', 'reel-guion', 'story'],
  facebook: ['post'],
  tiktok: ['guion'],
};

const FORMAT_LABELS: Record<PieceFormat, string> = {
  post: 'Post',
  carrusel: 'Carrusel',
  'reel-guion': 'Guion de Reel',
  story: 'Story',
  guion: 'Guion',
};

const EMPTY: ClientFormData = {
  name: '',
  business_type: '',
  city: '',
  phone_whatsapp: '',
  pieces_per_week: 5,
  business_description: '',
  products_services: '',
  target_audience: '',
  tone: '',
  forbidden_words: '',
  preferred_words: '',
  visual_references: '',
  platforms: [{ platform: 'instagram', formats: ['post', 'carrusel', 'story'] }],
  objectives: '',
};

export function ClientForm({
  initialData,
  onSubmit,
  submitLabel,
}: {
  initialData?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => Promise<void>;
  submitLabel: string;
}) {
  const [form, setForm] = useState<ClientFormData>({ ...EMPTY, ...initialData });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function togglePlatform(platform: Platform) {
    setForm((f) => {
      const exists = f.platforms.find((p) => p.platform === platform);
      if (exists) {
        return { ...f, platforms: f.platforms.filter((p) => p.platform !== platform) };
      }
      return {
        ...f,
        platforms: [...f.platforms, { platform, formats: [...PLATFORM_FORMATS[platform]] }],
      };
    });
  }

  function toggleFormat(platform: Platform, format: PieceFormat) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.map((p) => {
        if (p.platform !== platform) return p;
        const has = p.formats.includes(format);
        return {
          ...p,
          formats: has ? p.formats.filter((x) => x !== format) : [...p.formats, format],
        };
      }),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const platforms: PlatformConfig[] = form.platforms.filter((p) => p.formats.length > 0);
    if (platforms.length === 0) {
      setError('Selecciona al menos una plataforma con un formato');
      return;
    }
    startTransition(async () => {
      try {
        await onSubmit({ ...form, platforms });
      } catch (err) {
        // redirect() lanza internamente — no es un error real
        if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err;
        setError(err instanceof Error ? err.message : 'Error al guardar');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos del negocio
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Nombre del negocio *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ej: Restaurante La Esquina"
            />
          </div>
          <div>
            <label className="label">Tipo de negocio</label>
            <input
              className="input"
              value={form.business_type}
              onChange={(e) => set('business_type', e.target.value)}
              placeholder="Ej: restaurante, tienda de ropa, consultorio"
            />
          </div>
          <div>
            <label className="label">Ciudad</label>
            <input
              className="input"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Ej: Bogotá"
            />
          </div>
          <div>
            <label className="label">WhatsApp del cliente</label>
            <input
              className="input"
              value={form.phone_whatsapp}
              onChange={(e) => set('phone_whatsapp', e.target.value)}
              placeholder="+57 300 123 4567"
            />
          </div>
          <div>
            <label className="label">Piezas por semana (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={form.pieces_per_week}
              onChange={(e) => set('pieces_per_week', Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Perfil de contenido
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Descripción del negocio</label>
            <textarea
              className="input min-h-20"
              value={form.business_description}
              onChange={(e) => set('business_description', e.target.value)}
              placeholder="Qué hace el negocio, qué lo hace diferente, su historia…"
            />
          </div>
          <div>
            <label className="label">Productos y servicios</label>
            <textarea
              className="input min-h-20"
              value={form.products_services}
              onChange={(e) => set('products_services', e.target.value)}
              placeholder="Lista de productos/servicios con precios si quieres que se mencionen"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Audiencia objetivo</label>
              <textarea
                className="input min-h-16"
                value={form.target_audience}
                onChange={(e) => set('target_audience', e.target.value)}
                placeholder="Edad, intereses, cómo hablan…"
              />
            </div>
            <div>
              <label className="label">Tono de comunicación</label>
              <textarea
                className="input min-h-16"
                value={form.tone}
                onChange={(e) => set('tone', e.target.value)}
                placeholder="Ej: cercano, juvenil, con humor / profesional y confiable"
              />
            </div>
            <div>
              <label className="label">Palabras prohibidas (separadas por coma)</label>
              <input
                className="input"
                value={form.forbidden_words}
                onChange={(e) => set('forbidden_words', e.target.value)}
                placeholder="barato, oferta, …"
              />
            </div>
            <div>
              <label className="label">Palabras preferidas (separadas por coma)</label>
              <input
                className="input"
                value={form.preferred_words}
                onChange={(e) => set('preferred_words', e.target.value)}
                placeholder="artesanal, fresco, …"
              />
            </div>
          </div>
          <div>
            <label className="label">Referencias visuales de marca</label>
            <textarea
              className="input min-h-16"
              value={form.visual_references}
              onChange={(e) => set('visual_references', e.target.value)}
              placeholder="Colores de marca, estilo fotográfico, cuentas que le gustan…"
            />
          </div>
          <div>
            <label className="label">Objetivos de marketing</label>
            <textarea
              className="input min-h-16"
              value={form.objectives}
              onChange={(e) => set('objectives', e.target.value)}
              placeholder="Ej: más reservas entre semana, dar a conocer la nueva sede…"
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Plataformas y formatos
        </h2>
        <div className="space-y-4">
          {(Object.keys(PLATFORM_FORMATS) as Platform[]).map((platform) => {
            const config = form.platforms.find((p) => p.platform === platform);
            return (
              <div key={platform} className="rounded-lg border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={!!config}
                    onChange={() => togglePlatform(platform)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="capitalize">{platform}</span>
                </label>
                {config && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-6">
                    {PLATFORM_FORMATS[platform].map((format) => (
                      <label
                        key={format}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                          config.formats.includes(format)
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={config.formats.includes(format)}
                          onChange={() => toggleFormat(platform, format)}
                        />
                        {FORMAT_LABELS[format]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
