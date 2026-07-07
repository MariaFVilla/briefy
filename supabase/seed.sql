-- ============================================================
-- Seeds de demo para Briefy (demos de venta)
-- Usuario: demo@briefy.app / Contraseña: demo12345
-- Agencia ficticia con 3 clientes: restaurante, tienda de ropa, consultorio.
-- Se aplica con `supabase db reset` (local) o pegándolo en el SQL Editor.
-- ============================================================

-- Usuario demo (el trigger handle_new_user crea agencia + member owner)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@briefy.app',
  crypt('demo12345', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"agency_name": "Impulso Creativo"}',
  now(),
  now()
)
on conflict (id) do nothing;

-- Branding de la agencia demo
update public.agencies
set brand_color = '#7c3aed', timezone = 'America/Bogota', plan = 'founder'
where id = (
  select agency_id from public.agency_members
  where auth_user_id = 'd0000000-0000-4000-8000-000000000001'
);

-- Clientes finales
with agency as (
  select agency_id as id from public.agency_members
  where auth_user_id = 'd0000000-0000-4000-8000-000000000001'
)
insert into public.end_clients (id, agency_id, name, business_type, city, phone_whatsapp, pieces_per_week)
select * from (
  values
    ('e0000000-0000-4000-8000-000000000001'::uuid, (select id from agency), 'La Parrilla de Juancho', 'restaurante', 'Bogotá', '+573001112233', 5),
    ('e0000000-0000-4000-8000-000000000002'::uuid, (select id from agency), 'Nube Rosa Boutique', 'tienda de ropa femenina', 'Medellín', '+573004445566', 4),
    ('e0000000-0000-4000-8000-000000000003'::uuid, (select id from agency), 'OdontoSalud Dr. Ríos', 'consultorio odontológico', 'Cali', '+573007778899', 3)
) as t(id, agency_id, name, business_type, city, phone_whatsapp, pieces_per_week)
on conflict (id) do nothing;

-- Perfiles
insert into public.client_profiles (end_client_id, business_description, products_services, target_audience, tone, forbidden_words, preferred_words, visual_references, platforms, objectives)
values
  (
    'e0000000-0000-4000-8000-000000000001',
    'Restaurante de parrilla y carnes a la brasa con 12 años de tradición familiar. Ambiente casual, porciones generosas.',
    'Cortes a la parrilla (punta de anca, churrasco), picadas para compartir, almuerzo ejecutivo entre semana $25.000, 2x1 en limonada de coco los martes.',
    'Familias y grupos de amigos de 25-50 años en el norte de Bogotá. Valoran la abundancia y el sabor casero.',
    'Cercano, con humor colombiano, antojador. Tutea al cliente.',
    array['gourmet', 'exclusivo'],
    array['a la brasa', 'tradición', 'pa'' compartir'],
    'Fotos cálidas con humo y brasas, madera rústica, rojo y negro de marca.',
    '[{"platform": "instagram", "formats": ["post", "carrusel", "reel-guion", "story"]}, {"platform": "facebook", "formats": ["post"]}]',
    'Llenar el restaurante entre semana y posicionar el almuerzo ejecutivo.'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'Boutique de moda femenina con curaduría de marcas locales. Colecciones pequeñas que rotan cada mes.',
    'Vestidos, blusas y accesorios de diseñadores colombianos. Nueva colección "Brisa" recién llegada. Envíos nacionales.',
    'Mujeres de 20-35 años, urbanas, que buscan piezas únicas y apoyan lo local.',
    'Fresco, inspirador, femenino sin clichés. Habla de "tu estilo".',
    array['barato', 'promoción'],
    array['hecho en Colombia', 'edición limitada', 'tu estilo'],
    'Paleta pastel, luz natural, estética editorial minimalista.',
    '[{"platform": "instagram", "formats": ["post", "carrusel", "story"]}, {"platform": "tiktok", "formats": ["guion"]}]',
    'Vender la nueva colección y crecer la comunidad de Instagram.'
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'Consultorio odontológico especializado en estética dental y ortodoncia invisible. 15 años de experiencia.',
    'Diseño de sonrisa, blanqueamiento, ortodoncia invisible, valoración inicial sin costo.',
    'Adultos de 25-45 años en Cali que quieren mejorar su sonrisa; les da algo de miedo el odontólogo.',
    'Profesional pero cálido y tranquilizador. Nada de tecnicismos sin explicar.',
    array['dolor', 'barato'],
    array['sonrisa', 'confianza', 'valoración sin costo'],
    'Blanco y azul claro, fotos de pacientes sonriendo, consultorio moderno.',
    '[{"platform": "instagram", "formats": ["post", "carrusel", "reel-guion"]}, {"platform": "facebook", "formats": ["post"]}]',
    'Agendar valoraciones iniciales y desmitificar la ortodoncia invisible.'
  )
on conflict (end_client_id) do nothing;

-- Learnings de ejemplo (el moat en acción para la demo)
insert into public.client_learnings (end_client_id, learning_text, source, active)
values
  ('e0000000-0000-4000-8000-000000000001', 'Mencionar siempre el precio del almuerzo ejecutivo', 'comment', true),
  ('e0000000-0000-4000-8000-000000000001', 'No usar la palabra "gourmet": el dueño la asocia con caro', 'rejection', true),
  ('e0000000-0000-4000-8000-000000000002', 'Preferir carruseles con looks completos en vez de prendas sueltas', 'approval', true),
  ('e0000000-0000-4000-8000-000000000003', 'Evitar primeros planos de instrumental dental: genera rechazo', 'rejection', true)
on conflict do nothing;

-- FAQ de ejemplo
insert into public.faq_templates (agency_id, question_pattern, answer_template)
select agency_id, '¿Por qué proponen este contenido / esta idea?', '¡Buena pregunta! La pensamos así: {argumento}'
from public.agency_members
where auth_user_id = 'd0000000-0000-4000-8000-000000000001'
on conflict do nothing;
