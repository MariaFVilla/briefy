// Agente 2 — EL MENSAJERO (envío)
// Presenta las piezas aprobadas internamente al cliente final por WhatsApp,
// hablando SIEMPRE como la agencia (nunca menciona Briefy ni IA).
//
// Body: { batch_id: string }
import { getAdminClient, jsonResponse, corsHeaders } from '../_shared/supabase.ts';
import { sendWhatsAppText } from '../_shared/d360.ts';
import { presentBatchMessage, presentPieceMessage } from '../_shared/prompts/messenger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const { batch_id } = await req.json();
    if (!batch_id) return jsonResponse({ error: 'Falta batch_id' }, 400);

    const { data: batch } = await supabase
      .from('content_batches')
      .select('*, end_clients(id, name, phone_whatsapp, agency_id, agencies(id, name, whatsapp_status))')
      .eq('id', batch_id)
      .single();
    if (!batch) return jsonResponse({ error: 'Batch no encontrado' }, 404);

    const endClient = batch.end_clients;
    const agency = endClient.agencies;
    if (!endClient.phone_whatsapp) {
      return jsonResponse({ error: 'El cliente no tiene número de WhatsApp' }, 400);
    }
    if (agency.whatsapp_status !== 'connected') {
      return jsonResponse({ error: 'La agencia no tiene WhatsApp conectado' }, 400);
    }

    const { data: creds } = await supabase
      .from('agency_credentials')
      .select('d360_api_key')
      .eq('agency_id', agency.id)
      .single();
    if (!creds?.d360_api_key) {
      return jsonResponse({ error: 'La agencia no tiene API key de 360dialog' }, 400);
    }

    // Solo piezas con aprobación interna humana (el trigger de DB lo garantiza igual).
    const { data: pieces } = await supabase
      .from('pieces')
      .select('*')
      .eq('batch_id', batch_id)
      .eq('status', 'approved_internal')
      .order('position');
    if (!pieces || pieces.length === 0) {
      return jsonResponse({ error: 'No hay piezas aprobadas internamente' }, 400);
    }

    const to = endClient.phone_whatsapp;
    const apiKey = creds.d360_api_key;
    const outbound: string[] = [];

    // Mensaje de presentación
    const intro = presentBatchMessage({
      clientName: endClient.name,
      agencyName: agency.name,
      piecesCount: pieces.length,
      weekStart: batch.week_start,
    });
    const introResult = await sendWhatsAppText({ apiKey, to, body: intro });
    if (!introResult.ok) return jsonResponse({ error: introResult.error }, 502);
    outbound.push(intro);

    // Una pieza por mensaje
    let sent = 0;
    for (const piece of pieces) {
      const body = presentPieceMessage({
        position: piece.position,
        total: pieces.length,
        platform: piece.platform,
        format: piece.format,
        copyText: piece.copy_text,
      });
      const result = await sendWhatsAppText({ apiKey, to, body });
      if (result.ok) {
        await supabase
          .from('pieces')
          .update({ status: 'sent_to_client' })
          .eq('id', piece.id);
        outbound.push(body);
        sent++;
      }
    }

    // Registrar mensajes salientes en la bandeja
    await supabase.from('client_messages').insert(
      outbound.map((content) => ({
        end_client_id: endClient.id,
        batch_id,
        direction: 'outbound',
        channel: 'whatsapp',
        raw_content: content,
      }))
    );

    await supabase
      .from('content_batches')
      .update({
        status: 'sent',
        approval_token_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      })
      .eq('id', batch_id);

    return jsonResponse({ ok: true, pieces_sent: sent });
  } catch (err) {
    console.error('[messenger-send] error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
