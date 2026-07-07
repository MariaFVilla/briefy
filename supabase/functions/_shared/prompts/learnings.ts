// Prompt del extractor de learnings (El Aprendiz).
// Convierte feedback del cliente en reglas atómicas y accionables.

export const LEARNINGS_SYSTEM = `Eres un analista que convierte feedback de clientes sobre contenido de redes sociales en reglas de aprendizaje atómicas para futuras generaciones de contenido. Devuelves SOLO JSON válido.`;

export function buildLearningsPrompt(params: {
  feedbackType: 'approval' | 'rejection' | 'comment';
  feedbackText: string;
  piece: {
    platform: string;
    format: string;
    copy_text: string;
  } | null;
  existingLearnings: string[];
}): string {
  const { feedbackType, feedbackText, piece, existingLearnings } = params;
  return `<pieza>
${
  piece
    ? `Plataforma: ${piece.platform}
Formato: ${piece.format}
Copy: ${piece.copy_text}`
    : 'Feedback general, no asociado a una pieza específica.'
}
</pieza>

<feedback>
Tipo: ${feedbackType === 'approval' ? 'aprobación' : feedbackType === 'rejection' ? 'rechazo' : 'comentario/cambio solicitado'}
Texto: "${feedbackText}"
</feedback>

<learnings_existentes>
${existingLearnings.length ? existingLearnings.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'Ninguno todavía.'}
</learnings_existentes>

<instrucciones>
Extrae 0 a 3 learnings NUEVOS a partir de este feedback. Reglas:
- Cada learning es UNA regla atómica y accionable, escrita en imperativo ("No usar tono formal", "Mencionar precios cuando existan", "Evitar emojis en TikTok").
- Solo extrae learnings que apliquen a futuras piezas, no observaciones puntuales de una sola pieza.
- NO repitas ni parafrasees learnings existentes.
- Si el feedback no aporta ningún patrón nuevo (ej: un simple "ok"), devuelve una lista vacía.

Responde ÚNICAMENTE con este JSON:
{
  "learnings": ["<regla 1>", "<regla 2>"]
}
</instrucciones>`;
}
