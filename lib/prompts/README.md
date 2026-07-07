# Prompts de Briefy

Los prompts internos viven en [`supabase/functions/_shared/prompts/`](../../supabase/functions/_shared/prompts/)
para que las Edge Functions (Deno) puedan importarlos de forma garantizada al deployar.

| Archivo | Agente |
|---|---|
| `producer.ts` | El Productor — generación del batch semanal y regeneración de piezas |
| `classifier.ts` | El Mensajero — clasificación de respuestas del cliente final |
| `learnings.ts` | El Aprendiz — extracción de learnings del feedback |
| `messenger.ts` | El Mensajero — plantillas de mensajes salientes (nunca conversa libre) |

Son archivos puros (solo funciones que devuelven strings): se pueden iterar
sin tocar la lógica de las funciones.
