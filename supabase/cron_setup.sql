-- ============================================================
-- Cron semanal del Productor — ejecutar UNA VEZ en el SQL Editor
-- del proyecto de Supabase (no es una migración porque necesita
-- la URL de TU proyecto y tu service role key).
--
-- Reemplaza:
--   <PROJECT_REF>       → ref de tu proyecto (abcdefgh en https://abcdefgh.supabase.co)
--   <SERVICE_ROLE_KEY>  → Settings > API > service_role
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Corre cada hora los lunes entre 9:00 y 13:00 UTC (cubre 6am local en
-- UTC-3 a UTC-7, todas las zonas de LATAM). El producer solo genera para
-- las agencias donde son las 6am (local_hour) y salta batches ya existentes.
select cron.schedule(
  'briefy-weekly-producer',
  '0 9-13 * * 1',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/producer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('all_agencies', true, 'local_hour', 6)
  );
  $$
);
