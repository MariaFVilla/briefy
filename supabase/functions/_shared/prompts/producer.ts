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
  recentPieces: Array<{ platform: string; format: string; excerpt: string }>;
}): string {
  const { profile, learnings, piecesCount, weekStart, recentPieces } = params;
  return `<perfil>
${profileBlock(profile)}
</perfil>

<learnings>
${learningsBlock(learnings)}
</learnings>

<historial_reciente>
${
  recentPieces.length
    ? 'Piezas ya publicadas/generadas en semanas anteriores (NO repitas estos temas ni ángulos):\n' +
      recentPieces
        .map((p, i) => `${i + 1}. [${p.platform}/${p.format}] "${p.excerpt}"`)
        .join('\n')
    : 'Este es el primer batch del cliente — no hay historial.'
}
</historial_reciente>

<instrucciones>
1. Usa la herramienta de búsqueda web (MÁXIMO 2 búsquedas, sé rápido) para detectar tendencias de esta semana (semana del ${weekStart}) relevantes para el nicho "${profile.businessType}" en las plataformas activas: formatos que funcionan, audios/challenges, fechas conmemorativas de la semana en LATAM.
2. Diseña el plan semanal: la lista "plan" DEBE contener EXACTAMENTE ${piecesCount} elementos — ni uno más, ni uno menos. Cuenta los elementos antes de responder. Distribuye las piezas entre las plataformas activas del cliente, cada una con un ángulo distinto (que no se repitan temas). Si el negocio da para pocos temas, varía el formato y el enfoque (educativo, promocional, detrás de cámaras, prueba social, urgencia). REVISA el <historial_reciente>: no repitas temas ni ángulos ya usados en semanas anteriores. En particular, NO vuelvas a usar como hook o tema central un dato/insignia del perfil que ya aparezca en el historial (ej: los años de tradición, la historia del fundador, un premio) — esos datos solo pueden aparecer como detalle secundario. Las promos recurrentes del negocio (ej: un 2x1 semanal) sí pueden volver, pero SIEMPRE con un ángulo o mecánica distinta a la anterior.
3. Asigna a cada pieza un "objective" (pilar estratégico) y BALANCEA la mezcla de la semana — nunca todas las piezas del mismo pilar:
   - "alcance": que el negocio llegue a gente nueva (tendencias, fechas, contenido compartible).
   - "conexion": comunidad y confianza (historia, detrás de cámaras, prueba social, interacción).
   - "venta": acción directa (producto, precio, promo, reserva/CTA de compra).
   Mezcla de referencia: ~40% conexión, ~30% alcance, ~30% venta (con 3 piezas: una de cada pilar).
4. Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "trends_summary": "<3-5 líneas: qué está pasando esta semana en el nicho y las plataformas (tendencias, fechas en LATAM) y cómo lo aprovecha este plan. Escríbelo como argumento de estratega para el dueño del negocio.>",
  "plan": [
    {
      "platform": "instagram",
      "format": "post",
      "objective": "venta",
      "theme": "<tema de la pieza>",
      "angle": "<ángulo/hook específico, 1 línea>"
    }
  ]
}
Reglas del plan: "platform" solo entre las activas; "format" válido para esa plataforma (instagram: post|carrusel|reel-guion|story; facebook: post; tiktok: guion); "objective" solo alcance|conexion|venta.
</instrucciones>`;
}

// Etapa 2: generación de UNA pieza según el plan (se ejecuta en paralelo).
// El brief visual sale estructurado (metodología de brief creativo estándar).
export function buildPiecePrompt(params: {
  profile: ProducerProfileInput;
  learnings: string[];
  weekStart: string;
  trendsSummary: string;
  plan: Array<{
    platform: string;
    format: string;
    objective?: string;
    theme: string;
    angle: string;
  }>;
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
      `Pieza ${i + 1}: ${p.platform}/${p.format} — objetivo: ${p.objective ?? 'conexion'} — tema: ${p.theme} — ángulo: ${p.angle}${i === index ? '  ← ESTA ES TU PIEZA' : ''}`
  )
  .join('\n')}
</plan_semanal>

<instrucciones>
Genera SOLO la pieza ${index + 1} del plan (${item.platform}/${item.format}, objetivo: ${item.objective ?? 'conexion'}) para la semana del ${weekStart}. No repitas los ángulos de las otras piezas del plan. El copy y el CTA deben responder al objetivo de la pieza (alcance → compartible; conexion → conversación/comunidad; venta → acción de compra/reserva).

Entrega:
- "copy_text": el texto FINAL listo para publicar (caption completo con hook que resuelve en 3 segundos, desarrollo, CTA y hashtags si aplican; para guiones: guion completo con indicaciones de escena).
- "visual_brief": el brief para el diseñador humano, estructurado en estos campos:
  - "formato": formato y dimensiones (ej: "Post 1080×1350", "Carrusel 5 slides 1080×1350", "Story 1080×1920").
  - "mensaje_clave": la idea única que debe comunicar la imagen/video, en 1 línea.
  - "en_escena": qué aparece exactamente (elementos, personas, producto, texto sobre imagen).
  - "estilo": emoción a transmitir + colores y tipografía sugeridos (respeta las referencias visuales de marca).
  - "mandatorios": lo que NO puede faltar ni fallar (precio visible, logo, ortografía de la marca, etc.).
  - "cta_visual": el llamado a la acción como debe verse en la pieza.
- "strategic_argument": 2-3 líneas de por qué esta pieza funciona para ESTE negocio ESTA semana, con base en las tendencias o el perfil.
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
