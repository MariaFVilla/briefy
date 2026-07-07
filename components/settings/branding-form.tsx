'use client';

import { useState, useTransition } from 'react';
import { updateAgencyBranding } from '@/lib/actions/settings';

const TIMEZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Guayaquil',
  'America/Caracas',
  'America/Panama',
  'America/Montevideo',
  'America/La_Paz',
];

export function BrandingForm({
  initial,
}: {
  initial: { name: string; logo_url: string; brand_color: string; timezone: string };
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateAgencyBranding(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar');
      }
    });
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Branding
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Tu logo y color se usan en el link web de aprobación que ven tus clientes.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Nombre de la agencia</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">URL del logo</label>
            <input
              className="input"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://…/logo.png"
            />
          </div>
          <div>
            <label className="label">Color de marca</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                value={form.brand_color}
                onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
              />
              <input
                className="input flex-1"
                value={form.brand_color}
                onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Zona horaria</label>
            <select
              className="input"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar branding'}
        </button>
      </form>
    </section>
  );
}
