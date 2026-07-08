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
   reemplaza los placeholders y ejecútalo:
   ```bash
   npx supabase db query --linked -f supabase/cron_setup.sql
   ```
6. (Opcional, demo) Datos de demo — 3 pasos, en este orden:
   ```bash
   # 1. Crear el usuario demo vía Admin API (NO por SQL: corrompe GoTrue)
   curl -X POST "https://TU_PROJECT_REF.supabase.co/auth/v1/admin/users" \
     -H "apikey: SERVICE_ROLE_KEY" -H "Authorization: Bearer SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@briefy.app","password":"demo12345","email_confirm":true,"user_metadata":{"agency_name":"Impulso Creativo"}}'
   # 2. Cargar clientes/perfiles/learnings de demo
   npx supabase db query --linked -f supabase/seed.sql
   ```
   → usuario `demo@briefy.app` / `demo12345` con 3 clientes de ejemplo.

### 2. Frontend

```bash
cp .env.example .env.local   # completa con las keys de tu proyecto
npm install
npm run dev
```

### Deploy en Vercel

1. En [vercel.com/new](https://vercel.com/new) importa el repo `Threeangletriangle/briefy`
   (framework: Next.js, sin cambiar nada más).
2. En **Environment Variables** pega estas 4:
   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (Dashboard > Settings > API Keys > Legacy) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (misma página) |
   | `NEXT_PUBLIC_APP_URL` | tu dominio de Vercel (ej: `https://briefy.vercel.app`) |
3. Deploy. Si aún no conoces el dominio, deploya primero, copia el dominio asignado,
   actualiza `NEXT_PUBLIC_APP_URL` y redeploya (afecta los links de aprobación).

### 3. WhatsApp (por agencia)

Cada agencia conecta su número desde **Configuración** en el dashboard:
API key de 360dialog + webhook apuntando a
`https://TU_PROJECT_REF.supabase.co/functions/v1/messenger-webhook`.
Mientras el número no esté verificado, el link web de aprobación (`/approve/[token]`)
cubre el mismo flujo.

## Estado del proyecto

Ver [PROGRESS.md](PROGRESS.md).
