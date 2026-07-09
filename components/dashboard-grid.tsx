'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BatchStatusBadge } from '@/components/status-badge';
import type { ContentBatch, EndClient, Piece } from '@/lib/types/database';

export interface ClientCardData {
  client: EndClient;
  batch: ContentBatch | null;
  pieces: Piece[];
}

// Semáforo del batch: qué comunica cada tarjeta de cliente.
function batchSummary(pieces: Piece[]) {
  const clientApproved = pieces.filter(
    (p) => p.status === 'client_approved' || p.status === 'final'
  ).length;
  const withChanges = pieces.filter(
    (p) => p.status === 'changes_requested' || p.status === 'regenerating'
  ).length;
  const inReview = pieces.filter(
    (p) => p.status === 'draft' || p.status === 'internal_review'
  ).length;
  return { clientApproved, withChanges, inReview, total: pieces.length };
}

export function DashboardGrid({
  initialCards,
  weekStart,
}: {
  initialCards: ClientCardData[];
  weekStart: string;
}) {
  const router = useRouter();
  const [cards] = useState(initialCards);

  // Realtime: cualquier cambio en batches o piezas refresca la grilla.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pieces' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_batches' },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (cards.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
        <p className="mb-2 text-lg font-medium text-slate-900">
          Aún no tienes clientes
        </p>
        <p className="mb-6 max-w-md text-sm text-slate-500">
          Carga tu primer cliente final con su perfil completo y Bitélica Briefs generará su
          paquete de contenido semanal.
        </p>
        <Link href="/clients/new" className="btn-primary">
          Cargar mi primer cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ client, batch, pieces }) => {
        const summary = batchSummary(pieces);
        return (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="card group p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
                  {client.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[client.business_type, client.city].filter(Boolean).join(' · ') ||
                    'Sin descripción'}
                </p>
              </div>
              {!client.active && (
                <span className="badge bg-slate-100 text-slate-500">Inactivo</span>
              )}
            </div>

            {batch ? (
              <div className="space-y-2">
                <BatchStatusBadge status={batch.status} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    <strong className="text-emerald-600">{summary.clientApproved}</strong>{' '}
                    aprobadas
                  </span>
                  <span>
                    <strong className="text-orange-600">{summary.withChanges}</strong> con
                    cambios
                  </span>
                  <span>
                    <strong className="text-amber-600">{summary.inReview}</strong> en
                    revisión
                  </span>
                  <span className="text-slate-400">{summary.total} piezas</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Sin batch para la semana del {weekStart}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
