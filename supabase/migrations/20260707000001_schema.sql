-- ============================================================
-- Briefy — Esquema base
-- Multi-tenant: cada agencia solo ve sus propias filas (RLS).
-- Regla de oro: ninguna pieza llega al cliente final sin
-- aprobación interna humana (trigger, no solo UI).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.whatsapp_status as enum ('none', 'pending', 'connected');
create type public.agency_plan as enum ('starter', 'growth', 'pro', 'founder');
create type public.member_role as enum ('owner', 'editor');
create type public.batch_status as enum ('generating', 'internal_review', 'sent', 'completed');
create type public.piece_status as enum (
  'draft', 'internal_review', 'approved_internal', 'sent_to_client',
  'client_approved', 'changes_requested', 'regenerating', 'rejected', 'final'
);
create type public.learning_source as enum ('approval', 'rejection', 'comment');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_channel as enum ('whatsapp', 'web');

-- ---------- Tablas ----------

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  brand_color text default '#4f46e5',
  whatsapp_status public.whatsapp_status not null default 'none',
  plan public.agency_plan not null default 'starter',
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now()
);

-- Credenciales sensibles separadas de agencies: RLS sin políticas para
-- authenticated => solo service_role (Edge Functions) puede leerlas.
create table public.agency_credentials (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  d360_api_key text,
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (agency_id, auth_user_id)
);

create table public.end_clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  business_type text,
  city text,
  phone_whatsapp text,
  pieces_per_week int not null default 5 check (pieces_per_week between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  end_client_id uuid not null unique references public.end_clients(id) on delete cascade,
  business_description text,
  products_services text,
  target_audience text,
  tone text,
  forbidden_words text[] not null default '{}',
  preferred_words text[] not null default '{}',
  visual_references text,
  platforms jsonb not null default '[]',
  objectives text,
  updated_at timestamptz not null default now()
);

create table public.client_learnings (
  id uuid primary key default gen_random_uuid(),
  end_client_id uuid not null references public.end_clients(id) on delete cascade,
  learning_text text not null,
  source public.learning_source not null,
  source_piece_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.content_batches (
  id uuid primary key default gen_random_uuid(),
  end_client_id uuid not null references public.end_clients(id) on delete cascade,
  week_start date not null,
  status public.batch_status not null default 'generating',
  approval_token uuid not null unique default gen_random_uuid(),
  approval_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (end_client_id, week_start)
);

create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.content_batches(id) on delete cascade,
  platform text not null,
  format text not null,
  copy_text text not null default '',
  visual_brief text not null default '',
  strategic_argument text not null default '',
  status public.piece_status not null default 'draft',
  internal_approved_by uuid references public.agency_members(id),
  internal_approved_at timestamptz,
  client_responded_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.client_learnings
  add constraint client_learnings_source_piece_fk
  foreign key (source_piece_id) references public.pieces(id) on delete set null;

create table public.piece_versions (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces(id) on delete cascade,
  version_number int not null,
  copy_text text not null,
  visual_brief text not null,
  strategic_argument text not null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (piece_id, version_number)
);

create table public.client_messages (
  id uuid primary key default gen_random_uuid(),
  end_client_id uuid not null references public.end_clients(id) on delete cascade,
  batch_id uuid references public.content_batches(id) on delete set null,
  piece_id uuid references public.pieces(id) on delete set null,
  direction public.message_direction not null,
  channel public.message_channel not null,
  raw_content text not null,
  transcription text,
  media_url text,
  classified_as text,
  created_at timestamptz not null default now()
);

create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  batch_id uuid references public.content_batches(id) on delete set null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  model text not null,
  created_at timestamptz not null default now()
);

create table public.faq_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  question_pattern text not null,
  answer_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index on public.agency_members (auth_user_id);
create index on public.agency_members (agency_id);
create index on public.end_clients (agency_id);
create index on public.client_learnings (end_client_id) where active;
create index on public.content_batches (end_client_id, week_start desc);
create index on public.pieces (batch_id, position);
create index on public.client_messages (end_client_id, created_at desc);
create index on public.generation_logs (agency_id, created_at desc);
create index on public.faq_templates (agency_id) where active;

-- ---------- Triggers ----------

-- REGLA DE ORO (human-in-the-loop): una pieza no puede pasar a un estado
-- visible por el cliente final sin aprobación interna humana registrada.
create or replace function public.enforce_internal_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('sent_to_client', 'client_approved', 'final')
     and new.internal_approved_by is null then
    raise exception
      'La pieza % no puede pasar a "%" sin aprobación interna humana (internal_approved_by es NULL)',
      new.id, new.status;
  end if;
  if new.status = 'approved_internal' and new.internal_approved_by is null then
    raise exception
      'approved_internal requiere internal_approved_by (miembro humano de la agencia)';
  end if;
  return new;
end;
$$;

create trigger trg_pieces_enforce_internal_approval
  before insert or update on public.pieces
  for each row execute function public.enforce_internal_approval();

-- Versionado automático: cada vez que cambia el contenido de una pieza,
-- se archiva la versión anterior.
create or replace function public.archive_piece_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version int;
begin
  if old.copy_text is distinct from new.copy_text
     or old.visual_brief is distinct from new.visual_brief
     or old.strategic_argument is distinct from new.strategic_argument then
    select coalesce(max(version_number), 0) + 1 into next_version
    from public.piece_versions where piece_id = old.id;
    insert into public.piece_versions
      (piece_id, version_number, copy_text, visual_brief, strategic_argument, change_reason)
    values
      (old.id, next_version, old.copy_text, old.visual_brief, old.strategic_argument,
       coalesce(current_setting('briefy.change_reason', true), 'edición'));
  end if;
  return new;
end;
$$;

create trigger trg_pieces_archive_version
  before update on public.pieces
  for each row execute function public.archive_piece_version();

-- updated_at automático en perfiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_client_profiles_touch
  before update on public.client_profiles
  for each row execute function public.touch_updated_at();

-- Al crear un usuario en auth.users se crea su agencia + membresía owner.
-- El nombre de la agencia viaja en raw_user_meta_data.agency_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
  agency_name text;
begin
  agency_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'agency_name'), ''), 'Mi Agencia');
  insert into public.agencies (name) values (agency_name) returning id into new_agency_id;
  insert into public.agency_credentials (agency_id) values (new_agency_id);
  insert into public.agency_members (agency_id, auth_user_id, role)
  values (new_agency_id, new.id, 'owner');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
