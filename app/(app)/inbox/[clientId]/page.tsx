import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import type { ClientMessage } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const CLASSIFICATION_LABELS: Record<string, { text: string; className: string }> = {
  approved: { text: 'Aprobación', className: 'bg-emerald-100 text-emerald-700' },
  change_requested: { text: 'Cambio solicitado', className: 'bg-orange-100 text-orange-700' },
  rejected: { text: 'Rechazo', className: 'bg-red-100 text-red-600' },
  question: { text: 'Pregunta', className: 'bg-blue-100 text-blue-700' },
  unclear: { text: 'No claro', className: 'bg-slate-100 text-slate-500' },
};

export default async function ConversationPage({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();
  const { data: client } = await supabase
    .from('end_clients')
    .select('*')
    .eq('id', params.clientId)
    .single();
  if (!client) notFound();

  const { data: messages } = await supabase
    .from('client_messages')
    .select('*')
    .eq('end_client_id', params.clientId)
    .order('created_at', { ascending: true })
    .limit(500);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-xs text-slate-400">
          <Link href="/inbox" className="hover:text-indigo-600">
            Conversaciones
          </Link>{' '}
          /
        </p>
        <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {client.phone_whatsapp ?? 'Sin WhatsApp registrado'}
        </p>
      </div>

      {(messages ?? []).length === 0 ? (
        <div className="card px-8 py-16 text-center text-sm text-slate-500">
          Sin mensajes con este cliente todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {(messages as ClientMessage[]).map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            const classification = msg.classified_as
              ? CLASSIFICATION_LABELS[msg.classified_as]
              : null;
            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isOutbound
                      ? 'rounded-br-sm bg-indigo-600 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.raw_content}</p>
                  {msg.transcription && (
                    <p
                      className={`mt-2 border-t pt-2 text-xs italic ${
                        isOutbound
                          ? 'border-indigo-500 text-indigo-100'
                          : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      🎙 Transcripción: {msg.transcription}
                    </p>
                  )}
                  <div
                    className={`mt-1.5 flex items-center gap-2 text-[10px] ${
                      isOutbound ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatDateTime(msg.created_at)}</span>
                    <span className="uppercase">{msg.channel}</span>
                    {classification && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-medium ${classification.className}`}
                      >
                        {classification.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
