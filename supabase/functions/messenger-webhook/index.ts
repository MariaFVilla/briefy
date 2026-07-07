// Agente 2 — EL MENSAJERO (recepción)
// Webhook de 360dialog: interpreta la respuesta del cliente final (texto o
// nota de voz transcrita), la clasifica con Claude y ejecuta la máquina de
// estados. EL MENSAJERO NUNCA CONVERSA LIBREMENTE.
import {
  getAnthropicClient,
  computeUsage,
  extractText,
  extractJson,
  CLAUDE_MODEL,
} from '../_shared/anthropic.ts';
import { getAdminClient, jsonResponse, corsHeaders } from '../_shared/supabase.ts';
import {
  sendWhatsAppText,
  downloadMedia,
  transcribeAudio,
  verifyWebhookSignature,
} from '../_shared/d360.ts';
import { CLASSIFIER_SYSTEM, buildClassifierPrompt } from '../_shared/prompts/classifier.ts';
import {
  approvalConfirmation,
  allApprovedMessage,
  changeRegisteredMessage,
  rejectionRegisteredMessage,
  questionEscalatedMessage,
  clarificationRequestMessage,
  escalatedToTeamMessage,
} from '../_shared/prompts/messenger.ts';

interface Classification {
  classification: 'approved' | 'change_requested' | 'rejected' | 'question' | 'unclear';
  piece_id: string | 'all' | null;
  change_details: string | null;
  faq_id: string | null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verificación del challenge (configuración inicial del webhook)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = url.searchParams.get('hub.verify_token');
    if (challenge && verifyToken === Deno.env.get('D360_WEBHOOK_SECRET')) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('ok', { status: 200 });
  }

  const rawBody = await req.text();

  // Verificación de firma del webhook
  const secret = Deno.env.get('D360_WEBHOOK_SECRET');
  if (secret) {
    const valid = await verifyWebhookSignature({
      secret,
      rawBody,
      signatureHeader: req.headers.get('x-hub-signature-256'),
    });
    if (!valid) {
      console.error('[messenger-webhook] firma inválida');
      return jsonResponse({ error: 'Firma inválida' }, 401);
    }
  }

  try {
    const supabase = getAdminClient();
    const payload = JSON.parse(rawBody);

    // Formato WhatsApp Cloud API (vía 360dialog)
    const messages: Array<{ from: string; type: string; text?: { body: string }; audio?: { id: string }; voice?: { id: string } }> = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          messages.push(msg);
        }
      }
    }
    if (messages.length === 0) {
      return jsonResponse({ ok: true, ignored: true });
    }

    for (const msg of messages) {
      await handleInboundMessage(supabase, msg);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[messenger-webhook] error:', err);
    // 200 igualmente para evitar reintentos infinitos del BSP
    return jsonResponse({ ok: false, error: String(err) });
  }
});

