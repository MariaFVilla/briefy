// Prompt del agente PRODUCTOR.
// Todos los prompts viven en archivos separados para iterarlos sin tocar lógica.

export interface ProducerProfileInput {
  clientName: string;
  businessType: string;
  city: string;
  businessDescription: string;
  productsServices: string;
  targetAudience: string;
  tone: string;
  forbiddenWords: string[];
  preferredWords: string[];
  visualReferences: string;
  platforms: Array<{ platform: string; formats: string[] }>;
  objectives: string;
}

export const PRODUCER_SYSTEM = `Eres el estratega de contenido senior de una agencia de marketing hispanohablante. Creas contenido para redes sociales de negocios locales en Latinoamérica.

Reglas inquebrantables:
- Escribes SIEMPRE en español neutro-latino, adaptado al tono del perfil del cliente.
- El copy usa el lenguaje de la audiencia del cliente, con hooks que resuelven en los primeros 3 segundos.
- NUNCA escribes contenido genérico: cada pieza referencia el producto, servicio o negocio real del perfil.
- PROHIBIDO inventar datos, precios, promociones, direcciones o testimonios que no estén en el perfil.
- Respetas las palabras prohibidas y priorizas las palabras preferidas del perfil.
- Respetas TODOS los learnings acumulados del cliente: son preferencias confirmadas, no sugerencias.
- Tu salida final es SOLO un objeto JSON válido, sin texto antes ni después, sin markdown.`;

function profileBlock(profile: ProducerProfileInput): string {
  const platformsText = profile.platforms.length
    ? profile.platforms
        .map((p) => `- ${p.platform}: formatos permitidos → ${p.formats.join(', ')}`)
        .join('\n')
    : '- instagram: post, carrusel, reel-guion, story\n- facebook: post';

  return `Negocio: ${profile.clientName}
Tipo de negocio: ${profile.businessType || 'no especificado'}
Ciudad: ${profile.city || 'no especificada'}
Descripción: ${profile.businessDescription || 'no especificada'}
Productos y servicios: ${profile.productsServices || 'no especificados'}
Audiencia objetivo: ${profile.targetAudience || 'no especificada'}
Tono de comunicación: ${profile.tone || 'cercano y profesional'}
Palabras prohibidas: ${profile.forbiddenWords.length ? profile.forbiddenWords.join(', ') : 'ninguna'}
Palabras preferidas: ${profile.preferredWords.length ? profile.preferredWords.join(', ') : 'ninguna'}
Referencias visuales de marca: ${profile.visualReferences || 'no especificadas'}
Objetivos de marketing: ${profile.objectives || 'aumentar visibilidad y ventas'}
Plataformas activas:
${platformsText}`;
}

function learningsBlock(learnings: string[]): string {
  return learnings.length
    ? learnings.map((l, i) => `${i + 1}. ${l}`).join('\n')
    : 'Aún no hay learnings registrados para este cliente.';
}

// Etapa 1: investigación de tendencias (web search) + plan semanal.
// El plan coordina la diversidad; las piezas se generan en paralelo después.
export function buildPlanPrompt(params: {
  profile: ProducerProfileInput;
  learnings: string[];
  piecesCount: number;
  weekStart: string;
}): string {
  const { profile, learnings, piecesCount, weekStart } = params;
  return `<perfil>
${profileBlock(profile)}
</perfil>

<learnings>
${learningsBlock(learnings)}
</learnings>

<instrucciones>
1. Usa la herramienta de búsqueda web (MÁXIMO 2 búsquedas, sé rápido) para detectar tendencias de esta semana (semana del ${weekStart}) relevantes para el nicho "${profile.businessType}" en las plataformas activas: formatos que funcionan, audios/challenges, fechas conmemorativas de la semana en LATAM.
2. Diseña el plan semanal: EXACTAMENTE ${piecesCount} piezas distribuidas entre las plataformas activas del cliente, cada una con un ángulo distinto (que no se repitan temas).
3. Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "trends_summary": "<resumen en 3-5 líneas de las tendencias encontradas y fechas relevantes>",
  "plan": [
    {
      "platform": "instagram",
      "format": "post",
      "theme": "<tema de la pieza>",
      "angle": "<ángulo/hook específico, 1 línea>"
    }
  ]
}
Reglas del plan: "platform" solo entre las activas; "format" válido para esa plataforma (instagram: post|carrusel|reel-guion|story; facebook: post; tiktok: guion).
</instrucciones>`;
}

