'use client';

import { useState, useTransition } from 'react';
import {
  approvePieceInternal,
  discardPiece,
  markPieceFinal,
  regeneratePieceWithInstruction,
  updatePieceContent,
} from '@/lib/actions/batch';
import { PieceStatusBadge } from '@/components/status-badge';
import {
  FORMAT_LABELS,
  OBJECTIVE_LABELS,
  PLATFORM_LABELS,
  type PieceObjective,
  type Piece,
  type PieceVersion,
} from '@/lib/types/database';

const OBJECTIVE_COLORS: Record<PieceObjective, string> = {
  alcance: 'bg-sky-100 text-sky-700',
  conexion: 'bg-violet-100 text-violet-700',
  venta: 'bg-emerald-100 text-emerald-700',
};

export function PieceCard({
  piece,
  versions,
}: {
  piece: Piece;
  versions: PieceVersion[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingCopy, setEditingCopy] = useState(false);
  const [copyDraft, setCopyDraft] = useState(piece.copy_text);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    });
  }

  const canApprove = ['draft', 'internal_review'].includes(piece.status);
  const canEdit = ['draft', 'internal_review', 'approved_internal'].includes(piece.status);
  const canMarkFinal = piece.status === 'client_approved';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            Pieza {piece.position} — {PLATFORM_LABELS[piece.platform] ?? piece.platform} ·{' '}
            {FORMAT_LABELS[piece.format] ?? piece.format}
          </span>
          {piece.objective && (
            <span className={`badge ${OBJECTIVE_COLORS[piece.objective]}`}>
              🎯 {OBJECTIVE_LABELS[piece.objective]}
            </span>
          )}
          <PieceStatusBadge status={piece.status} />
        </div>
        {versions.length > 0 && (
          <button
            onClick={() => setShowVersions((v) => !v)}
            className="text-xs text-slate-400 hover:text-brand-600"
          >
            {showVersions ? 'Ocultar historial' : `Historial (${versions.length})`}
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Copy editable inline */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Copy
            </p>
            {canEdit && !editingCopy && (
              <button
                onClick={() => {
                  setCopyDraft(piece.copy_text);
                  setEditingCopy(true);
                }}
                className="text-xs text-slate-400 hover:text-brand-600"
              >
                Editar
              </button>
            )}
          </div>
          {editingCopy ? (
            <div>
              <textarea
                className="input min-h-40 font-mono text-sm"
                value={copyDraft}
                onChange={(e) => setCopyDraft(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      await updatePieceContent(piece.id, { copy_text: copyDraft });
                      setEditingCopy(false);
                    })
                  }
                  className="btn-primary"
                >
                  Guardar
                </button>
                <button onClick={() => setEditingCopy(false)} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-800">
              {piece.copy_text}
            </p>
          )}
        </div>

        {/* Brief visual */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Brief visual (para el diseñador)
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600">
            {piece.visual_brief}
          </p>
        </div>

        {/* Argumento estratégico */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Por qué funciona
          </p>
          <p className="whitespace-pre-wrap text-sm italic text-slate-500">
            {piece.strategic_argument}
          </p>
        </div>

        {/* Historial de versiones */}
        {showVersions && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 text-xs font-semibold text-slate-500">
              Historial de versiones
            </p>
            <ul className="space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="text-xs text-slate-500">
                  <p className="font-medium text-slate-600">
                    v{v.version_number} — {v.change_reason ?? 'edición'} ·{' '}
                    {new Date(v.created_at).toLocaleString('es-419')}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{v.copy_text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Regenerar con instrucción */}
        {showRegenerate && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4">
            <label className="label">¿Qué debe cambiar?</label>
            <textarea
              className="input min-h-16"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='Ej: "hazlo más corto y menciona el 2x1 de los martes"'
            />
            <div className="mt-2 flex gap-2">
              <button
                disabled={pending || !instruction.trim()}
                onClick={() =>
                  run(async () => {
                    await regeneratePieceWithInstruction(piece.id, instruction);
                    setInstruction('');
                    setShowRegenerate(false);
                  })
                }
                className="btn-primary"
              >
                {pending ? 'Regenerando…' : 'Regenerar pieza'}
              </button>
              <button onClick={() => setShowRegenerate(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {canApprove && (
            <button
              disabled={pending}
              onClick={() => run(() => approvePieceInternal(piece.id))}
              className="btn-primary"
            >
              ✓ Aprobar internamente
            </button>
          )}
          {canEdit && (
            <button
              disabled={pending}
              onClick={() => setShowRegenerate((v) => !v)}
              className="btn-secondary"
            >
              ↻ Regenerar con instrucción
            </button>
          )}
          {canEdit && (
            <button
              disabled={pending}
              onClick={() => run(() => discardPiece(piece.id))}
              className="btn-danger"
            >
              Descartar
            </button>
          )}
          {canMarkFinal && (
            <button
              disabled={pending}
              onClick={() => run(() => markPieceFinal(piece.id))}
              className="btn-primary"
            >
              Marcar como final
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
