'use client';

import { useState, useTransition } from 'react';
import { createFaq, deleteFaq, toggleFaq } from '@/lib/actions/settings';
import type { FaqTemplate } from '@/lib/types/database';

export function FaqSettings({ faqs }: { faqs: FaqTemplate[] }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createFaq({ question_pattern: question.trim(), answer_template: answer.trim() });
        setQuestion('');
        setAnswer('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      }
    });
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        FAQs del Mensajero
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Cuando un cliente pregunta algo que coincide con una FAQ, el Mensajero responde
        automáticamente con tu plantilla. Cualquier otra pregunta se escala a tu equipo.
        Usa <code className="rounded bg-slate-100 px-1">{'{argumento}'}</code> para insertar
        el argumento estratégico de la pieza.
      </p>

      {faqs.length > 0 && (
        <ul className="mb-5 space-y-2">
          {faqs.map((faq) => (
            <FaqRow key={faq.id} faq={faq} />
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-lg bg-slate-50 p-4">
        <div>
          <label className="label">Patrón de pregunta</label>
          <input
            required
            className="input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='Ej: "¿por qué este contenido / esta idea?"'
          />
        </div>
        <div>
          <label className="label">Respuesta</label>
          <textarea
            required
            className="input min-h-16"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Ej: ¡Buena pregunta! La pensamos así: {argumento}"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary">
          + Agregar FAQ
        </button>
      </form>
    </section>
  );
}

function FaqRow({ faq }: { faq: FaqTemplate }) {
  const [pending, startTransition] = useTransition();
  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${
        faq.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
      }`}
    >
      <div className="min-w-0 text-sm">
        <p className="font-medium text-slate-800">{faq.question_pattern}</p>
        <p className="mt-0.5 text-xs text-slate-500">{faq.answer_template}</p>
      </div>
      <div className="flex shrink-0 gap-2 text-xs">
        <button
          disabled={pending}
          onClick={() => startTransition(() => toggleFaq(faq.id, !faq.active))}
          className="text-slate-400 hover:text-brand-600"
        >
          {faq.active ? 'Desactivar' : 'Activar'}
        </button>
        <button
          disabled={pending}
          onClick={() => startTransition(() => deleteFaq(faq.id))}
          className="text-slate-400 hover:text-red-600"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}
