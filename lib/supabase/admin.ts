import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente con service role — SOLO usar en server (route handlers / server actions
// del lado seguro). Nunca importar desde componentes de cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
