# PROGRESS.md — Estado de Briefy

Última actualización: 2026-07-07 (noche)

## Resumen

Las 5 fases del MVP están implementadas **y el backend real está operando**:

- Proyecto Supabase `vtcgpjrkskiapscqnagc` con migraciones, RLS, Realtime,
  las 4 Edge Functions deployadas, secrets (`ANTHROPIC_API_KEY`,
  `D360_WEBHOOK_SECRET`) y cron semanal instalado (`briefy-weekly-producer`).
- **Smoke test real del Productor**: batch del restaurante demo generado en 84s,
  4 piezas en `draft` con web search aplicado (festivo 20 de julio detectado),
  learnings respetados y costo ($0.26 USD) registrado en `generation_logs`.
  El producer corre en dos etapas (plan con web search + piezas en paralelo)
  para caber en el límite de 150s de las Edge Functions.
- Demo verificado en navegador: login `demo@briefy.app` / `demo12345` →
  dashboard con la agencia Impulso Creativo y sus 3 clientes.
- Repo en GitHub: `Threeangletriangle/briefy` (privado), listo para importar
  en Vercel (ver README → Deploy en Vercel).

Falta solo: deploy en Vercel (lo hace el usuario importando el repo) y, para el
canal WhatsApp, la cuenta 360dialog + `OPENAI_API_KEY` (Whisper).

---

## Fase 1 — Fundación ✅

**Funciona:**
- Proyecto Next.js 14 (App Router) + TypeScript + Tailwind.
- Migraciones completas (`supabase/migrations/`):
  - `...0001_schema.sql`: 12 tablas + enums + índices + triggers.
  - `...0002_rls.sql`: RLS en TODAS las tablas (aislamiento por agencia vía JWT),
    RPCs públicos por token (`get_batch_by_token`, `respond_to_piece_by_token`),
    `set_d360_api_key` (solo owner).
  - `...0003_realtime.sql`: publicación Realtime para batches/piezas/mensajes.
- **Trigger human-in-the-loop** (`enforce_internal_approval`): una pieza no puede pasar a
  `sent_to_client`/`client_approved`/`final` con `internal_approved_by IS NULL`. A nivel DB.
- Trigger de versionado automático (`archive_piece_version`) → `piece_versions`.
- Auth: signup crea agencia + member owner vía trigger `handle_new_user`.
- Layout del dashboard con sidebar, branding de agencia y logout.
- La API key de 360dialog vive en `agency_credentials` **sin políticas RLS de lectura**
  para usuarios: solo las Edge Functions (service role) pueden leerla.

## Fase 2 — Núcleo de producción ✅

**Funciona:**
- CRUD de clientes finales + perfil completo (onboarding ~15 min) con plataformas/formatos.
- Edge Function **`producer`**:
  - Perfil + learnings activos en el prompt (XML tags `<perfil>`, `<learnings>`, `<instrucciones>`).
  - Web search (máx. 3 búsquedas) para tendencias de la semana.
  - Límite duro 1-10 piezas por cliente/semana; `max_tokens` acotado por pieza.
  - Log de tokens y costo estimado USD en `generation_logs` por cada llamada.
  - Regeneración de pieza con instrucción → vuelve a `internal_review`.
- Pantalla de batch: copy editable inline, brief visual, argumento estratégico,
  historial de versiones, Aprobar internamente / Regenerar con instrucción / Descartar,
  botón "Enviar aprobadas al cliente" (WhatsApp o link web).

## Fase 3 — Aprobación del cliente final ✅

**Funciona:**
- Vista pública `/approve/[token]`: mobile-first, branding de la agencia (color+logo),
  sin login, sin rastro de Briefy. Token único por batch, expirable (14 días al enviar).
