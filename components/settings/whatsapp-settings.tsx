'use client';

import { useState, useTransition } from 'react';
import { markWhatsappConnected, saveD360ApiKey } from '@/lib/actions/settings';
import type { WhatsappStatus } from '@/lib/types/database';

const STATUS_INFO: Record<WhatsappStatus, { label: string; className: string }> = {
  none: { label: 'Sin conectar', className: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pendiente de verificación', className: 'bg-amber-100 text-amber-700' },
  connected: { label: 'Conectado ✓', className: 'bg-emerald-100 text-emerald-700' },
};

export function WhatsappSettings({
  status,
  isOwner,
}: {
  status: WhatsappStatus;
  isOwner: boolean;
}) {
  const [apiKey, setApiKey] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveD360ApiKey(apiKey.trim());
        setApiKey('');
        setMessage('API key guardada. Cuando 360dialog verifique tu número, marca la conexión como activa.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar');
      }
    });
  }

  function handleMarkConnected() {
    setError(null);
    startTransition(async () => {
      try {
        await markWhatsappConnected();
        setMessage('¡WhatsApp conectado! Ya puedes enviar piezas por este canal.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    });
  }

  const info = STATUS_INFO[status];

  return (
    <section className="card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          WhatsApp Business
        </h2>
        <span className={`badge ${info.className}`}>{info.label}</span>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Cada agencia conecta su propio número vía 360dialog. Mientras no esté verificado,
        puedes usar el link web de aprobación — el flujo es el mismo.
      </p>

      <ol className="mb-5 list-inside list-decimal space-y-1.5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <li>
          Crea una cuenta en{' '}
          <a
            href="https://hub.360dialog.com"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 underline"
          >
            hub.360dialog.com
          </a>{' '}
          y registra el número de WhatsApp de tu agencia.
        </li>
        <li>Genera tu <strong>API key</strong> en el hub de 360dialog.</li>
        <li>Pégala abajo (solo el owner de la agencia puede hacerlo).</li>
        <li>
          Configura el webhook de mensajes entrantes apuntando a{' '}
          <code className="rounded bg-slate-200 px-1 text-xs">
            https://TU-PROYECTO.supabase.co/functions/v1/messenger-webhook
          </code>
        </li>
        <li>Cuando 360dialog verifique el número, marca la conexión como activa.</li>
      </ol>

      {isOwner ? (
        <div className="space-y-4">
          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="password"
              className="input flex-1"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key de 360dialog"
            />
            <button type="submit" disabled={pending || !apiKey.trim()} className="btn-primary">
              Guardar key
            </button>
          </form>
          {status === 'pending' && (
            <button onClick={handleMarkConnected} disabled={pending} className="btn-secondary">
              ✓ Mi número ya fue verificado — activar conexión
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Solo el owner de la agencia puede configurar la conexión de WhatsApp.
        </p>
      )}

      {message && <p className="mt-3 text-xs text-emerald-600">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
