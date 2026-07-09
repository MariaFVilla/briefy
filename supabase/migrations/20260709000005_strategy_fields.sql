-- Capa estratégica del batch:
-- - trends_summary: la "historia de tendencias" que justifica el plan semanal
--   (antes se descartaba tras generar; ahora se muestra en el batch).
-- - objective: pilar de cada pieza (alcance | conexion | venta) para
--   garantizar mezcla balanceada y dar lenguaje de estratega a la agencia.

alter table public.content_batches
  add column if not exists trends_summary text;

alter table public.pieces
  add column if not exists objective text
  check (objective is null or objective in ('alcance', 'conexion', 'venta'));
