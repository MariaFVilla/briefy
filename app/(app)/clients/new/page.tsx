import { ClientForm } from '@/components/client-form';
import { QuickClientForm } from '@/components/quick-client-form';
import { createEndClient } from '@/lib/actions/clients';

export default function NewClientPage({
  searchParams,
}: {
  searchParams: { full?: string };
}) {
  // Onboarding exprés por defecto: 3 campos y contenido de muestra al instante.
  // El formulario completo queda disponible con ?full=1.
  if (searchParams.full) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Nuevo cliente — perfil completo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Completa el perfil una sola vez (~15 min). Cuanto más detalle, mejor será el
            contenido que genere Bitélica Briefs cada semana.
          </p>
        </div>
        <ClientForm onSubmit={createEndClient} submitLabel="Crear cliente" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          3 campos y en 2 minutos ves contenido real para este negocio. El perfil
          completo lo afinas después.
        </p>
      </div>
      <QuickClientForm />
    </div>
  );
}
