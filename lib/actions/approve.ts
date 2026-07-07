'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { invokeEdgeFunction } from '@/lib/actions/edge';

// Cliente anónimo: el acceso se valida por token dentro del RPC (security definer).
function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function respondToPieceByToken(
  token: string,
  pieceId: string,
  action: 'approve' | 'request_change',
  comment?: string
) {
  const supabase = anonClient();
  const { data, error } = await supabase.rpc('respond_to_piece_by_token', {
    token,
    target_piece: pieceId,
    action,
    comment: comment ?? null,
  });
  if (error) throw new Error(error.message);

  // Contexto para el Aprendiz y la regeneración (el token ya validó el acceso).
  const { data: piece } = await supabase.rpc('get_batch_by_token', { token });
  const endClientId = await resolveEndClientId(token);

  if (endClientId) {
    if (action === 'approve') {
      // Aprendizaje por aprobación (fire-and-forget: no bloquea la respuesta al cliente).
      invokeEdgeFunction('learn-from-feedback', {
        end_client_id: endClientId,
        feedback_type: 'approval',
        feedback_text: 'El cliente aprobó la pieza sin cambios.',
        piece_id: pieceId,
      }).catch((err) => console.error('[learn-from-feedback]', err));
    } else if (comment?.trim()) {
      // Aprendizaje por comentario + regeneración automática de la pieza
      // (la pieza regenerada vuelve a revisión interna — human-in-the-loop).
      invokeEdgeFunction('learn-from-feedback', {
        end_client_id: endClientId,
        feedback_type: 'comment',
        feedback_text: comment,
        piece_id: pieceId,
      }).catch((err) => console.error('[learn-from-feedback]', err));
      invokeEdgeFunction('producer', {
        piece_id: pieceId,
        instruction: comment,
      }).catch((err) => console.error('[producer regenerate]', err));
    }
  }

  revalidatePath(`/approve/${token}`);
  return { ok: true, batch: piece, result: data };
}

async function resolveEndClientId(token: string): Promise<string | null> {
  // El end_client_id no viaja en el payload público; lo resolvemos con service role.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await admin
    .from('content_batches')
    .select('end_client_id')
    .eq('approval_token', token)
    .single();
  return data?.end_client_id ?? null;
}

export async function getBatchByToken(token: string) {
  const supabase = anonClient();
  const { data, error } = await supabase.rpc('get_batch_by_token', { token });
  if (error) throw new Error(error.message);
  return data;
}
