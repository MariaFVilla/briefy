-- Realtime para el dashboard: cambios en batches y piezas refrescan la grilla.
alter publication supabase_realtime add table public.content_batches;
alter publication supabase_realtime add table public.pieces;
alter publication supabase_realtime add table public.client_messages;