// deno-lint-ignore no-explicit-any
async function handleInboundMessage(supabase: any, msg: any) {
  const fromPhone = normalizePhone(msg.from ?? '');
  if (!fromPhone) return;

  // Identificar cliente final por su número de WhatsApp
  const { data: clients } = await supabase
    .from('end_clients')
    .select('*, agencies(id, name, whatsapp_status)')
    .not('phone_whatsapp', 'is', null);
  const endClient = (clients ?? []).find(
    (c: { phone_whatsapp: string }) =>
      normalizePhone(c.phone_whatsapp).endsWith(fromPhone.slice(-10)) ||
      fromPhone.endsWith(normalizePhone(c.phone_whatsapp).slice(-10))
  );
  if (!endClient) {
    console.warn('[messenger-webhook] mensaje de número desconocido:', fromPhone);
    return;
  }

  const { data: creds } = await supabase
    .from('agency_credentials')
    .select('d360_api_key')
    .eq('agency_id', endClient.agencies.id)
    .single();
  const apiKey: string | null = creds?.d360_api_key ?? null;

  // Contenido: texto directo o audio transcrito
  let rawContent = '';
  let transcription: string | null = null;
  if (msg.type === 'text') {
    rawContent = msg.text?.body ?? '';
  } else if (msg.type === 'audio' || msg.type === 'voice') {
    const mediaId = msg.audio?.id ?? msg.voice?.id;
    rawContent = '[nota de voz]';
    if (mediaId && apiKey) {
      const media = await downloadMedia({ apiKey, mediaId });
      if (media) {
        transcription = await transcribeAudio(media);
      }
    }
  } else {
    rawContent = `[mensaje tipo ${msg.type}]`;
  }

  const effectiveText = transcription ?? rawContent;

  // Batch activo: el último enviado de este cliente
  const { data: batch } = await supabase
    .from('content_batches')
    .select('*')
    .eq('end_client_id', endClient.id)
    .in('status', ['sent', 'completed'])
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Registrar mensaje entrante
  const { data: inserted } = await supabase
    .from('client_messages')
    .insert({
      end_client_id: endClient.id,
      batch_id: batch?.id ?? null,
      direction: 'inbound',
      channel: 'whatsapp',
      raw_content: rawContent,
      transcription,
    })
    .select('id')
    .single();
  const messageId = inserted?.id;

  async function reply(body: string) {
    if (!apiKey) return;
    await sendWhatsAppText({ apiKey, to: endClient.phone_whatsapp, body });
    await supabase.from('client_messages').insert({
      end_client_id: endClient.id,
      batch_id: batch?.id ?? null,
      direction: 'outbound',
      channel: 'whatsapp',
      raw_content: body,
    });
  }

  if (!effectiveText.trim() || effectiveText === '[nota de voz]') {
    // No pudimos entender el audio — escalar
    await reply(escalatedToTeamMessage());
    if (messageId) {
      await supabase.from('client_messages').update({ classified_as: 'unclear' }).eq('id', messageId);
    }
    return;
  }

  // Piezas esperando respuesta + FAQs de la agencia
  let pieces: Array<{ id: string; position: number; platform: string; format: string; copy_text: string; strategic_argument: string; status: string }> = [];
  if (batch) {
    const { data } = await supabase
      .from('pieces')
      .select('id, position, platform, format, copy_text, strategic_argument, status')
      .eq('batch_id', batch.id)
      .in('status', ['sent_to_client', 'changes_requested'])
      .order('position');
    pieces = data ?? [];
  }
  const { data: faqs } = await supabase
    .from('faq_templates')
    .select('id, question_pattern, answer_template')
    .eq('agency_id', endClient.agencies.id)
    .eq('active', true);

  // Clasificar con Claude
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    temperature: 0.1,
    system: CLASSIFIER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildClassifierPrompt({
          message: effectiveText,
          pieces: pieces.map((p) => ({
            id: p.id,
            position: p.position,
            platform: p.platform,
            format: p.format,
            copy_excerpt: p.copy_text.slice(0, 150),
            status: p.status,
          })),
          faqs: (faqs ?? []).map((f: { id: string; question_pattern: string }) => ({
            id: f.id,
            question_pattern: f.question_pattern,
          })),
        }),
      },
    ],
  });

  const usage = computeUsage(response);
  await supabase.from('generation_logs').insert({
    agency_id: endClient.agencies.id,
    batch_id: batch?.id ?? null,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: usage.estimatedCostUsd,
    model: CLAUDE_MODEL,
  });

  let parsed: Classification;
  try {
    parsed = extractJson<Classification>(extractText(response));
  } catch {
    parsed = { classification: 'unclear', piece_id: null, change_details: null, faq_id: null };
  }

  if (messageId) {
    await supabase
      .from('client_messages')
      .update({ classified_as: parsed.classification, piece_id: resolveSinglePieceId(parsed, pieces) })
      .eq('id', messageId);
  }

  const targetPieces =
    parsed.piece_id === 'all'
      ? pieces
      : pieces.filter((p) => p.id === parsed.piece_id);

  switch (parsed.classification) {
    case 'approved': {
      const toApprove = targetPieces.length ? targetPieces : pieces;
      for (const p of toApprove) {
        await supabase
          .from('pieces')
          .update({ status: 'client_approved', client_responded_at: new Date().toISOString() })
          .eq('id', p.id);
      }
      await maybeCompleteBatch(supabase, batch?.id);
      const remaining = pieces.length - toApprove.length;
      await reply(remaining <= 0 ? allApprovedMessage() : approvalConfirmation());
      fireLearn(endClient.id, 'approval', effectiveText, toApprove[0]?.id);
      break;
    }
    case 'change_requested': {
      const piece = targetPieces[0];
      if (!piece) {
        await reply(clarificationRequestMessage());
        break;
      }
      await supabase
        .from('pieces')
        .update({ status: 'changes_requested', client_responded_at: new Date().toISOString() })
        .eq('id', piece.id);
      await reply(changeRegisteredMessage());
      const instruction = parsed.change_details ?? effectiveText;
      fireLearn(endClient.id, 'comment', instruction, piece.id);
      // Regeneración automática — la pieza vuelve a revisión interna (human-in-the-loop)
      fireProducerRegenerate(piece.id, instruction);
      break;
    }
    case 'rejected': {
      const piece = targetPieces[0];
      if (piece) {
        await supabase
          .from('pieces')
          .update({ status: 'rejected', client_responded_at: new Date().toISOString() })
          .eq('id', piece.id);
      }
      await reply(rejectionRegisteredMessage());
      fireLearn(endClient.id, 'rejection', effectiveText, piece?.id);
      break;
    }
    case 'question': {
      // Responde SOLO si coincide con una FAQ predefinida
      const faq = (faqs ?? []).find((f: { id: string }) => f.id === parsed.faq_id);
      if (faq) {
        const pieceForContext = targetPieces[0] ?? pieces[0];
        const answer = faq.answer_template.replace(
          '{argumento}',
          pieceForContext?.strategic_argument ?? ''
        );
        await reply(answer);
      } else {
        // No coincide → el equipo responde pronto + queda escalado en la bandeja
        await reply(questionEscalatedMessage());
      }
      break;
    }
    case 'unclear':
    default: {
      // Pedir aclaración UNA sola vez; si sigue unclear, escalar
      const { data: previous } = await supabase
        .from('client_messages')
        .select('classified_as')
        .eq('end_client_id', endClient.id)
        .eq('direction', 'inbound')
        .neq('id', messageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previous?.classified_as === 'unclear') {
        await reply(escalatedToTeamMessage());
      } else {
        await reply(clarificationRequestMessage());
      }
      break;
    }
  }
}

