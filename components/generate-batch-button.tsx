'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateBatch } from '@/lib/actions/batch';

export function GenerateBatchButton({
  endClientId,
  hasCurrentBatch,
}: {
  endClientId: string;
  hasCurrentBatch: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        // La action responde de inmediato; la generación sigue en Supabase
        // y la pantalla del batch se auto-refresca hasta ver las piezas.
        await generateBatch(endClientId);
        router.push(`/clients/${endClientId}/batch`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al generar');
      }
    });
  }

  return (
    <div className="text-right">
      <button
        onClick={handleGenerate}
        disabled={pending || hasCurrentBatch}
        className="btn-primary"
        title={hasCurrentBatch ? 'Esta semana ya tiene batch' : undefined}
      >
        {pending ? 'Iniciando generación…' : '⚡ Generar batch semanal'}
      </button>
      {error && <p className="mt-2 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
