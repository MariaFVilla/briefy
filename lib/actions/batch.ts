'use server';

import { revalidatePath } from 'next/cache';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgency } from '@/lib/data/agency';
import { invokeEdgeFunction } from '@/lib/actions/edge';

// Valida que el usuario actual tenga acceso al cliente final (vía RLS).
async function assertOwnsClient(endClientId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('end_clients')
    .select('id')
    .eq('id', endClientId)
    .single();
  if (!data) throw new Error('Cliente no encontrado o sin acceso');
}

async function assertOwnsPiece(pieceId: string): Promise<{ endClientId: string }> {
  const supabase = createClient();
  const { data } = await supabase
    .from('pieces')
    .select('id, content_batches(end_client_id)')
    .eq('id', pieceId)
    .single();
  if (!data) throw new Error('Pieza no encontrada o sin acceso');
  const batch = data.content_batches as unknown as { end_client_id: string };
  return { endClientId: batch.end_client_id };
}

export async function generateBatch(endClientId: string) {
  await assertOwnsClient(endClientId);
  // La generación tarda 1-2 min y excede el límite de las server actions de
  // Vercel: waitUntil mantiene viva la invocación mientras respondemos ya.
  // La pantalla del batch se auto-refresca hasta que aparecen las piezas.
  waitUntil(
    invokeEdgeFunction<{ batch_id?: string; error?: string }>('producer', {
      end_client_id: endClientId,
    }).catch((err) => console.error('[producer]', err))
  );
  revalidatePath(`/clients/${endClientId}`);
  revalidatePath(`/clients/${endClientId}/batch`);
  revalidatePath('/dashboard');
  return { started: true };
}

export async function regeneratePieceWithInstruction(pieceId: string, instruction: string) {
  const { endClientId } = await assertOwnsPiece(pieceId);
  if (!instruction.trim()) throw new Error('Escribe la instrucción del cambio');
  const result = await invokeEdgeFunction<{ regenerated?: boolean }>('producer', {
    piece_id: pieceId,
    instruction,
  });
  revalidatePath(`/clients/${endClientId}/batch`);
  revalidatePath('/dashboard');
  return result;
}

export async function approvePieceInternal(pieceId: string) {
  const { endClientId } = await assertOwnsPiece(pieceId);
  const current = await getCurrentAgency();
  if (!current) throw new Error('Sin sesión');
  const supabase = createClient();
  const { error } = await supabase
    .from('pieces')
    .update({
      status: 'approved_internal',
      internal_approved_by: current.member.id,
      internal_approved_at: new Date().toISOString(),
    })
    .eq('id', pieceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${endClientId}/batch`);
  revalidatePath('/dashboard');
}

export async function discardPiece(pieceId: string) {
  const { endClientId } = await assertOwnsPiece(pieceId);
  const supabase = createClient();
  const { error } = await supabase
    .from('pieces')
    .update({ status: 'rejected' })
    .eq('id', pieceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${endClientId}/batch`);
  revalidatePath('/dashboard');
}

export async function updatePieceContent(
  pieceId: string,
  fields: { copy_text?: string; visual_brief?: string; strategic_argument?: string }
) {
  const { endClientId } = await assertOwnsPiece(pieceId);
  const supabase = createClient();
  // La edición humana devuelve la pieza a revisión interna si aún no fue enviada.
  const { data: piece } = await supabase
    .from('pieces')
    .select('status')
    .eq('id', pieceId)
    .single();
  const updates: Record<string, unknown> = { ...fields };
  if (piece && ['draft', 'approved_internal'].includes(piece.status)) {
    updates.status = 'internal_review';
    updates.internal_approved_by = null;
    updates.internal_approved_at = null;
  }
  const { error } = await supabase.from('pieces').update(updates).eq('id', pieceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${endClientId}/batch`);
}

export async function markPieceFinal(pieceId: string) {
  const { endClientId } = await assertOwnsPiece(pieceId);
  const supabase = createClient();
  const { error } = await supabase
    .from('pieces')
    .update({ status: 'final' })
    .eq('id', pieceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${endClientId}/batch`);
  revalidatePath('/dashboard');
}

// "Enviar aprobadas al cliente": pasa las approved_internal a sent_to_client.
// Canal web: devuelve el link de aprobación. Canal whatsapp: dispara messenger-send.
export async function sendApprovedToClient(
  batchId: string,
  channel: 'whatsapp' | 'web'
): Promise<{ approveUrl?: string; sent: number }> {
  const supabase = createClient();
  const { data: batch } = await supabase
    .from('content_batches')
    .select('id, end_client_id, approval_token, status')
    .eq('id', batchId)
    .single();
  if (!batch) throw new Error('Batch no encontrado o sin acceso');

  const { data: approved } = await supabase
    .from('pieces')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'approved_internal');
  if (!approved || approved.length === 0) {
    throw new Error('No hay piezas aprobadas internamente para enviar');
  }

  if (channel === 'whatsapp') {
    // El Mensajero envía las piezas por WhatsApp y actualiza estados.
    await invokeEdgeFunction('messenger-send', { batch_id: batchId });
  } else {
    // Canal web: solo transiciona estados; el link comparte la misma máquina de estados.
    const { error } = await supabase
      .from('pieces')
      .update({ status: 'sent_to_client' })
      .eq('batch_id', batchId)
      .eq('status', 'approved_internal');
    if (error) throw new Error(error.message);
    await supabase
      .from('content_batches')
      .update({
        status: 'sent',
        approval_token_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      })
      .eq('id', batchId);
  }

  revalidatePath(`/clients/${batch.end_client_id}/batch`);
  revalidatePath('/dashboard');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    sent: approved.length,
    approveUrl: `${appUrl}/approve/${batch.approval_token}`,
  };
}
