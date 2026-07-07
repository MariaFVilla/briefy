// Vista pública de aprobación — la cara de la agencia ante SU cliente.
// Mobile-first, sin login, sin rastro de Briefy.
import { getBatchByToken } from '@/lib/actions/approve';
import { ApprovePieceCard } from '@/components/approve-piece-card';
import { formatDate } from '@/lib/utils';
import type { PublicBatchView } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { token: string } }) {
  try {
    const batch = (await getBatchByToken(params.token)) as PublicBatchView | null;
    return {
      title: batch ? `Contenido de la semana — ${batch.agency.name}` : 'Link no disponible',
    };
  } catch {
    return { title: 'Link no disponible' };
  }
}

export default async function ApprovePage({ params }: { params: { token: string } }) {
  let batch: PublicBatchView | null = null;
  try {
    batch = (await getBatchByToken(params.token)) as PublicBatchView | null;
  } catch {
    batch = null;
  }

  if (!batch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 text-4xl">🔗</p>
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Este link ya no está disponible
          </h1>
          <p className="text-sm text-slate-500">
            Puede haber expirado. Contacta a tu agencia para recibir uno nuevo.
          </p>
        </div>
      </div>
    );
  }

  const brandColor = batch.agency.brand_color || '#4f46e5';
  const pending = batch.pieces.filter((p) => p.status === 'sent_to_client');
  const done = batch.pieces.filter((p) => p.status !== 'sent_to_client');

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header con branding de la agencia */}
      <header className="px-5 pb-6 pt-8 text-white" style={{ backgroundColor: brandColor }}>
        <div className="mx-auto max-w-lg">
          <div className="mb-4 flex items-center gap-3">
            {batch.agency.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={batch.agency.logo_url}
                alt={batch.agency.name}
                className="h-10 w-10 rounded-lg bg-white/90 object-contain p-1"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-bold">
                {batch.agency.name.charAt(0)}
              </div>
            )}
            <p className="font-semibold">{batch.agency.name}</p>
          </div>
          <h1 className="text-xl font-bold leading-snug">
            ¡Hola! 👋 Este es el contenido de {batch.client_name} para la semana del{' '}
            {formatDate(batch.week_start)}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Revisa cada pieza y dinos si la apruebas o qué te gustaría cambiar.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-6">
        {batch.pieces.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aún no hay piezas para revisar. Vuelve pronto.
          </p>
        ) : (
          <>
            {pending.length > 0 && (
              <p className="text-sm font-medium text-slate-600">
                {pending.length} {pending.length === 1 ? 'pieza espera' : 'piezas esperan'} tu
                revisión
              </p>
            )}
            {[...pending, ...done].map((piece) => (
              <ApprovePieceCard
                key={piece.id}
                token={params.token}
                piece={piece}
                brandColor={brandColor}
              />
            ))}
            {pending.length === 0 && done.length > 0 && (
              <div className="rounded-xl bg-emerald-50 px-5 py-4 text-center text-sm text-emerald-700">
                🎉 ¡Ya revisaste todas las piezas! Gracias — el equipo queda al tanto.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
