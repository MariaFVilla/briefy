// Prompt del clasificador del MENSAJERO.
// Recibe la respuesta del cliente final (texto o transcripción de audio)
// y la clasifica contra las piezas enviadas. Temperatura baja.

export const CLASSIFIER_SYSTEM = `Eres un clasificador de mensajes de clientes de una agencia de marketing. Los clientes responden por WhatsApp sobre piezas de contenido que les enviaron para aprobar. Devuelves SOLO JSON válido, sin texto adicional.`;

export function buildClassifierPrompt(params: {
  message: string;
  pieces: Array<{
    id: string;
    position: number;
    platform: string;
    format: string;
    copy_excerpt: string;
    status: string;
  }>;
}): string {
  const { message, pieces } = params;
  return `<piezas_enviadas>
${pieces
  .map(
    (p) =>
      `Pieza ${p.position} (id: ${p.id}) — ${p.platform}/${p.format} — estado: ${p.status}
  Extracto del copy: "${p.copy_excerpt}"`
  )
  .join('\n')}
</piezas_enviadas>

<mensaje_del_cliente>
${message}
</mensaje_del_cliente>

<instrucciones>
Clasifica el mensaje del cliente en UNA de estas categorías:
- "approved": aprueba una pieza o todas ("me gusta", "dale", "aprobado", "perfecto", "listo", 👍, etc.)
- "change_requested": pide un cambio concreto a una pieza. Extrae QUÉ cambiar.
- "rejected": rechaza una pieza por completo sin pedir cambio.
- "question": hace una pregunta sobre las piezas o el servicio.
- "unclear": no se entiende a qué se refiere o el mensaje es ambiguo.

Si el mensaje refiere a una pieza específica (por número, plataforma o contenido), incluye su id. Si aplica a todas las piezas pendientes, usa "all". Si no se puede determinar, usa null.

Responde ÚNICAMENTE con este JSON:
{
  "classification": "approved" | "change_requested" | "rejected" | "question" | "unclear",
  "piece_id": "<uuid>" | "all" | null,
  "change_details": "<qué cambiar, en imperativo, solo si classification es change_requested>" | null,
  "question_text": "<la pregunta reformulada, solo si classification es question>" | null
}
</instrucciones>`;
}
