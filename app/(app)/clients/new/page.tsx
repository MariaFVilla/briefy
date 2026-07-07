import { ClientForm } from '@/components/client-form';
import { createEndClient } from '@/lib/actions/clients';

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Completa el perfil una sola vez (~15 min). Cuanto más detalle, mejor será el
          contenido que genere Briefy cada semana.
        </p>
      </div>
      <ClientForm onSubmit={createEndClient} submitLabel="Crear cliente" />
    </div>
  );
}
