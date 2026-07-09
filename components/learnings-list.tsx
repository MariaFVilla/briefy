'use client';

import { useState, useTransition } from 'react';
import { toggleLearning, updateLearningText } from '@/lib/actions/clients';
import type { ClientLearning } from '@/lib/types/database';

const SOURCE_LABELS: Record<string, string> = {
  approval: 'de una aprobación',
  rejection: 'de un rechazo',
  comment: 'de un comentario',
};

export function LearningsList({ learnings }: { learnings: ClientLearning[] }) {
  if (learnings.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Todavía no hay learnings. Aparecerán automáticamente cuando el cliente responda a
        sus piezas.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {learnings.map((l) => (
        <LearningRow key={l.id} learning={l} />
      ))}
    </ul>
  );
}

function LearningRow({ learning }: { learning: ClientLearning }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(learning.learning_text);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleLearning(learning.id, !learning.active));
  }

  function handleSave() {
    if (!text.trim()) return;
    startTransition(async () => {
      await updateLearningText(learning.id, text.trim());
      setEditing(false);
    });
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        learning.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-2">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button onClick={handleSave} disabled={pending} className="btn-primary">
              Guardar
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-800">{learning.learning_text}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Aprendido {SOURCE_LABELS[learning.source] ?? ''} ·{' '}
              {new Date(learning.created_at).toLocaleDateString('es-419')}
            </p>
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-brand-600"
          >
            Editar
          </button>
          <button
            onClick={handleToggle}
            disabled={pending}
            className="text-slate-400 hover:text-brand-600"
          >
            {learning.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}
    </li>
  );
}
