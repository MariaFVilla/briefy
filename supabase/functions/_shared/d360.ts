// Cliente de 360dialog (WhatsApp Business API).
// Cada agencia conecta SU propio número: la API key viene de agency_credentials.

const D360_BASE = 'https://waba-v2.360dialog.io';

export async function sendWhatsAppText(params: {
  apiKey: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${D360_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': params.apiKey,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to.replace(/[^\d]/g, ''),
      type: 'text',
      text: { body: params.body },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[d360] send error:', res.status, text);
    return { ok: false, error: `360dialog ${res.status}: ${text}` };
  }
  return { ok: true };
}

// Descarga un archivo de media (nota de voz) de 360dialog.
export async function downloadMedia(params: {
  apiKey: string;
  mediaId: string;
}): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  // 1. Obtener la URL del media
  const metaRes = await fetch(`${D360_BASE}/${params.mediaId}`, {
    headers: { 'D360-API-KEY': params.apiKey },
  });
  if (!metaRes.ok) {
    console.error('[d360] media meta error:', metaRes.status, await metaRes.text());
    return null;
  }
  const meta = await metaRes.json();
  const mediaUrl: string = meta.url;
  const mimeType: string = meta.mime_type ?? 'audio/ogg';

  // 2. Descargar el binario (la URL de Meta se reescribe al host de 360dialog)
  const url = mediaUrl.replace(/^https:\/\/lookaside\.fbsbx\.com/, D360_BASE);
  const fileRes = await fetch(url, { headers: { 'D360-API-KEY': params.apiKey } });
  if (!fileRes.ok) {
    console.error('[d360] media download error:', fileRes.status);
    return null;
  }
  return { bytes: new Uint8Array(await fileRes.arrayBuffer()), mimeType };
}

// Verificación de firma del webhook (HMAC SHA-256, header x-hub-signature-256).
export async function verifyWebhookSignature(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<boolean> {
  if (!params.signatureHeader) return false;
  const expected = params.signatureHeader.replace('sha256=', '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(params.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(params.rawBody)
  );
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Comparación en tiempo constante
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Transcripción de notas de voz con Whisper (OpenAI).
export async function transcribeAudio(params: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('[whisper] OPENAI_API_KEY no configurada');
    return null;
  }
  const ext = params.mimeType.includes('mpeg') ? 'mp3' : 'ogg';
  const form = new FormData();
  form.append('file', new Blob([params.bytes], { type: params.mimeType }), `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    console.error('[whisper] error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.text ?? null;
}