- Aprobar / Pedir cambio por pieza → misma máquina de estados que WhatsApp.
- Cambio solicitado desde el link → regeneración automática + learning + vuelve a revisión interna.
- Función **`learn-from-feedback`**: extrae learnings atómicos (imperativos, sin duplicar
  los existentes) de cada aprobación/cambio/rechazo. Visibles y editables/desactivables
  en el perfil del cliente.
- Batch pasa a `completed` cuando no quedan piezas esperando al cliente.

## Fase 4 — WhatsApp ✅

**Funciona (código completo, requiere cuenta 360dialog para probar en vivo):**
- **`messenger-send`**: presenta el batch pieza por pieza por WhatsApp con la voz de la
  agencia (plantillas en `_shared/prompts/messenger.ts` — nunca conversa libre).
- **`messenger-webhook`** (público, `verify_jwt=false` en `config.toml`):
  - Verificación de firma HMAC SHA-256 (`D360_WEBHOOK_SECRET`, header `x-hub-signature-256`).
  - Notas de voz → descarga de media 360dialog → transcripción Whisper (español).
  - Clasificador Claude (temperatura 0.1): `approved` / `change_requested` (extrae qué
    cambiar) / `rejected` / `question` / `unclear`.
  - `question`: responde SOLO si coincide con una FAQ (con `{argumento}` de la pieza);
    si no, escala a la agencia.
  - `unclear`: pide aclaración UNA vez; si se repite, escala.
  - `change_requested`: regeneración automática (vuelve a revisión interna) + learning.
- Bandeja de conversación: historial inbound/outbound por cliente, transcripciones,
  clasificación de cada mensaje, alertas de cambios solicitados y preguntas escaladas.
- Configuración: branding, conexión WhatsApp (instrucciones + key + estado), FAQs, plan.

## Fase 5 — Pulido ✅

**Funciona:**
- Realtime en dashboard (cambios en piezas/batches refrescan la grilla).
- Cron semanal: `supabase/cron_setup.sql` (pg_cron + pg_net, lunes 6am hora local de
  cada agencia — el producer filtra por `local_hour` y salta batches existentes).
- Onboarding guiado en el dashboard (checklist de 5 pasos).
- Seeds de demo (`supabase/seed.sql`): agencia "Impulso Creativo" con restaurante,
  boutique y consultorio + learnings y FAQ de ejemplo. Login: `demo@briefy.app` / `demo12345`.

---

## Qué falta para operar (no es código)

1. **Crear el proyecto de Supabase** y correr `db push` + `functions deploy` + secrets
   (pasos exactos en README). En esta máquina no había Docker ni sesión de Supabase CLI,
   así que las migraciones no se aplicaron contra una base real.
2. **API keys**: `ANTHROPIC_API_KEY` (Productor/Mensajero/Aprendiz) y `OPENAI_API_KEY`
   (Whisper).
3. **Cuenta 360dialog** por agencia para el canal WhatsApp (el link web ya funciona sin esto).
4. **Verificación end-to-end del flujo completo** contra la base real (registro → cliente
   → batch → aprobación interna → link web → respuesta → regeneración → learnings).
   Verificado localmente: build en verde (14 rutas), login/signup renderizan con estilos,
   `/approve/[token]` degrada correctamente con token inválido, middleware redirige
   `/` → `/login` sin sesión.

## Decisiones técnicas a tener en cuenta

- Los prompts viven en `supabase/functions/_shared/prompts/` (no en `/lib/prompts/`)
  porque el CLI de Supabase garantiza el bundling dentro de `functions/`;
  `lib/prompts/README.md` lo documenta. Siguen separados de la lógica.
- El matching de mensajes entrantes de WhatsApp → cliente final se hace por los últimos
  10 dígitos del número. Si dos agencias tuvieran el mismo cliente (mismo teléfono),
  habría que guardar también el número de la agencia (metadata.display_phone_number).
- `pieces_per_week` se acota 1-10 en DB (check) y en el producer.
- El estado `pending` de WhatsApp se marca al guardar la key; el owner confirma
  manualmente `connected` cuando 360dialog verifica el número.