// Etapa 2: generación de UNA pieza según el plan (se ejecuta en paralelo).
export function buildPiecePrompt(params: {
  profile: ProducerProfileInput;
  learnings: string[];
  weekStart: string;
  trendsSummary: string;
  plan: Array<{ platform: string; format: string; theme: string; angle: string }>;
  index: number;
}): string {
  const { profile, learnings, weekStart, trendsSummary, plan, index } = params;
  const item = plan[index];
  return `<perfil>
${profileBlock(profile)}
</perfil>

<learnings>
${learningsBlock(learnings)}
</learnings>

<tendencias>
${trendsSummary}
</tendencias>

<plan_semanal>
${plan
  .map(
    (p, i) =>
      `Pieza ${i + 1}: ${p.platform}/${p.format} — tema: ${p.theme} — ángulo: ${p.angle}${i === index ? '  ← ESTA ES TU PIEZA' : ''}`
  )
  .join('\n')}
</plan_semanal>

<instrucciones>
Genera SOLO la pieza ${index + 1} del plan (${item.platform}/${item.format}) para la semana del ${weekStart}. No repitas los ángulos de las otras piezas del plan.

Entrega:
- "copy_text": el texto FINAL listo para publicar (caption completo con hook que resuelve en 3 segundos, desarrollo, CTA y hashtags si aplican; para guiones: guion completo con indicaciones de escena).
- "visual_brief": instrucciones precisas para el diseñador humano: formato/dimensiones, qué aparece, emoción, colores sugeridos, tipografía sugerida.
- "strategic_argument": 2-3 líneas de por qué esta pieza funciona para ESTE negocio ESTA semana, con base en las tendencias o el perfil.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "copy_text": "...",
  "visual_brief": "...",
  "strategic_argument": "..."
}
</instrucciones>`;
}

export function buildRegeneratePrompt(params: {
  profile: ProducerProfileInput;
  learnings: string[];
  piece: {
    platform: string;
    format: string;
    copy_text: string;
    visual_brief: string;
    strategic_argument: string;
  };
  instruction: string;
}): string {
  const { profile, learnings, piece, instruction } = params;
  return `<perfil>
Negocio: ${profile.clientName}
Tipo de negocio: ${profile.businessType || 'no especificado'}
Descripción: ${profile.businessDescription || 'no especificada'}
Productos y servicios: ${profile.productsServices || 'no especificados'}
Audiencia objetivo: ${profile.targetAudience || 'no especificada'}
Tono: ${profile.tone || 'cercano y profesional'}
Palabras prohibidas: ${profile.forbiddenWords.length ? profile.forbiddenWords.join(', ') : 'ninguna'}
Palabras preferidas: ${profile.preferredWords.length ? profile.preferredWords.join(', ') : 'ninguna'}
</perfil>

<learnings>
${learnings.length ? learnings.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'Sin learnings registrados.'}
</learnings>

<pieza_actual>
Plataforma: ${piece.platform}
Formato: ${piece.format}
Copy actual: ${piece.copy_text}
Brief visual actual: ${piece.visual_brief}
Argumento estratégico actual: ${piece.strategic_argument}
</pieza_actual>

<instrucciones>
Regenera esta pieza aplicando este cambio solicitado: "${instruction}"

Mantén la plataforma y el formato. Conserva lo que funciona de la versión actual y aplica el cambio pedido con precisión. Responde ÚNICAMENTE con este JSON:
{
  "copy_text": "...",
  "visual_brief": "...",
  "strategic_argument": "..."
}
</instrucciones>`;
}
