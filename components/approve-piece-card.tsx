'use client';

import { useState, useTransition } from 'react';
import { respondToPieceByToken } from '@/lib/actions/approve';
import type { PublicBatchView } from '@/lib/types/database';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  client_approved: { text: '✅ Aprobada', className: 'bg-emerald-50 text-emerald-700' },
  changes_requested: {
    text: '✏️ Cambio solicitado — el equipo lo está ajustando',
    className: 'bg-amber-50 text-amber-700',
  },
  regenerating: {
    text: '✏️ El equipo está ajustando esta pieza',
    className: 'bg-amber-50 text-amber-700',
  },
  final: { text: '✅ Aprobada', className: 'bg-emerald-50 text-emerald-700' },
};

export function ApprovePieceCard({
  token,
  piece,
  brandColor,
}: {
  token: string;
  piece: PublicBatchView['pieces'][number];
  brandColor: string;
}) {
  const [pending, startTransition] = useTransition();
  const [showChange, setShowChange] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const awaiting = piece.status === 'sent_to_client';
  const statusInfo = STATUS_LABELS[piece.status];

  function respond(action: 'approve' | 'request_change') {
    setError(null);
    startTransition(async () => {
      try {
        await respondToPieceByToken(token, piece.id, action, comment || undefined);
        setShowChange(false);
        setComment('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error, intenta de nuevo');
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pieza {piece.position} · {PLATFORM_LABELS[piece.platform] ?? piece.platform} ·{' '}
          {piece.format}
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {piece.copy_text}
        </p>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        {awaiting ? (
          showChange ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                ¿Qué te gustaría cambiar?
              </label>
              <textarea
                className="input min-h-20"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Cuéntanos con tus palabras…"
                autoFocus
              />
              <div className="mt-3 flex gap-2">
                <button
                  disabled={pending || !comment.trim()}
                  onClick={() => respond('request_change')}
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-50"
                  style={{ backgroundColor: brandColor }}
                >
                  {pending ? 'Enviando…' : 'Enviar cambio'}
                </button>
                <button
                  onClick={() => setShowChange(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={() => respond('approve')}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {pending ? 'Enviando…' : '✓ Aprobar'}
              </button>
              <button
                disabled={pending}
                onClick={() => setShowChange(true)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ✏️ Pedir cambio
              </button>
            </div>
          )
        ) : (
          statusInfo && (
            <p className={`rounded-lg px-4 py-2.5 text-center text-sm ${statusInfo.className}`}>
              {statusInfo.text}
            </p>
          )
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
