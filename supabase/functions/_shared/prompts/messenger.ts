// Textos y plantillas del MENSAJERO.
// El Mensajero NUNCA conversa libremente: usa estas plantillas.
// Habla SIEMPRE como la agencia — nunca menciona Briefy ni IA.

export function presentBatchMessage(params: {
  clientName: string;
  agencyName: string;
  piecesCount: number;
  weekStart: string;
}): string {
  const { clientName, piecesCount } = params;
  return `¡Hola! 👋 Somos tu equipo de marketing. Te compartimos las ${piecesCount} piezas de contenido de esta semana para ${clientName}.

Te las enviamos una por una. Para cada una puedes responder:
✅ "Aprobada" si te gusta
✏️ O contarnos qué te gustaría cambiar (puedes mandar audio si prefieres)`;
}

export function presentPieceMessage(params: {
  position: number;
  total: number;
  platform: string;
  format: string;
  copyText: string;
}): string {
  const { position, total, platform, format, copyText } = params;
  const platformLabel =
    platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'TikTok';
  return `📄 Pieza ${position} de ${total} — ${platformLabel} (${format})

${copyText}`;
}

export function approvalConfirmation(): string {
  return `¡Excelente! ✅ Quedó aprobada. Gracias por tu respuesta.`;
}

export function allApprovedMessage(): string {
  return `🎉 ¡Todas las piezas de la semana quedaron aprobadas! El equipo ya se pone manos a la obra con los diseños. Que tengas una gran semana.`;
}

export function changeRegisteredMessage(): string {
  return `¡Anotado! ✏️ El equipo ajusta la pieza con tu comentario y te la compartimos de nuevo apenas esté lista.`;
}

export function rejectionRegisteredMessage(): string {
  return `Entendido, descartamos esa pieza. El equipo la revisa y te propone algo distinto.`;
}

export function questionEscalatedMessage(): string {
  return `¡Buena pregunta! Le paso tu consulta al equipo y te responden pronto por aquí. 🙌`;
}

export function clarificationRequestMessage(): string {
  return `Disculpa, no me quedó claro a qué pieza te refieres. 🙏 ¿Me indicas el número de la pieza (por ejemplo "la 2") y qué te gustaría hacer con ella?`;
}

export function escalatedToTeamMessage(): string {
  return `Gracias por tu mensaje. Se lo comparto al equipo para que te ayuden directamente por aquí. 🙌`;
}
