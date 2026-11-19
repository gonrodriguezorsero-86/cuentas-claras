-- RN Consultorio · base de datos (etapa 1)
-- Pegar completo en Supabase → SQL Editor → Run. Se puede volver a correr sin romper nada.

create extension if not exists btree_gist;

-- ---------- personal (quién puede entrar) ----------
create table if not exists public.personal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  rol text not null default 'secretaria' check (rol in ('admin','profesional','secretaria')),
  profesional_id uuid,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create or replace function public.es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.personal where user_id = auth.uid() and activo);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.personal where user_id = auth.uid() and activo and rol = 'admin');
$$;

-- El primer usuario que se registra queda como administrador; los demás quedan pendientes.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.personal) then
    insert into public.personal (user_id, nombre, email, rol)
    values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), coalesce(new.email, ''), 'admin');
  end if;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Usuarios registrados que todavía no tienen acceso (solo lo ve el administrador)
create or replace function public.usuarios_pendientes()
returns table (user_id uuid, email text, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where public.es_admin() and not exists (select 1 from public.personal p where p.user_id = u.id)
  order by u.created_at desc;
$$;

-- ---------- profesionales ----------
create table if not exists public.profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  titulo text not null default 'Dr.',
  color text not null default '#F5C400',
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- ---------- pacientes ----------
create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null default '',
  dni text not null default '',
  telefono text not null default '',
  email text not null default '',
  fecha_nac date,
  obra_social text not null default '',
  nro_afiliado text not null default '',
  direccion text not null default '',
  como_nos_conocio text not null default '',
  acepta_whatsapp boolean not null default false,
  notas text not null default '',
  activo boolean not null default true,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists pacientes_busqueda on public.pacientes (lower(apellido), lower(nombre));

-- ---------- turnos ----------
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes(id) on delete set null,
  profesional_id uuid references public.profesionales(id) on delete set null,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text not null default '',
  estado text not null default 'reservado'
    check (estado in ('reservado','confirmado','atendido','ausente','cancelado')),
  notas text not null default '',
  origen text not null default 'manual',
  recordatorio_enviado timestamptz,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  check (fin > inicio)
);
create index if not exists turnos_inicio on public.turnos (inicio);
create index if not exists turnos_paciente on public.turnos (paciente_id);

-- Un profesional no puede tener dos turnos superpuestos (los cancelados no cuentan)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_sin_superposicion') then
    alter table public.turnos add constraint turnos_sin_superposicion
      exclude using gist (profesional_id with =, tstzrange(inicio, fin) with &&)
      where (estado <> 'cancelado' and profesional_id is not null);
  end if;
end $$;

-- ---------- laboratorio G3 ----------
create table if not exists public.lab_trabajos (
  id text primary key,
  cliente text not null default 'Sin asignar',
  paciente text not null default '',
  trabajo text not null default 'Trabajo',
  ingreso date,
  entrega date,
  estado text not null default 'Pendiente',
  entregado date,
  notas text not null default '',
  origen text not null default '',
  carpeta text not null default '',
  precio numeric not null default 0,
  borrado boolean not null default false,
  actualizado timestamptz not null default now()
);

-- ---------- configuración (horarios, plantillas de mensajes) ----------
create table if not exists public.config (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);

insert into public.config (clave, valor) values
  ('consultorio', jsonb_build_object(
    'nombre', 'RN Odontología',
    'sede', 'Avellaneda',
    'direccion', '',
    'hora_desde', '13:00',
    'hora_hasta', '19:30',
    'duracion', 30,
    'dias', jsonb_build_array(1,2,3,4,5))),
  ('plantillas', jsonb_build_object(
    'recordatorio', 'Hola {nombre}! Te recordamos tu turno en RN Odontología el {dia} a las {hora} con {profesional}. Respondé SI para confirmar o escribinos si necesitás cambiarlo.',
    'cumpleanos', '¡Feliz cumpleaños, {nombre}! Todo el equipo de RN Odontología te desea un gran día.',
    'control', 'Hola {nombre}! Ya pasaron 6 meses de tu última visita a RN Odontología. ¿Coordinamos tu control?'))
on conflict (clave) do nothing;

-- ---------- fecha de actualización automática ----------
create or replace function public.marcar_actualizado() returns trigger
language plpgsql as $$ begin new.actualizado = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['pacientes','turnos','lab_trabajos','config'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_actualizado', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.marcar_actualizado()', t || '_actualizado', t);
  end loop;
end $$;

-- ---------- seguridad: solo el personal habilitado ve y edita ----------
do $$ declare t text; begin
  foreach t in array array['profesionales','pacientes','turnos','lab_trabajos','config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists personal_todo on public.%I', t);
    execute format('create policy personal_todo on public.%I for all to authenticated using (public.es_personal()) with check (public.es_personal())', t);
  end loop;
end $$;

alter table public.personal enable row level security;
drop policy if exists personal_ver on public.personal;
create policy personal_ver on public.personal for select to authenticated
  using (public.es_personal() or user_id = auth.uid());
drop policy if exists personal_admin on public.personal;
create policy personal_admin on public.personal for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on function public.usuarios_pendientes() from public, anon;
grant execute on function public.usuarios_pendientes() to authenticated;
grant execute on function public.es_personal() to authenticated;
grant execute on function public.es_admin() to authenticated;

