import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import type { EndClient } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const current = await getCurrentAgency();
  if (!current) redirect('/login');
  const supabase = createClient();

  const { data: clients } = await supabase
    .from('end_clients')
    .select('*')
    .eq('agency_id', current.agency.id)
    .order('created_at', { ascending: true });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Los negocios para los que Bitélica Briefs genera contenido cada semana
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      {(clients ?? []).length === 0 ? (
        <div className="card px-8 py-16 text-center">
          <p className="mb-6 text-sm text-slate-500">
            Aún no tienes clientes. El onboarding toma unos 15 minutos por cliente.
          </p>
          <Link href="/clients/new" className="btn-primary">
            Cargar mi primer cliente
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {(clients as EndClient[]).map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{client.name}</p>
                <p className="text-xs text-slate-400">
                  {[client.business_type, client.city].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{client.pieces_per_week} piezas/semana</span>
                {!client.active && (
                  <span className="badge bg-slate-100 text-slate-500">Inactivo</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
