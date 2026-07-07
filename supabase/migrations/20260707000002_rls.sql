-- ============================================================
-- Briefy — RLS en TODAS las tablas
-- Cada agencia solo ve sus propias filas. El acceso público por
-- token de aprobación pasa por RPCs security definer (no por RLS).
-- ============================================================

-- Agencias del usuario autenticado (security definer para evitar
-- recursión de RLS sobre agency_members).
create or replace function public.user_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.agency_members where auth_user_id = auth.uid();
$$;

create or replace function public.is_agency_member(target_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency and auth_user_id = auth.uid()
  );
$$;

-- end_client -> agencia del usuario
create or replace function public.user_owns_end_client(target_end_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.end_clients ec
    join public.agency_members am on am.agency_id = ec.agency_id
    where ec.id = target_end_client and am.auth_user_id = auth.uid()
  );
$$;

-- batch -> agencia del usuario
create or replace function public.user_owns_batch(target_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_batches cb
    join public.end_clients ec on ec.id = cb.end_client_id
    join public.agency_members am on am.agency_id = ec.agency_id
    where cb.id = target_batch and am.auth_user_id = auth.uid()
  );
$$;

-- ---------- Habilitar RLS ----------
alter table public.agencies enable row level security;
alter table public.agency_credentials enable row level security;
alter table public.agency_members enable row level security;
alter table public.end_clients enable row level security;
alter table public.client_profiles enable row level security;
alter table public.client_learnings enable row level security;
alter table public.content_batches enable row level security;
alter table public.pieces enable row level security;
alter table public.piece_versions enable row level security;
alter table public.client_messages enable row level security;
alter table public.generation_logs enable row level security;
alter table public.faq_templates enable row level security;

-- ---------- agencies ----------
create policy agencies_select on public.agencies
  for select to authenticated using (public.is_agency_member(id));
create policy agencies_update on public.agencies
  for update to authenticated using (public.is_agency_member(id));

-- agency_credentials: SIN políticas para authenticated/anon.
-- Solo service_role (Edge Functions) puede leer/escribir la API key.
-- La escritura desde la app pasa por el RPC set_d360_api_key (solo owner).
create or replace function public.set_d360_api_key(new_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_agency uuid;
begin
  select agency_id into target_agency
  from public.agency_members
  where auth_user_id = auth.uid() and role = 'owner'
  limit 1;
  if target_agency is null then
    raise exception 'Solo el owner de la agencia puede configurar la API key';
  end if;
  update public.agency_credentials
    set d360_api_key = new_key, updated_at = now()
    where agency_id = target_agency;
  update public.agencies
    set whatsapp_status = case when new_key is null or new_key = '' then 'none'::public.whatsapp_status
                               else 'pending'::public.whatsapp_status end
    where id = target_agency and whatsapp_status <> 'connected';
end;
$$;

-- ---------- agency_members ----------
create policy agency_members_select on public.agency_members
  for select to authenticated using (agency_id in (select public.user_agency_ids()));
create policy agency_members_insert on public.agency_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agency_members.agency_id
        and am.auth_user_id = auth.uid() and am.role = 'owner'
    )
  );
create policy agency_members_delete on public.agency_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.agency_members am
      where am.agency_id = agency_members.agency_id
        and am.auth_user_id = auth.uid() and am.role = 'owner'
    )
    and auth_user_id <> auth.uid()
  );

-- ---------- end_clients ----------
create policy end_clients_all on public.end_clients
  for all to authenticated
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));

-- ---------- client_profiles ----------
create policy client_profiles_all on public.client_profiles
  for all to authenticated
  using (public.user_owns_end_client(end_client_id))
  with check (public.user_owns_end_client(end_client_id));

-- ---------- client_learnings ----------
create policy client_learnings_all on public.client_learnings
  for all to authenticated
  using (public.user_owns_end_client(end_client_id))
  with check (public.user_owns_end_client(end_client_id));

-- ---------- content_batches ----------
create policy content_batches_all on public.content_batches
  for all to authenticated
  using (public.user_owns_end_client(end_client_id))
  with check (public.user_owns_end_client(end_client_id));

-- ---------- pieces ----------
create policy pieces_all on public.pieces
  for all to authenticated
  using (public.user_owns_batch(batch_id))
  with check (public.user_owns_batch(batch_id));

-- ---------- piece_versions ----------
create policy piece_versions_select on public.piece_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.pieces p
      where p.id = piece_versions.piece_id and public.user_owns_batch(p.batch_id)
    )
  );