-- ---------- permisos para usuarios con sesión (la seguridad por fila sigue aplicando) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- =====================================================================
-- Etapa 1b · Sedes (Avellaneda y Campana) y permisos por sede
-- Se puede correr varias veces.
-- =====================================================================

create table if not exists public.sedes (
  id text primary key,
  nombre text not null,
  direccion text not null default '',
  hora_desde text not null default '13:00',
  hora_hasta text not null default '19:30',
  duracion int not null default 30,
  dias jsonb not null default '[1,2,3,4,5]',
  activo boolean not null default true,
  creado timestamptz not null default now()
);
insert into public.sedes (id, nombre) values ('avellaneda', 'Avellaneda'), ('campana', 'Campana')
on conflict (id) do nothing;

-- Pasar el horario que ya estaba cargado a la sede Avellaneda
update public.sedes s set
  direccion = coalesce(c.valor->>'direccion', s.direccion),
  hora_desde = coalesce(c.valor->>'hora_desde', s.hora_desde),
  hora_hasta = coalesce(c.valor->>'hora_hasta', s.hora_hasta),
  duracion = coalesce((c.valor->>'duracion')::int, s.duracion),
  dias = coalesce(c.valor->'dias', s.dias)
from public.config c
where c.clave = 'consultorio' and s.id = 'avellaneda' and not coalesce((c.valor->>'migrado')::boolean, false);
update public.config set valor = valor || '{"migrado": true}' where clave = 'consultorio';

alter table public.personal add column if not exists sedes text[] not null default '{avellaneda}';
alter table public.profesionales add column if not exists sede_id text not null default 'avellaneda' references public.sedes(id);
alter table public.pacientes add column if not exists sede_id text not null default 'avellaneda' references public.sedes(id);
alter table public.turnos add column if not exists sede_id text not null default 'avellaneda' references public.sedes(id);
create index if not exists pacientes_sede on public.pacientes (sede_id);
create index if not exists turnos_sede on public.turnos (sede_id, inicio);

-- Los administradores tienen todas las sedes
update public.personal set sedes = array(select id from public.sedes) where rol = 'admin';

-- ---------- funciones de permisos ----------
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.personal where user_id = auth.uid() and activo;
$$;

create or replace function public.puede_sede(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.personal
                 where user_id = auth.uid() and activo and (rol = 'admin' or s = any(sedes)));
$$;

create or replace function public.mi_profesional() returns uuid
language sql stable security definer set search_path = public as $$
  select profesional_id from public.personal where user_id = auth.uid() and activo;
$$;

-- El primer usuario queda administrador de todas las sedes
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.personal) then
    insert into public.personal (user_id, nombre, email, rol, sedes)
    values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), coalesce(new.email, ''), 'admin',
            array(select id from public.sedes));
  end if;
  return new;
end $$;

-- Usuarios pendientes: ahora también con el nombre que pusieron al registrarse
drop function if exists public.usuarios_pendientes();
create or replace function public.usuarios_pendientes()
returns table (user_id uuid, email text, nombre text, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'nombre', ''), u.created_at
  from auth.users u
  where public.es_admin() and not exists (select 1 from public.personal p where p.user_id = u.id)
  order by u.created_at desc;
$$;
revoke all on function public.usuarios_pendientes() from public, anon;
grant execute on function public.usuarios_pendientes() to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.puede_sede(text) to authenticated;
grant execute on function public.mi_profesional() to authenticated;

-- ---------- reglas de acceso ----------
alter table public.sedes enable row level security;
drop policy if exists sedes_ver on public.sedes;
create policy sedes_ver on public.sedes for select to authenticated using (public.puede_sede(id));
drop policy if exists sedes_admin on public.sedes;
create policy sedes_admin on public.sedes for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- profesionales y pacientes: cada uno ve los de sus sedes
drop policy if exists personal_todo on public.profesionales;
drop policy if exists por_sede on public.profesionales;
create policy por_sede on public.profesionales for all to authenticated
  using (public.puede_sede(sede_id)) with check (public.puede_sede(sede_id));

drop policy if exists personal_todo on public.pacientes;
drop policy if exists por_sede on public.pacientes;
create policy por_sede on public.pacientes for all to authenticated
  using (public.puede_sede(sede_id)) with check (public.puede_sede(sede_id));

-- turnos: admin y secretaria ven la agenda de la sede; un profesional ve solo la suya
drop policy if exists personal_todo on public.turnos;
drop policy if exists por_sede on public.turnos;
create policy por_sede on public.turnos for all to authenticated
  using (public.puede_sede(sede_id) and (public.mi_rol() <> 'profesional' or profesional_id = public.mi_profesional()))
  with check (public.puede_sede(sede_id) and (public.mi_rol() <> 'profesional' or profesional_id = public.mi_profesional()));

-- laboratorio G3: solo administradores
drop policy if exists personal_todo on public.lab_trabajos;
drop policy if exists solo_admin on public.lab_trabajos;
create policy solo_admin on public.lab_trabajos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- configuración (mensajes): todos la leen, solo admin la cambia
drop policy if exists personal_todo on public.config;
drop policy if exists config_ver on public.config;
create policy config_ver on public.config for select to authenticated using (public.es_personal());
drop policy if exists config_admin on public.config;
create policy config_admin on public.config for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on all tables in schema public to authenticated;
