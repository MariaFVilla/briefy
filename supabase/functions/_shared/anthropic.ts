// Helper de llamadas a Claude para Edge Functions (Deno).
// La API key vive SOLO en secrets de Supabase (ANTHROPIC_API_KEY).
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

export const CLAUDE_MODEL = 'claude-sonnet-4-6';

// Precios claude-sonnet-4-6 (USD por millón de tokens) + web search por request.
const INPUT_PRICE_PER_MTOK = 3;
const OUTPUT_PRICE_PER_MTOK = 15;
const WEB_SEARCH_PRICE_PER_REQUEST = 0.01;

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
  estimatedCostUsd: number;
}

export function getAnthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada en los secrets');
  return new Anthropic({ apiKey });
}

export function computeUsage(response: Anthropic.Message): ClaudeUsage {
  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens ?? 0;
  const webSearches =
    (response.usage as { server_tool_use?: { web_search_requests?: number } })
      .server_tool_use?.web_search_requests ?? 0;
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK +
    webSearches * WEB_SEARCH_PRICE_PER_REQUEST;
  return { inputTokens, outputTokens, webSearches, estimatedCostUsd };
}

// Extrae el texto final de la respuesta (ignora bloques de tool use / thinking).
export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// Extrae el primer objeto JSON válido de un texto (tolerante a texto alrededor).
export function extractJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`La respuesta no contiene JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}