function resolveSinglePieceId(
  parsed: Classification,
  pieces: Array<{ id: string }>
): string | null {
  if (parsed.piece_id && parsed.piece_id !== 'all') {
    return pieces.some((p) => p.id === parsed.piece_id) ? parsed.piece_id : null;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function maybeCompleteBatch(supabase: any, batchId?: string) {
  if (!batchId) return;
  const { data: pending } = await supabase
    .from('pieces')
    .select('id')
    .eq('batch_id', batchId)
    .in('status', ['sent_to_client', 'changes_requested', 'regenerating']);
  if (!pending || pending.length === 0) {
    await supabase.from('content_batches').update({ status: 'completed' }).eq('id', batchId);
  }
}

function fireLearn(
  endClientId: string,
  type: 'approval' | 'rejection' | 'comment',
  text: string,
  pieceId?: string
) {
  invokeSibling('learn-from-feedback', {
    end_client_id: endClientId,
    feedback_type: type,
    feedback_text: text,
    piece_id: pieceId ?? null,
  });
}

function fireProducerRegenerate(pieceId: string, instruction: string) {
  invokeSibling('producer', { piece_id: pieceId, instruction });
}

// Invoca otra Edge Function del mismo proyecto sin bloquear la respuesta.
function invokeSibling(name: string, body: unknown) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error(`[invoke ${name}]`, err));
}
