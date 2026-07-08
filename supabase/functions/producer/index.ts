// Agente 1 — EL PRODUCTOR
// Genera el paquete semanal de piezas por cliente final (cron lunes 6am
// o bajo demanda desde el dashboard) y regenera piezas con instrucción.
//
// Body:
//   { end_client_id: string, week_start?: string }   → genera batch para un cliente
//   { agency_id: string, week_start?: string }       → genera para todos los clientes activos
//   { all_agencies: true }                            → cron semanal (todas las agencias)
//   { piece_id: string, instruction: string }        → regenera una pieza
import {
  getAnthropicClient,
  computeUsage,
  extractText,
  extractJson,
  CLAUDE_MODEL,
  type ClaudeUsage,
} from '../_shared/anthropic.ts';
import { getAdminClient, jsonResponse, corsHeaders } from '../_shared/supabase.ts';
import {
  PRODUCER_SYSTEM,
  buildPlanPrompt,
  buildPiecePrompt,
  buildRegeneratePrompt,
  type ProducerProfileInput,
} from '../_shared/prompts/producer.ts';

const MAX_TOKENS_PER_PIECE = 1300; // control de costos: presupuesto acotado por pieza
const PLAN_MAX_TOKENS = 1500;
const MAX_WEB_SEARCHES = 2;

interface PlanItem {
  platform: string;
  format: string;
  theme: string;
  angle: string;
}

interface GeneratedPiece {
  copy_text: string;
  visual_brief: string;
  strategic_argument: string;
}

