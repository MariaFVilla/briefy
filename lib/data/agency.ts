import { createClient } from '@/lib/supabase/server';
import type { Agency, AgencyMember } from '@/lib/types/database';

export interface CurrentAgency {
  agency: Agency;
  member: AgencyMember;
}

// Agencia + membresía del usuario autenticado. null si no hay sesión.
export async function getCurrentAgency(): Promise<CurrentAgency | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('agency_members')
    .select('*')
    .eq('auth_user_id', user.id)
    .limit(1)
    .single();
  if (!member) return null;

  const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', member.agency_id)
    .single();
  if (!agency) return null;

  return { agency: agency as Agency, member: member as AgencyMember };
}
