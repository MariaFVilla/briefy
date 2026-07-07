// EL APRENDIZ — no es un agente separado: es una función que se invoca
// cada vez que llega feedback (aprobación, cambio, rechazo, comentario).
// Extrae learnings atómicos con Claude y los guarda en client_learnings.
// Este historial acumulativo es el moat del producto.
//
// Body: {
//   end_client_id: string,
//   feedback_type: 'approval' | 'rejection' | 'comment',
//   feedback_text: string,
//   piece_id?: string
// }
import {
  getAnthropicClient,
  computeUsage,
  extractText,
  extractJson,
  CLAUDE_MODEL,
} from '../_shared/anthropic.ts';
import { getAdminClient, jsonResponse, corsHeaders } from '../_shared/supabase.ts';
import { LEARNINGS_SYSTEM, buildLearningsPrompt } from '../_shared/prompts/learnings.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const body = await req.json();
    const { end_client_id, feedback_type, feedback_text, piece_id } = body;

    if (!end_client_id || !feedback_type || !feedback_text?.trim()) {
      return jsonResponse({ error: 'Faltan end_client_id, feedback_type o feedback_text' }, 400);
    }

    const { data: client } = await supabase
      .from('end_clients')
      .select('id, agency_id')
      .eq('id', end_client_id)
      .single();
    if (!client) return jsonResponse({ error: 'Cliente no encontrado' }, 404);

    let piece = null;
    if (piece_id) {
      const { data } = await supabase
        .from('pieces')
        .select('platform, format, copy_text')
        .eq('id', piece_id)
        .single();
      piece = data;
    }

    const { data: existing } = await supabase
      .from('client_learnings')
      .select('learning_text')
      .eq('end_client_id', end_client_id)
      .eq('active', true);
    const existingLearnings = (existing ?? []).map(
      (l: { learning_text: string }) => l.learning_text
    );

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      temperature: 0.2,
      system: LEARNINGS_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildLearningsPrompt({
            feedbackType: feedback_type,
            feedbackText: feedback_text,
            piece,
            existingLearnings,
          }),
        },
      ],
    });

    const usage = computeUsage(response);
    await supabase.from('generation_logs').insert({
      agency_id: client.agency_id,
      batch_id: null,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      estimated_cost_usd: usage.estimatedCostUsd,
      model: CLAUDE_MODEL,
    });

    const parsed = extractJson<{ learnings: string[] }>(extractText(response));
    const newLearnings = (parsed.learnings ?? [])
      .map((l) => String(l).trim())
      .filter(Boolean)
      .slice(0, 3);

    if (newLearnings.length > 0) {
      await supabase.from('client_learnings').insert(
        newLearnings.map((text) => ({
          end_client_id,
          learning_text: text,
          source: feedback_type,
          source_piece_id: piece_id ?? null,
          active: true,
        }))
      );
    }

    return jsonResponse({ learnings_added: newLearnings.length, learnings: newLearnings });
  } catch (err) {
    console.error('[learn-from-feedback] error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
