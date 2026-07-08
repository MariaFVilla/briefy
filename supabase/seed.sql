-- ============================================================
-- Seeds de demo para Briefy (demos de venta)
--
-- El usuario demo NO se crea aquí: insertar en auth.users por SQL
-- corrompe la serialización de GoTrue (500 en login/admin).
-- Flujo correcto (README):
--   1. Ejecutar este seed (limpia restos y no hace nada más si no
--      existe el usuario demo).
--   2. Crear el usuario vía Admin API:
--      POST /auth/v1/admin/users
--      { "email": "demo@briefy.app", "password": "demo12345",
--        "email_confirm": true,
--        "user_metadata": { "agency_name": "Impulso Creativo" } }
--      (el trigger handle_new_user crea agencia + member owner)
--   3. Volver a ejecutar este seed → carga los 3 clientes demo.
-- ============================================================

-- Limpieza de versiones anteriores del seed que insertaban el usuario por SQL
delete from auth.identities where user_id = 'd0000000-0000-4000-8000-000000000001';
delete from auth.users where id = 'd0000000-0000-4000-8000-000000000001';
-- Agencias demo huérfanas (su member fue cascadeado al borrar el usuario)
delete from public.agencies a
where a.name = 'Impulso Creativo'
  and not exists (select 1 from public.agency_members m where m.agency_id = a.id);

-- Branding de la agencia demo (si ya existe el usuario creado por Admin API)
update public.agencies
set brand_color = '#7c3aed', timezone = 'America/Bogota', plan = 'founder'
where id in (
  select am.agency_id from public.agency_members am
  join auth.users u on u.id = am.auth_user_id
  where u.email = 'demo@briefy.app'
);

-- Clientes finales (solo si existe la agencia demo)
insert into public.end_clients (id, agency_id, name, business_type, city, phone_whatsapp, pieces_per_week)
select v.id, ag.agency_id, v.name, v.business_type, v.city, v.phone, v.ppw
from (
  values
    ('e0000000-0000-4000-8000-000000000001'::uuid, 'La Parrilla de Juancho', 'restaurante', 'Bogotá', '+573001112233', 5),
    ('e0000000-0000-4000-8000-000000000002'::uuid, 'Nube Rosa Boutique', 'tienda de ropa femenina', 'Medellín', '+573004445566', 4),
    ('e0000000-0000-4000-8000-000000000003'::uuid, 'OdontoSalud Dr. Ríos', 'consultorio odontológico', 'Cali', '+573007778899', 3)
) as v(id, name, business_type, city, phone, ppw)
cross join (
  select am.agency_id from public.agency_members am
  join auth.users u on u.id = am.auth_user_id
  where u.email = 'demo@briefy.app'
  limit 1
) as ag
on conflict (id) do nothing;

-- Perfiles
insert into public.client_profiles (end_client_id, business_description, products_services, target_audience, tone, forbidden_words, preferred_words, visual_references, platforms, objectives)
select * from (
  values
    (
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'Restaurante de parrilla y carnes a la brasa con 12 años de tradición familiar. Ambiente casual, porciones generosas.',
      'Cortes a la parrilla (punta de anca, churrasco), picadas para compartir, almuerzo ejecutivo entre semana $25.000, 2x1 en limonada de coco los martes.',
      'Familias y grupos de amigos de 25-50 años en el norte de Bogotá. Valoran la abundancia y el sabor casero.',
      'Cercano, con humor colombiano, antojador. Tutea al cliente.',
      array['gourmet', 'exclusivo'],
      array['a la brasa', 'tradición', 'pa'' compartir'],
      'Fotos cálidas con humo y brasas, madera rústica, rojo y negro de marca.',
      '[{"platform": "instagram", "formats": ["post", "carrusel", "reel-guion", "story"]}, {"platform": "facebook", "formats": ["post"]}]'::jsonb,
      'Llenar el restaurante entre semana y posicionar el almuerzo ejecutivo.'
    ),
    (
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'Boutique de moda femenina con curaduría de marcas locales. Colecciones pequeñas que rotan cada mes.',
      'Vestidos, blusas y accesorios de diseñadores colombianos. Nueva colección "Brisa" recién llegada. Envíos nacionales.',
      'Mujeres de 20-35 años, urbanas, que buscan piezas únicas y apoyan lo local.',
      'Fresco, inspirador, femenino sin clichés. Habla de "tu estilo".',
      array['barato', 'promoción'],
      array['hecho en Colombia', 'edición limitada', 'tu estilo'],
      'Paleta pastel, luz natural, estética editorial minimalista.',
      '[{"platform": "instagram", "formats": ["post", "carrusel", "story"]}, {"platform": "tiktok", "formats": ["guion"]}]'::jsonb,
      'Vender la nueva colección y crecer la comunidad de Instagram.'
    ),
    (
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'Consultorio odontológico especializado en estética dental y ortodoncia invisible. 15 años de experiencia.',
      'Diseño de sonrisa, blanqueamiento, ortodoncia invisible, valoración inicial sin costo.',
      'Adultos de 25-45 años en Cali que quieren mejorar su sonrisa; les da algo de miedo el odontólogo.',
      'Profesional pero cálido y tranquilizador. Nada de tecnicismos sin explicar.',
      array['dolor', 'barato'],
      array['sonrisa', 'confianza', 'valoración sin costo'],
      'Blanco y azul claro, fotos de pacientes sonriendo, consultorio moderno.',
      '[{"platform": "instagram", "formats": ["post", "carrusel", "reel-guion"]}, {"platform": "facebook", "formats": ["post"]}]'::jsonb,
      'Agendar valoraciones iniciales y desmitificar la ortodoncia invisible.'
    )
) as v(end_client_id, business_description, products_services, target_audience, tone, forbidden_words, preferred_words, visual_references, platforms, objectives)
where exists (select 1 from public.end_clients ec where ec.id = v.end_client_id)
on conflict (end_client_id) do nothing;

-- Learnings de ejemplo (el moat en acción para la demo)
insert into public.client_learnings (end_client_id, learning_text, source, active)
select * from (
  values
    ('e0000000-0000-4000-8000-000000000001'::uuid, 'Mencionar siempre el precio del almuerzo ejecutivo', 'comment'::public.learning_source, true),
    ('e0000000-0000-4000-8000-000000000001'::uuid, 'No usar la palabra "gourmet": el dueño la asocia con caro', 'rejection'::public.learning_source, true),
    ('e0000000-0000-4000-8000-000000000002'::uuid, 'Preferir carruseles con looks completos en vez de prendas sueltas', 'approval'::public.learning_source, true),
    ('e0000000-0000-4000-8000-000000000003'::uuid, 'Evitar primeros planos de instrumental dental: genera rechazo', 'rejection'::public.learning_source, true)
) as v(end_client_id, learning_text, source, active)
where exists (select 1 from public.end_clients ec where ec.id = v.end_client_id)
  and not exists (
    select 1 from public.client_learnings cl
    where cl.end_client_id = v.end_client_id and cl.learning_text = v.learning_text
  );

-- FAQ de ejemplo
insert into public.faq_templates (agency_id, question_pattern, answer_template)
select am.agency_id, '¿Por qué proponen este contenido / esta idea?', '¡Buena pregunta! La pensamos así: {argumento}'
from public.agency_members am
join auth.users u on u.id = am.auth_user_id
where u.email = 'demo@briefy.app'
  and not exists (
    select 1 from public.faq_templates f
    where f.agency_id = am.agency_id
      and f.question_pattern = '¿Por qué proponen este contenido / esta idea?'
  );

-- v2
