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

## Setup

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Vincula y aplica migraciones:
   ```bash
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
3. Configura los secrets de las Edge Functions:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase secrets set OPENAI_API_KEY=sk-...        # Whisper (audios de WhatsApp)
   npx supabase secrets set D360_WEBHOOK_SECRET=...      # firma del webhook
   ```
4. Deploya las funciones:
   ```bash
   npx supabase functions deploy producer
   npx supabase functions deploy learn-from-feedback
   npx supabase functions deploy messenger-send
   npx supabase functions deploy messenger-webhook --no-verify-jwt
   ```
5. Cron semanal (lunes 6am hora de cada agencia): abre `supabase/cron_setup.sql`,
   reemplaza los placeholders y ejecútalo en el SQL Editor.
6. (Opcional, demo) Ejecuta `supabase/seed.sql` en el SQL Editor →
   usuario `demo@briefy.app` / `demo12345` con 3 clientes de ejemplo.

### 2. Frontend

```bash
cp .env.example .env.local   # completa con las keys de tu proyecto
npm install
npm run dev
```

Deploy en Vercel: importa el repo y define las mismas variables de `.env.example`
(más `NEXT_PUBLIC_APP_URL` con tu dominio).

### 3. WhatsApp (por agencia)

Cada agencia conecta su número desde **Configuración** en el dashboard:
API key de 360dialog + webhook apuntando a
`https://TU_PROJECT_REF.supabase.co/functions/v1/messenger-webhook`.
Mientras el número no esté verificado, el link web de aprobación (`/approve/[token]`)
cubre el mismo flujo.

## Estado del proyecto

Ver [PROGRESS.md](PROGRESS.md).
