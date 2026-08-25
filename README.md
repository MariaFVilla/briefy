# Briefy

**El agente de contenido para agencias** — genera las piezas de todos tus clientes cada
semana, y tus clientes las aprueban conversando por WhatsApp.

SaaS multi-tenant para agencias de marketing hispanohablantes. White-label total: el
cliente final nunca sabe que Briefy existe.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS → Vercel
- **Backend:** Supabase (Postgres + RLS, Auth, Edge Functions, Realtime)
- **IA:** Claude API (`claude-sonnet-4-6`) con web search
- **WhatsApp:** 360dialog (cada agencia conecta su propio número)
- **Transcripción:** Whisper (OpenAI)

## Arquitectura de agentes

| Agente | Dónde vive | Qué hace |
|---|---|---|
| **El Productor** | `supabase/functions/producer` | Genera el batch semanal por cliente (perfil + learnings + tendencias vía web search). Regenera piezas con instrucción. |
| **El Mensajero** | `supabase/functions/messenger-send` y `messenger-webhook` | Envía piezas por WhatsApp y clasifica las respuestas (texto o audio transcrito). Nunca conversa libremente. |
| **El Aprendiz** | `supabase/functions/learn-from-feedback` | Convierte cada feedback en learnings atómicos que el Productor aplica siempre. |

**Regla de oro (human-in-the-loop):** ninguna pieza llega al cliente final sin
`approved_internal` otorgado por un humano — garantizado por trigger de base de datos
(`enforce_internal_approval`), no solo por la UI.


