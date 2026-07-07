import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import { formatDateTime } from '@/lib/utils';
import type { ClientMessage, EndClient } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const current = await getCurrentAgency();
  if (!current) redirect('/login');
  const supabase = createClient();

  const { data: clients } = await supabase
    .from('end_clients')
    .select('*')
    .eq('agency_id', current.agency.id)
    .order('created_at');
  const clientIds = (clients ?? []).map((c) => c.id);

  let messages: ClientMessage[] = [];
  const alerts: { changes: number; escalated: number } = { changes: 0, escalated: 0 };
  if (clientIds.length > 0) {
    const { data: msgData } = await supabase
      .from('client_messages')
      .select('*')
      .in('end_client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(500);
    messages = (msgData ?? []) as ClientMessage[];

    const { data: changePieces } = await supabase
      .from('pieces')
      .select('id, content_batches!inner(end_client_id)')
      .eq('status', 'changes_requested');
    alerts.changes = (changePieces ?? []).filter((p) => {
      const b = p.content_batches as unknown as { end_client_id: string };
      return clientIds.includes(b.end_client_id);
    }).length;
    alerts.escalated = messages.filter(
      (m) => m.direction === 'inbound' && m.classified_as === 'question'
    ).length;
  }

  const byClient = (clients ?? []).map((client) => {
    const clientMessages = messages.filter((m) => m.end_client_id === client.id);
    return { client: client as EndClient, lastMessage: clientMessages[0] ?? null, count: clientMessages.length };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Conversaciones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Historial de mensajes con tus clientes finales
        </p>
      </div>

      {(alerts.changes > 0 || alerts.escalated > 0) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          ⚠️ Requieren atención:{' '}
          {alerts.changes > 0 && <strong>{alerts.changes} piezas con cambios solicitados</strong>}
          {alerts.changes > 0 && alerts.escalated > 0 && ' · '}
          {alerts.escalated > 0 && <strong>{alerts.escalated} preguntas escaladas</strong>}
        </div>
      )}

      {byClient.length === 0 ? (
        <div className="card px-8 py-16 text-center text-sm text-slate-500">
          Aún no hay clientes. Las conversaciones aparecerán aquí cuando envíes piezas.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {byClient.map(({ client, lastMessage, count }) => (
            <Link
              key={client.id}
              href={`/inbox/${client.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{client.name}</p>
                {lastMessage ? (
                  <p className="truncate text-xs text-slate-500">
                    {lastMessage.direction === 'outbound' ? 'Tú: ' : ''}
                    {lastMessage.transcription ?? lastMessage.raw_content}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Sin mensajes todavía</p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-slate-400">
                {lastMessage && <p>{formatDateTime(lastMessage.created_at)}</p>}
                <p>{count} mensajes</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
