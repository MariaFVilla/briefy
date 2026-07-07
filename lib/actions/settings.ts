'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';

export async function updateAgencyBranding(data: {
  name: string;
  logo_url: string;
  brand_color: string;
  timezone: string;
}) {
  const current = await getCurrentAgency();
  if (!current) throw new Error('Sin sesión');
  const supabase = createClient();
  const { error } = await supabase
    .from('agencies')
    .update({
      name: data.name,
      logo_url: data.logo_url || null,
      brand_color: data.brand_color,
      timezone: data.timezone,
    })
    .eq('id', current.agency.id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
}

// Guarda la API key de 360dialog vía RPC (solo owner; la key nunca es legible
// desde el frontend — vive en agency_credentials sin políticas de lectura).
export async function saveD360ApiKey(apiKey: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_d360_api_key', { new_key: apiKey });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function markWhatsappConnected() {
  const current = await getCurrentAgency();
  if (!current) throw new Error('Sin sesión');
  if (current.member.role !== 'owner') throw new Error('Solo el owner puede hacer esto');
  const supabase = createClient();
  const { error } = await supabase
    .from('agencies')
    .update({ whatsapp_status: 'connected' })
    .eq('id', current.agency.id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function createFaq(data: { question_pattern: string; answer_template: string }) {
  const current = await getCurrentAgency();
  if (!current) throw new Error('Sin sesión');
  const supabase = createClient();
  const { error } = await supabase.from('faq_templates').insert({
    agency_id: current.agency.id,
    question_pattern: data.question_pattern,
    answer_template: data.answer_template,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function toggleFaq(faqId: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('faq_templates')
    .update({ active })
    .eq('id', faqId);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function deleteFaq(faqId: string) {
  const supabase = createClient();
  const { error } = await supabase.from('faq_templates').delete().eq('id', faqId);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
