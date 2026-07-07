import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import { getWeekStart, formatDate } from '@/lib/utils';
import { DashboardGrid, type ClientCardData } from '@/components/dashboard-grid';
import type { ContentBatch, EndClient, Piece } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const current = await getCurrentAgency();
  if (!current) redirect('/login');
  const supabase = createClient();
  const weekStart = getWeekStart();

  const { data: clients } = await supabase
    .from('end_clients')
    .select('*')
    .eq('agency_id', current.agency.id)
    .order('created_at', { ascending: true });

  const clientIds = (clients ?? []).map((c) => c.id);
  let batches: ContentBatch[] = [];
  let pieces: Piece[] = [];
  if (clientIds.length > 0) {
    const { data: batchData } = await supabase
      .from('content_batches')
      .select('*')
      .in('end_client_id', clientIds)
      .eq('week_start', weekStart);
    batches = (batchData ?? []) as ContentBatch[];
    const batchIds = batches.map((b) => b.id);
    if (batchIds.length > 0) {
      const { data: pieceData } = await supabase
        .from('pieces')
        .select('*')
        .in('batch_id', batchIds);
      pieces = (pieceData ?? []) as Piece[];
    }
  }

  const cards: ClientCardData[] = ((clients ?? []) as EndClient[]).map((client) => {
    const batch = batches.find((b) => b.end_client_id === client.id) ?? null;
    const batchPieces = batch ? pieces.filter((p) => p.batch_id === batch.id) : [];
    return { client, batch, pieces: batchPieces };
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Semana del {formatDate(weekStart)} — {current.agency.name}
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          + Nuevo cliente
        </Link>
      </div>
      <DashboardGrid initialCards={cards} weekStart={weekStart} />
    </div>
  );
}