function mondayOfCurrentWeek(timezone: string): string {
  // Fecha actual en la zona horaria de la agencia, retrocedida al lunes.
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone || 'America/Bogota' })
  );
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any
async function loadProfile(supabase: any, endClientId: string) {
  const { data: client, error } = await supabase
    .from('end_clients')
    .select('*, agencies(id, name, timezone), client_profiles(*)')
    .eq('id', endClientId)
    .single();
  if (error || !client) throw new Error(`Cliente final no encontrado: ${endClientId}`);

  const profile = client.client_profiles;
  const profileInput: ProducerProfileInput = {
    clientName: client.name,
    businessType: client.business_type ?? '',
    city: client.city ?? '',
    businessDescription: profile?.business_description ?? '',
    productsServices: profile?.products_services ?? '',
    targetAudience: profile?.target_audience ?? '',
    tone: profile?.tone ?? '',
    forbiddenWords: profile?.forbidden_words ?? [],
    preferredWords: profile?.preferred_words ?? [],
    visualReferences: profile?.visual_references ?? '',
    platforms: profile?.platforms ?? [],
    objectives: profile?.objectives ?? '',
  };

  const { data: learnings } = await supabase
    .from('client_learnings')
    .select('learning_text')
    .eq('end_client_id', endClientId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  return {
    client,
    profileInput,
    learnings: (learnings ?? []).map((l: { learning_text: string }) => l.learning_text),
  };
}

// deno-lint-ignore no-explicit-any
async function logGeneration(supabase: any, agencyId: string, batchId: string | null, usage: ClaudeUsage) {
  await supabase.from('generation_logs').insert({
    agency_id: agencyId,
    batch_id: batchId,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: usage.estimatedCostUsd,
    model: CLAUDE_MODEL,
  });
}

// deno-lint-ignore no-explicit-any
async function generateBatchForClient(supabase: any, endClientId: string, weekStartOverride?: string) {
  const { client, profileInput, learnings } = await loadProfile(supabase, endClientId);
  const agency = client.agencies;
  const weekStart = weekStartOverride ?? mondayOfCurrentWeek(agency.timezone);
  // Límite duro: entre 1 y 10 piezas por cliente por semana.
  const piecesCount = Math.min(10, Math.max(1, client.pieces_per_week ?? 5));

  // Upsert del batch de la semana en estado generating.
  const { data: existing } = await supabase
    .from('content_batches')
    .select('id, status')
    .eq('end_client_id', endClientId)
    .eq('week_start', weekStart)
    .maybeSingle();

  let batchId: string;
  if (existing) {
    if (existing.status !== 'generating') {
      return { end_client_id: endClientId, skipped: true, reason: `El batch de la semana ya existe (${existing.status})` };
    }
    batchId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from('content_batches')
      .insert({ end_client_id: endClientId, week_start: weekStart, status: 'generating' })
      .select('id')
      .single();
    if (error) throw new Error(`No se pudo crear el batch: ${error.message}`);
    batchId = created.id;
  }

  const anthropic = getAnthropicClient();

  // Etapa 1: tendencias (web search) + plan semanal. Una sola llamada corta.
  const planResponse = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: PLAN_MAX_TOKENS,
    system: PRODUCER_SYSTEM,
    tools: [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: MAX_WEB_SEARCHES,
      // deno-lint-ignore no-explicit-any
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content: buildPlanPrompt({
          profile: profileInput,
          learnings,
          piecesCount,
          weekStart,
        }),
      },
    ],
  });

  const planUsage = computeUsage(planResponse);
  const parsedPlan = extractJson<{ trends_summary: string; plan: PlanItem[] }>(
    extractText(planResponse)
  );
  const plan = (parsedPlan.plan ?? []).slice(0, piecesCount); // nunca más del límite
  if (plan.length === 0) throw new Error('El Productor no devolvió un plan de piezas');

  // Etapa 2: una llamada por pieza, EN PARALELO (evita el límite de wall
  // clock de la Edge Function y escala hasta 10 piezas).
  const pieceResults = await Promise.allSettled(
    plan.map((_item, index) =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS_PER_PIECE,
        system: PRODUCER_SYSTEM,
        messages: [
          {
            role: 'user',
            content: buildPiecePrompt({
              profile: profileInput,
              learnings,
              weekStart,
              trendsSummary: parsedPlan.trends_summary ?? '',
              plan,
              index,
            }),
          },
        ],
      })
    )
  );

  const usage = { ...planUsage };
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < pieceResults.length; i++) {
    const result = pieceResults[i];
    if (result.status === 'rejected') {
      console.error(`[producer] pieza ${i + 1} falló:`, result.reason);
      continue;
    }
    const pieceUsage = computeUsage(result.value);
    usage.inputTokens += pieceUsage.inputTokens;
    usage.outputTokens += pieceUsage.outputTokens;
    usage.webSearches += pieceUsage.webSearches;
    usage.estimatedCostUsd += pieceUsage.estimatedCostUsd;
    try {
      const piece = extractJson<GeneratedPiece>(extractText(result.value));
      rows.push({
        batch_id: batchId,
        platform: plan[i].platform,
        format: plan[i].format,
        copy_text: piece.copy_text ?? '',
        visual_brief: piece.visual_brief ?? '',
        strategic_argument: piece.strategic_argument ?? '',
        status: 'draft',
        position: rows.length + 1,
      });
    } catch (err) {
      console.error(`[producer] pieza ${i + 1} JSON inválido:`, err);
    }
  }

  await logGeneration(supabase, agency.id, batchId, usage);
  if (rows.length === 0) throw new Error('El Productor no devolvió piezas');

  const { error: piecesError } = await supabase.from('pieces').insert(rows);
  if (piecesError) throw new Error(`No se pudieron guardar las piezas: ${piecesError.message}`);

  await supabase
    .from('content_batches')
    .update({ status: 'internal_review' })
    .eq('id', batchId);

  return {
    end_client_id: endClientId,
    batch_id: batchId,
    week_start: weekStart,
    pieces_generated: rows.length,
    cost_usd: usage.estimatedCostUsd,
  };
}

