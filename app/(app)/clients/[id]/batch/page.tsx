import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getWeekStart, formatDate } from '@/lib/utils';
import { BatchStatusBadge } from '@/components/status-badge';
import { PieceCard } from '@/components/piece-card';
import { SendToClientButton } from '@/components/send-to-client-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { ApprovalLinkCard } from '@/components/approval-link-card';
import type {
  ContentBatch,
  EndClient,
  Piece,
  PieceVersion,
} from '@/lib/types/database';

export const dynamic = 'force-dynamic';
// Regenerar pieza / enviar por WhatsApp esperan Edge Functions de Supabase.
export const maxDuration = 60;

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { week?: string };
}) {
  const supabase = createClient();
  const { data: client } = await supabase
    .from('end_clients')
    .select('*, agencies(whatsapp_status)')
    .eq('id', params.id)
    .single();
  if (!client) notFound();
  const endClient = client as EndClient & { agencies: { whatsapp_status: string } };

  const weekStart = searchParams.week ?? getWeekStart();
  const { data: batch } = await supabase
    .from('content_batches')
    .select('*')
    .eq('end_client_id', params.id)
    .eq('week_start', weekStart)
    .maybeSingle();

  let pieces: Piece[] = [];
  let versions: PieceVersion[] = [];
  if (batch) {
    const { data: pieceData } = await supabase
      .from('pieces')
      .select('*')
      .eq('batch_id', batch.id)
      .order('position', { ascending: true });
    pieces = (pieceData ?? []) as Piece[];
    if (pieces.length > 0) {
      const { data: versionData } = await supabase
        .from('piece_versions')
        .select('*')
        .in('piece_id', pieces.map((p) => p.id))
        .order('version_number', { ascending: false });
      versions = (versionData ?? []) as PieceVersion[];
    }
  }

  const approvedCount = pieces.filter((p) => p.status === 'approved_internal').length;
  const whatsappConnected = endClient.agencies?.whatsapp_status === 'connected';

  // El link de aprobación se muestra de forma persistente en cuanto el batch
  // fue enviado (o hay piezas en manos del cliente) — nunca se pierde.
  const clientFacing = pieces.some((p) =>
    ['sent_to_client', 'client_approved', 'changes_requested', 'regenerating', 'final'].includes(
      p.status
    )
  );
  const batchSent = !!batch && (['sent', 'completed'].includes(batch.status) || clientFacing);
  const approveUrl = batchSent
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/approve/${
        (batch as ContentBatch).approval_token
      }`
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            <Link href="/clients" className="hover:text-indigo-600">
              Clientes
            </Link>{' '}
            /{' '}
            <Link href={`/clients/${params.id}`} className="hover:text-indigo-600">
              {endClient.name}
            </Link>{' '}
            /
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            Batch semana del {formatDate(weekStart)}
            {batch && <BatchStatusBadge status={(batch as ContentBatch).status} />}
          </h1>
        </div>
        {batch && approvedCount > 0 && (
          <SendToClientButton
            batchId={batch.id}
            approvedCount={approvedCount}
            whatsappConnected={whatsappConnected}
            clientHasPhone={!!endClient.phone_whatsapp}
          />
        )}
      </div>

      {/* Mientras el producer corre en Supabase, la página se refresca sola */}
      {(!batch || batch.status === 'generating') && <AutoRefresh />}

      {approveUrl && <ApprovalLinkCard approveUrl={approveUrl} />}

      {!batch ? (
        <div className="card px-8 py-16 text-center text-sm text-slate-500">
          No hay batch para esta semana todavía. Si acabas de generarlo, las piezas
          aparecerán aquí solas en 1-2 minutos.{' '}
          <Link href={`/clients/${params.id}`} className="text-indigo-600">
            Volver al perfil del cliente
          </Link>
        </div>
      ) : pieces.length === 0 ? (
        <div className="card px-8 py-16 text-center text-sm text-slate-500">
          ⏳ El batch se está generando… Las piezas aparecerán aquí solas en 1-2 minutos.
        </div>
      ) : (
        <div className="space-y-6">
          {pieces.map((piece) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              versions={versions.filter((v) => v.piece_id === piece.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