-- ---------- client_messages ----------
create policy client_messages_all on public.client_messages
  for all to authenticated
  using (public.user_owns_end_client(end_client_id))
  with check (public.user_owns_end_client(end_client_id));

-- ---------- generation_logs ----------
create policy generation_logs_select on public.generation_logs
  for select to authenticated
  using (agency_id in (select public.user_agency_ids()));

-- ---------- faq_templates ----------
create policy faq_templates_all on public.faq_templates
  for all to authenticated
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));

-- ============================================================
-- Acceso público por token de aprobación (link web /approve/[token])
-- Solo lectura de las piezas enviadas de ese batch + registrar respuesta.
-- El anon key NUNCA toca las tablas directamente.
-- ============================================================

create or replace function public.get_batch_by_token(token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  batch record;
  result jsonb;
begin
  select cb.*, ec.name as client_name, ec.id as ec_id,
         a.name as agency_name, a.logo_url, a.brand_color
  into batch
  from public.content_batches cb
  join public.end_clients ec on ec.id = cb.end_client_id
  join public.agencies a on a.id = ec.agency_id
  where cb.approval_token = token
    and (cb.approval_token_expires_at is null or cb.approval_token_expires_at > now());

  if batch is null then
    return null;
  end if;

  select jsonb_build_object(
    'batch_id', batch.id,
    'week_start', batch.week_start,
    'status', batch.status,
    'client_name', batch.client_name,
    'agency', jsonb_build_object(
      'name', batch.agency_name,
      'logo_url', batch.logo_url,
      'brand_color', batch.brand_color
    ),
    'pieces', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'platform', p.platform,
          'format', p.format,
          'copy_text', p.copy_text,
          'visual_brief', p.visual_brief,
          'status', p.status,
          'position', p.position
        ) order by p.position)
        from public.pieces p
        where p.batch_id = batch.id
          and p.status in ('sent_to_client', 'client_approved', 'changes_requested', 'regenerating', 'final')
      ), '[]'::jsonb
    )
  ) into result;

  return result;
end;
$$;

-- Respuesta del cliente final vía web: aprobar o pedir cambio.
create or replace function public.respond_to_piece_by_token(
  token uuid,
  target_piece uuid,
  action text,
  comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  piece record;
begin
  if action not in ('approve', 'request_change') then
    raise exception 'Acción inválida';
  end if;

  select cb.* into batch
  from public.content_batches cb
  where cb.approval_token = token
    and (cb.approval_token_expires_at is null or cb.approval_token_expires_at > now());
  if batch is null then
    raise exception 'Token inválido o expirado';
  end if;

  select * into piece from public.pieces
  where id = target_piece and batch_id = batch.id;
  if piece is null then
    raise exception 'Pieza no encontrada en este batch';
  end if;
  if piece.status not in ('sent_to_client', 'changes_requested') then
    raise exception 'Esta pieza no está esperando respuesta del cliente';
  end if;

  if action = 'approve' then
    update public.pieces
      set status = 'client_approved', client_responded_at = now()
      where id = piece.id;
  else
    if comment is null or trim(comment) = '' then
      raise exception 'Indica qué te gustaría cambiar';
    end if;
    update public.pieces
      set status = 'changes_requested', client_responded_at = now()
      where id = piece.id;
  end if;

  insert into public.client_messages
    (end_client_id, batch_id, piece_id, direction, channel, raw_content, classified_as)
  values
    (batch.end_client_id, batch.id, piece.id, 'inbound', 'web',
     coalesce(comment, case when action = 'approve' then 'Aprobada desde link web' else '' end),
     case when action = 'approve' then 'approved' else 'change_requested' end);

  -- Si ya no quedan piezas esperando al cliente, el batch se completa.
  if not exists (
    select 1 from public.pieces
    where batch_id = batch.id
      and status in ('sent_to_client', 'changes_requested', 'regenerating')
  ) then
    update public.content_batches set status = 'completed' where id = batch.id;
  end if;

  return jsonb_build_object('ok', true, 'piece_id', piece.id, 'action', action);
end;
$$;

-- Permisos de ejecución: los RPCs de token son públicos (anon), el resto no.
revoke execute on function public.get_batch_by_token(uuid) from public;
revoke execute on function public.respond_to_piece_by_token(uuid, uuid, text, text) from public;
grant execute on function public.get_batch_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_to_piece_by_token(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.set_d360_api_key(text) to authenticated;
