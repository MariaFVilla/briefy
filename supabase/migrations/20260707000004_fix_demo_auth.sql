-- Fix de datos: elimina el usuario demo insertado por SQL en versiones
-- anteriores del seed (sus campos NULL rompen la serialización de GoTrue
-- y causan 500 en login/admin). El usuario demo correcto se crea vía
-- Admin API (ver supabase/seed.sql).
delete from auth.identities where user_id in (
  select id from auth.users where email = 'demo@briefy.app'
);
delete from auth.users where email = 'demo@briefy.app';

-- Agencias demo huérfanas (su member cascadeó con el usuario)
delete from public.agencies a
where a.name = 'Impulso Creativo'
  and not exists (select 1 from public.agency_members m where m.agency_id = a.id);

-- Tabla de debug temporal si quedó de diagnósticos
drop table if exists public._debug_users;