// deno-lint-ignore no-explicit-any
async function regeneratePiece(supabase: any, pieceId: string, instruction: string) {
  const { data: piece, error } = await supabase
    .from('pieces')
    .select('*, content_batches(id, end_client_id)')
    .eq('id', pieceId)
    .single();
  if (error || !piece) throw new Error('Pieza no encontrada');

  const endClientId = piece.content_batches.end_client_id;
  const { client, profileInput, learnings } = await loadProfile(supabase, endClientId);

  await supabase.from('pieces').update({ status: 'regenerating' }).eq('id', pieceId);

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS_PER_PIECE,
    system: PRODUCER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildRegeneratePrompt({
          profile: profileInput,
          learnings,
          piece: {
            platform: piece.platform,
            format: piece.format,
            copy_text: piece.copy_text,
            visual_brief: piece.visual_brief,
            strategic_argument: piece.strategic_argument,
          },
          instruction,
        }),
      },
    ],
  });

  const usage = computeUsage(response);
  await logGeneration(supabase, client.agencies.id, piece.batch_id, usage);

  const regenerated = extractJson<{
    copy_text: string;
    visual_brief: string;
    strategic_argument: string;
  }>(extractText(response));

  // El trigger archive_piece_version guarda la versión anterior;
  // briefy.change_reason viaja como set_config por conexión no disponible aquí,
  // así que registramos el motivo en piece_versions vía el trigger con default.
  // La pieza regenerada SIEMPRE vuelve a revisión interna (human-in-the-loop).
  const { error: updateError } = await supabase
    .from('pieces')
    .update({
      copy_text: regenerated.copy_text,
      visual_brief: regenerated.visual_brief,
      strategic_argument: regenerated.strategic_argument,
      status: 'internal_review',
      internal_approved_by: null,
      internal_approved_at: null,
    })
    .eq('id', pieceId);
  if (updateError) throw new Error(`No se pudo actualizar la pieza: ${updateError.message}`);

  return { piece_id: pieceId, regenerated: true, cost_usd: usage.estimatedCostUsd };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const body = await req.json();

    // Regeneración de una pieza con instrucción
    if (body.piece_id) {
      if (!body.instruction || !String(body.instruction).trim()) {
        return jsonResponse({ error: 'Falta la instrucción de regeneración' }, 400);
      }
      const result = await regeneratePiece(supabase, body.piece_id, String(body.instruction));
      return jsonResponse(result);
    }

    // Generación para un cliente puntual
    if (body.end_client_id) {
      const result = await generateBatchForClient(supabase, body.end_client_id, body.week_start);
      return jsonResponse(result);
    }

    // Generación para todos los clientes activos de una agencia (o de todas — cron)
    let agencyIds: string[] = [];
    if (body.agency_id) {
      agencyIds = [body.agency_id];
    } else if (body.all_agencies) {
      const { data: agencies } = await supabase.from('agencies').select('id, timezone');
      let list = agencies ?? [];
      // Cron: solo agencias donde la hora local coincide (lunes 6am hora de la agencia)
      if (typeof body.local_hour === 'number') {
        list = list.filter((a: { timezone: string }) => {
          const localHour = Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: a.timezone || 'America/Bogota',
              hour: 'numeric',
              hour12: false,
            }).format(new Date())
          );
          return localHour === body.local_hour;
        });
      }
      agencyIds = list.map((a: { id: string }) => a.id);
    } else {
      return jsonResponse({ error: 'Indica end_client_id, agency_id, all_agencies o piece_id' }, 400);
    }

    const results: unknown[] = [];
    for (const agencyId of agencyIds) {
      const { data: clients } = await supabase
        .from('end_clients')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('active', true);
      for (const c of clients ?? []) {
        try {
          results.push(await generateBatchForClient(supabase, c.id, body.week_start));
        } catch (err) {
          results.push({ end_client_id: c.id, error: String(err) });
        }
      }
    }
    return jsonResponse({ results });
  } catch (err) {
    console.error('[producer] error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
