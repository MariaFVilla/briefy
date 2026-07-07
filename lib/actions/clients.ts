'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import type { PlatformConfig } from '@/lib/types/database';

export interface ClientFormData {
  name: string;
  business_type: string;
  city: string;
  phone_whatsapp: string;
  pieces_per_week: number;
  business_description: string;
  products_services: string;
  target_audience: string;
  tone: string;
  forbidden_words: string;
  preferred_words: string;
  visual_references: string;
  platforms: PlatformConfig[];
  objectives: string;
}

function splitWords(value: string): string[] {
  return value
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
}

export async function createEndClient(data: ClientFormData) {
  const current = await getCurrentAgency();
  if (!current) throw new Error('Sin sesión');
  const supabase = createClient();

  const { data: client, error } = await supabase
    .from('end_clients')
    .insert({
      agency_id: current.agency.id,
      name: data.name,
      business_type: data.business_type || null,
      city: data.city || null,
      phone_whatsapp: data.phone_whatsapp || null,
      pieces_per_week: Math.min(10, Math.max(1, data.pieces_per_week)),
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`);

  const { error: profileError } = await supabase.from('client_profiles').insert({
    end_client_id: client.id,
    business_description: data.business_description || null,
    products_services: data.products_services || null,
    target_audience: data.target_audience || null,
    tone: data.tone || null,
    forbidden_words: splitWords(data.forbidden_words),
    preferred_words: splitWords(data.preferred_words),
    visual_references: data.visual_references || null,
    platforms: data.platforms,
    objectives: data.objectives || null,
  });
  if (profileError) throw new Error(`No se pudo crear el perfil: ${profileError.message}`);

  revalidatePath('/dashboard');
  revalidatePath('/clients');
  redirect(`/clients/${client.id}`);
}

export async function updateEndClient(endClientId: string, data: ClientFormData) {
  const supabase = createClient();

  const { error } = await supabase
    .from('end_clients')
    .update({
      name: data.name,
      business_type: data.business_type || null,
      city: data.city || null,
      phone_whatsapp: data.phone_whatsapp || null,
      pieces_per_week: Math.min(10, Math.max(1, data.pieces_per_week)),
    })
    .eq('id', endClientId);
  if (error) throw new Error(error.message);

  const { error: profileError } = await supabase
    .from('client_profiles')
    .update({
      business_description: data.business_description || null,
      products_services: data.products_services || null,
      target_audience: data.target_audience || null,
      tone: data.tone || null,
      forbidden_words: splitWords(data.forbidden_words),
      preferred_words: splitWords(data.preferred_words),
      visual_references: data.visual_references || null,
      platforms: data.platforms,
      objectives: data.objectives || null,
    })
    .eq('end_client_id', endClientId);
  if (profileError) throw new Error(profileError.message);

  revalidatePath(`/clients/${endClientId}`);
  revalidatePath('/dashboard');
}

export async function toggleClientActive(endClientId: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('end_clients')
    .update({ active })
    .eq('id', endClientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${endClientId}`);
  revalidatePath('/dashboard');
}

export async function toggleLearning(learningId: string, active: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('client_learnings')
    .update({ active })
    .eq('id', learningId)
    .select('end_client_id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${data.end_client_id}`);
}

export async function updateLearningText(learningId: string, text: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('client_learnings')
    .update({ learning_text: text })
    .eq('id', learningId)
    .select('end_client_id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${data.end_client_id}`);
}
