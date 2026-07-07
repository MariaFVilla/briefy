import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import { BrandingForm } from '@/components/settings/branding-form';
import { WhatsappSettings } from '@/components/settings/whatsapp-settings';
import { FaqSettings } from '@/components/settings/faq-settings';
import type { FaqTemplate } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  founder: 'Founder',
};

export default async function SettingsPage() {
  const current = await getCurrentAgency();
  if (!current) redirect('/login');
  const { agency, member } = current;
  const supabase = createClient();

  const { data: faqs } = await supabase
    .from('faq_templates')
    .select('*')
    .eq('agency_id', agency.id)
    .order('created_at');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Branding, WhatsApp y FAQs de {agency.name}
        </p>
      </div>

      <BrandingForm
        initial={{
          name: agency.name,
          logo_url: agency.logo_url ?? '',
          brand_color: agency.brand_color,
          timezone: agency.timezone,
        }}
      />

      <WhatsappSettings
        status={agency.whatsapp_status}
        isOwner={member.role === 'owner'}
      />

      <FaqSettings faqs={(faqs ?? []) as FaqTemplate[]} />

      <section className="card p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Plan
        </h2>
        <p className="text-sm text-slate-700">
          Plan actual: <strong>{PLAN_LABELS[agency.plan] ?? agency.plan}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Para cambiar de plan, contacta a tu asesor de Briefy.
        </p>
      </section>
    </div>
  );
}
