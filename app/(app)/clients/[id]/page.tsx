import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getWeekStart, formatDate } from '@/lib/utils';
import { GenerateBatchButton } from '@/components/generate-batch-button';
import { LearningsList } from '@/components/learnings-list';
import { BatchStatusBadge } from '@/components/status-badge';
import type {
  ClientLearning,
  ClientProfile,
  ContentBatch,
  EndClient,
} from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: client } = await supabase
    .from('end_clients')
    .select('*, client_profiles(*)')
    .eq('id', params.id)
    .single();
  if (!client) notFound();

  const endClient = client as EndClient & { client_profiles: ClientProfile | null };
  const profile = endClient.client_profiles;

  const { data: learnings } = await supabase
    .from('client_learnings')
    .select('*')
    .eq('end_client_id', params.id)
    .order('created_at', { ascending: false });

  const { data: batches } = await supabase
    .from('content_batches')
    .select('*')
    .eq('end_client_id', params.id)
    .order('week_start', { ascending: false })
    .limit(6);

  const weekStart = getWeekStart();
  const currentBatch = (batches ?? []).find((b) => b.week_start === weekStart) ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            <Link href="/clients" className="hover:text-brand-600">
              Clientes
            </Link>{' '}
            /
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{endClient.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[endClient.business_type, endClient.city].filter(Boolean).join(' · ')} ·{' '}
            {endClient.pieces_per_week} piezas/semana
            {!endClient.active && ' · Inactivo'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/clients/${endClient.id}/edit`} className="btn-secondary">
            Editar perfil
          </Link>
          <GenerateBatchButton
            endClientId={endClient.id}
            hasCurrentBatch={!!currentBatch}
          />
        </div>
      </div>

      {/* Perfil incompleto (onboarding exprés): invitar a afinar */}
      {!profile?.target_audience && !profile?.tone && (
        <div className="card mb-6 flex items-center justify-between gap-4 border-brand-200 bg-brand-50/40 px-5 py-4">
          <p className="text-sm text-slate-700">
            <strong>Afina el perfil</strong> (audiencia, tono, palabras prohibidas) y el
            contenido va a sonar aún más a este negocio.
          </p>
          <Link href={`/clients/${endClient.id}/edit`} className="btn-primary shrink-0">
            Completar perfil
          </Link>
        </div>
      )}

      {/* Batch de la semana */}
      <section className="card mb-6 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Batch semanal
          </h2>
        </div>
        {currentBatch ? (
          <Link
            href={`/clients/${endClient.id}/batch`}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 transition hover:border-brand-300"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                Semana del {formatDate(currentBatch.week_start)}
              </p>
              <p className="text-xs text-slate-400">Ver piezas y aprobar →</p>
            </div>
            <BatchStatusBadge status={(currentBatch as ContentBatch).status} />
          </Link>
        ) : (
          <p className="text-sm text-slate-500">
            Sin batch para esta semana. Genera el paquete con el botón de arriba, o espera
            al cron del lunes.
          </p>
        )}
        {(batches ?? []).filter((b) => b.week_start !== weekStart).length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-slate-400">Semanas anteriores</p>
            {(batches as ContentBatch[])
              .filter((b) => b.week_start !== weekStart)
              .map((b) => (
                <Link
                  key={b.id}
                  href={`/clients/${endClient.id}/batch?week=${b.week_start}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span>Semana del {formatDate(b.week_start)}</span>
                  <BatchStatusBadge status={b.status} />
                </Link>
              ))}
          </div>
        )}
      </section>

      {/* Perfil */}
      <section className="card mb-6 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Perfil
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-2">
          <ProfileField label="Descripción" value={profile?.business_description} />
          <ProfileField label="Productos y servicios" value={profile?.products_services} />
          <ProfileField label="Audiencia" value={profile?.target_audience} />
          <ProfileField label="Tono" value={profile?.tone} />
          <ProfileField
            label="Palabras prohibidas"
            value={profile?.forbidden_words?.join(', ')}
          />
          <ProfileField
            label="Palabras preferidas"
            value={profile?.preferred_words?.join(', ')}
          />
          <ProfileField label="Referencias visuales" value={profile?.visual_references} />
          <ProfileField label="Objetivos" value={profile?.objectives} />
          <ProfileField
            label="Plataformas"
            value={profile?.platforms
              ?.map((p) => `${p.platform} (${p.formats.join(', ')})`)
              .join(' · ')}
          />
        </dl>
      </section>

      {/* Learnings acumulados — el moat */}
      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Learnings acumulados
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Lo que Bitélica Briefs aprendió de las respuestas de este cliente. Se aplican en cada
          generación. Puedes editarlos o desactivarlos.
        </p>
        <LearningsList learnings={(learnings ?? []) as ClientLearning[]} />
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs font-medium text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{value || '—'}</dd>
    </div>
  );
}
