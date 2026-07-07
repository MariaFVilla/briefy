import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClientForm } from '@/components/client-form';
import { updateEndClient } from '@/lib/actions/clients';
import type { ClientProfile, EndClient } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('end_clients')
    .select('*, client_profiles(*)')
    .eq('id', params.id)
    .single();
  if (!data) notFound();

  const client = data as EndClient & { client_profiles: ClientProfile | null };
  const profile = client.client_profiles;

  async function handleUpdate(formData: Parameters<typeof updateEndClient>[1]) {
    'use server';
    await updateEndClient(params.id, formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Editar perfil</h1>
        <p className="mt-1 text-sm text-slate-500">{client.name}</p>
      </div>
      <ClientForm
        initialData={{
          name: client.name,
          business_type: client.business_type ?? '',
          city: client.city ?? '',
          phone_whatsapp: client.phone_whatsapp ?? '',
          pieces_per_week: client.pieces_per_week,
          business_description: profile?.business_description ?? '',
          products_services: profile?.products_services ?? '',
          target_audience: profile?.target_audience ?? '',
          tone: profile?.tone ?? '',
          forbidden_words: profile?.forbidden_words?.join(', ') ?? '',
          preferred_words: profile?.preferred_words?.join(', ') ?? '',
          visual_references: profile?.visual_references ?? '',
          platforms: profile?.platforms ?? [],
          objectives: profile?.objectives ?? '',
        }}
        onSubmit={handleUpdate}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
