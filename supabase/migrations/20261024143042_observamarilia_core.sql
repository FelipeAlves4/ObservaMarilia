-- ObservaMarília core domain.  All write paths below are RPCs so that the
-- workflow is validated in PostgreSQL, not by the browser.
create type public.app_role as enum ('citizen', 'manager', 'collaborator');
create type public.account_status as enum ('active', 'suspended');
create type public.occurrence_status as enum (
  'Nova', 'Em análise', 'Programada', 'Em execução', 'Aguardando validação', 'Resolvida'
);
create type public.occurrence_priority as enum ('Alta', 'Média', 'Baixa');
create type public.media_kind as enum ('report', 'evidence');
create type public.execution_kind as enum ('progress', 'conclusion');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'citizen',
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 100),
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.collaborators (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  phone text not null check (char_length(trim(phone)) between 8 and 30),
  employee_code text not null unique check (char_length(trim(employee_code)) between 2 and 40),
  team_id uuid not null references public.teams(id) on delete restrict,
  job_title text not null check (char_length(trim(job_title)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.occurrence_protocol_sequence;

create table public.occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  protocol text not null unique,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 5 and 100),
  category text not null check (category in ('Pavimentação', 'Iluminação', 'Lixo e limpeza', 'Árvores', 'Outros')),
  description text not null check (char_length(trim(description)) between 10 and 1200),
  address text not null check (char_length(trim(address)) between 5 and 160),
  neighborhood text not null check (char_length(trim(neighborhood)) between 2 and 80),
  region text not null check (region in ('Zona Norte', 'Centro', 'Zona Leste', 'Zona Sul', 'Zona Oeste')),
  latitude numeric(9,6),
  longitude numeric(9,6),
  priority public.occurrence_priority not null,
  status public.occurrence_status not null default 'Nova',
  team_id uuid references public.teams(id) on delete restrict,
  triage_reason text not null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or
         (latitude between -90 and 90 and longitude between -180 and 180)),
  check ((status = 'Resolvida' and resolved_at is not null) or
         (status <> 'Resolvida' and resolved_at is null))
);

create table public.assignments (
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (occurrence_id, collaborator_id)
);

create table public.execution_updates (
  id bigint generated always as identity primary key,
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete restrict,
  kind public.execution_kind not null,
  note text not null check (char_length(trim(note)) between 5 and 1000),
  progress smallint check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.occurrence_media (
  id uuid primary key default extensions.gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  execution_update_id bigint unique references public.execution_updates(id) on delete cascade,
  kind public.media_kind not null,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 2097152),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((kind = 'report' and execution_update_id is null) or
         (kind = 'evidence' and execution_update_id is not null))
);

create table public.occurrence_history (
  id bigint generated always as identity primary key,
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  action text not null check (action in ('created', 'triaged', 'assigned', 'started', 'progress', 'concluded', 'approved', 'returned')),
  title text not null,
  note text not null,
  from_status public.occurrence_status,
  to_status public.occurrence_status,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index occurrences_created_at_idx on public.occurrences (created_at desc);
create index occurrences_status_region_category_idx on public.occurrences (status, region, category);
create index occurrences_reporter_idx on public.occurrences (reporter_id, created_at desc);
create index assignments_collaborator_idx on public.assignments (collaborator_id, occurrence_id);
create index execution_updates_occurrence_idx on public.execution_updates (occurrence_id, created_at);
create index occurrence_history_occurrence_idx on public.occurrence_history (occurrence_id, created_at);
create index occurrence_media_occurrence_idx on public.occurrence_media (occurrence_id);

insert into public.teams (name, description) values
  ('Equipe Norte 02', 'Atendimento urbano da região norte'),
  ('Equipe Centro 01', 'Atendimento urbano da região central'),
  ('Equipe Luz 03', 'Manutenção de iluminação pública'),
  ('Equipe Limpeza 04', 'Limpeza e zeladoria urbana'),
  ('Equipe Verde 01', 'Arborização e áreas verdes')
on conflict (name) do nothing;

-- New Auth users are always citizens. Roles are never read from user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Cidadão'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name)
select id, coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(email, 'Cidadão'), '@', 1))
from auth.users
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger collaborators_updated_at before update on public.collaborators for each row execute procedure public.set_updated_at();
create trigger occurrences_updated_at before update on public.occurrences for each row execute procedure public.set_updated_at();

create or replace function public.is_manager()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager' and account_status = 'active'
  );
$$;

create or replace function public.is_active_account()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active');
$$;

create or replace function public.current_collaborator_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select c.id from public.collaborators c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and c.is_active and p.account_status = 'active';
$$;

create or replace function public.can_read_media(p_object_path text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_manager()
    or exists (
      select 1 from public.occurrence_media m
      join public.occurrences o on o.id = m.occurrence_id
      where m.object_path = p_object_path and o.reporter_id = auth.uid()
    )
    or exists (
      select 1 from public.occurrence_media m
      join public.assignments a on a.occurrence_id = m.occurrence_id
      join public.collaborators c on c.id = a.collaborator_id
      where m.object_path = p_object_path and c.profile_id = auth.uid() and c.is_active
    );
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.collaborators enable row level security;
alter table public.occurrences enable row level security;
alter table public.assignments enable row level security;
alter table public.execution_updates enable row level security;
alter table public.occurrence_media enable row level security;
alter table public.occurrence_history enable row level security;

create policy "profiles readable by subject or manager" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());
create policy "teams readable by authenticated users" on public.teams for select to authenticated using (true);
create policy "collaborators readable by manager or self" on public.collaborators for select to authenticated
  using (public.is_manager() or profile_id = auth.uid());
create policy "occurrences readable by involved users" on public.occurrences for select to authenticated
  using (public.is_manager() or reporter_id = auth.uid() or exists (
    select 1 from public.assignments a join public.collaborators c on c.id = a.collaborator_id
    where a.occurrence_id = id and c.profile_id = auth.uid() and c.is_active
  ));
create policy "assignments readable by involved users" on public.assignments for select to authenticated
  using (public.is_manager() or collaborator_id = public.current_collaborator_id());
create policy "execution updates readable by involved users" on public.execution_updates for select to authenticated
  using (public.is_manager() or collaborator_id = public.current_collaborator_id() or exists (
    select 1 from public.occurrences o where o.id = occurrence_id and o.reporter_id = auth.uid()
  ));
create policy "media metadata readable by involved users" on public.occurrence_media for select to authenticated
  using (public.can_read_media(object_path));
create policy "history readable by involved users" on public.occurrence_history for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.occurrences o where o.id = occurrence_id and o.reporter_id = auth.uid()
  ) or exists (
    select 1 from public.assignments a join public.collaborators c on c.id = a.collaborator_id
    where a.occurrence_id = occurrence_id and c.profile_id = auth.uid() and c.is_active
  ));

-- Private bucket: objects can only be read through a valid ownership/assignment check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('occurrence-media', 'occurrence-media', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated users upload own occurrence media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'occurrence-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (storage.foldername(name))[1] in ('occurrences', 'evidence')
  );
create policy "involved users read occurrence media" on storage.objects for select to authenticated
  using (bucket_id = 'occurrence-media' and public.can_read_media(name));
create policy "users remove their pending uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'occurrence-media' and (storage.foldername(name))[2] = auth.uid()::text);

create or replace function public.triage_priority(p_category text, p_description text)
returns public.occurrence_priority
language sql immutable set search_path = public as $$
  select case
    when lower(p_description) ~ '(acidente|queda|escola|pedestre|fio|risco)' then 'Alta'::public.occurrence_priority
    when p_category = 'Outros' then 'Baixa'::public.occurrence_priority
    else 'Média'::public.occurrence_priority
  end;
$$;

create or replace function public.triage_reason(p_category text, p_description text)
returns text language sql immutable set search_path = public as $$
  select case
    when lower(p_description) ~ '(acidente|queda|escola|pedestre|fio|risco)' then 'Prioridade sugerida por termos de risco no relato.'
    when p_category = 'Outros' then 'Prioridade baixa sugerida pela categoria informada.'
    else 'Prioridade média sugerida pela categoria informada.'
  end;
$$;

create or replace function public.occurrence_payload(p_occurrence_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id, 'protocol', o.protocol, 'title', o.title, 'category', o.category,
    'region', o.region, 'address', o.address, 'neighborhood', o.neighborhood,
    'description', o.description, 'priority', o.priority, 'status', o.status,
    'team', t.name, 'reason', o.triage_reason, 'createdAt', o.created_at,
    'resolvedAt', o.resolved_at, 'dueAt', o.due_at,
    'latitude', o.latitude, 'longitude', o.longitude,
    'photoPath', (select m.object_path from public.occurrence_media m where m.occurrence_id = o.id and m.kind = 'report' order by m.created_at limit 1),
    'hasPhoto', exists(select 1 from public.occurrence_media m where m.occurrence_id = o.id and m.kind = 'report'),
    'assignees', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.full_name, 'team', at.name, 'role', c.job_title) order by c.full_name)
       from public.assignments a join public.collaborators c on c.id = a.collaborator_id join public.teams at on at.id = c.team_id where a.occurrence_id = o.id), '[]'::jsonb),
    'executionUpdates', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', case when e.kind = 'conclusion' then 'conclusao' else 'andamento' end, 'note', e.note, 'progress', e.progress, 'photoPath', m.object_path, 'createdAt', e.created_at, 'collaboratorName', c.full_name) order by e.created_at)
       from public.execution_updates e join public.collaborators c on c.id = e.collaborator_id left join public.occurrence_media m on m.execution_update_id = e.id where e.occurrence_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('title', h.title, 'note', h.note, 'createdAt', h.created_at, 'action', h.action, 'fromStatus', h.from_status, 'toStatus', h.to_status, 'actorName', coalesce(p.full_name, 'Sistema')) order by h.created_at)
       from public.occurrence_history h left join public.profiles p on p.id = h.actor_id where h.occurrence_id = o.id), '[]'::jsonb)
  )
  from public.occurrences o left join public.teams t on t.id = o.team_id
  where o.id = p_occurrence_id;
$$;

create or replace function public.current_profile()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'accountStatus', p.account_status,
    'collaboratorId', c.id, 'team', t.name, 'active', coalesce(c.is_active, true))
  from public.profiles p left join public.collaborators c on c.profile_id = p.id left join public.teams t on t.id = c.team_id
  where p.id = auth.uid();
$$;

create or replace function public.list_occurrences(p_scope text default 'public')
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_collaborator_id uuid;
begin
  if p_scope not in ('public', 'mine', 'assigned', 'all') then raise exception 'Escopo inválido.' using errcode = '22023'; end if;
  if p_scope in ('mine', 'assigned', 'all') and auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if p_scope = 'all' and not public.is_manager() then raise exception 'Acesso restrito à gestão.' using errcode = '42501'; end if;
  v_collaborator_id := public.current_collaborator_id();
  if p_scope = 'assigned' and v_collaborator_id is null then raise exception 'Perfil de colaborador ativo necessário.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(public.occurrence_payload(o.id) order by o.created_at desc)
    from public.occurrences o
    where p_scope in ('public', 'all')
       or (p_scope = 'mine' and o.reporter_id = auth.uid())
       or (p_scope = 'assigned' and exists(select 1 from public.assignments a where a.occurrence_id = o.id and a.collaborator_id = v_collaborator_id))), '[]'::jsonb);
end;
$$;

create or replace function public.get_occurrence(p_occurrence_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_payload jsonb;
begin
  select public.occurrence_payload(p_occurrence_id) into v_payload;
  if v_payload is null then raise exception 'Ocorrência não encontrada.' using errcode = 'P0002'; end if;
  return v_payload;
end;
$$;

create or replace function public.create_occurrence(
  p_title text, p_category text, p_region text, p_address text, p_neighborhood text,
  p_description text, p_latitude numeric default null, p_longitude numeric default null,
  p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid := extensions.gen_random_uuid(); v_priority public.occurrence_priority; v_protocol text;
begin
  if auth.uid() is null or not public.is_active_account() then raise exception 'Entre em uma conta ativa para registrar um relato.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 5 and 100 or char_length(trim(coalesce(p_description,''))) not between 10 and 1200
     or char_length(trim(coalesce(p_address,''))) not between 5 and 160 or char_length(trim(coalesce(p_neighborhood,''))) not between 2 and 80 then raise exception 'Revise os campos obrigatórios do relato.' using errcode = '22023'; end if;
  if p_category not in ('Pavimentação', 'Iluminação', 'Lixo e limpeza', 'Árvores', 'Outros') or p_region not in ('Zona Norte', 'Centro', 'Zona Leste', 'Zona Sul', 'Zona Oeste') then raise exception 'Categoria ou região inválida.' using errcode = '22023'; end if;
  if (p_latitude is null) <> (p_longitude is null) or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then raise exception 'Coordenadas inválidas.' using errcode = '22023'; end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^occurrences/' || auth.uid()::text || '/')) then raise exception 'Foto inválida.' using errcode = '22023'; end if;
  v_priority := public.triage_priority(p_category, p_description);
  v_protocol := format('OCO-%s-%s', to_char(now(), 'YYYY'), lpad(nextval('public.occurrence_protocol_sequence')::text, 6, '0'));
  insert into public.occurrences (id, protocol, reporter_id, title, category, region, address, neighborhood, description, latitude, longitude, priority, triage_reason)
  values (v_id, v_protocol, auth.uid(), trim(p_title), p_category, p_region, trim(p_address), trim(p_neighborhood), trim(p_description), p_latitude, p_longitude, v_priority, public.triage_reason(p_category, p_description));
  if p_media_path is not null then insert into public.occurrence_media (occurrence_id, kind, object_path, mime_type, byte_size, created_by) values (v_id, 'report', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid()); end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, to_status, actor_id) values (v_id, 'created', 'Relato recebido', 'Ocorrência registrada pela população.', 'Nova', auth.uid());
  return public.occurrence_payload(v_id);
end;
$$;

create or replace function public.advance_occurrence_to_analysis(p_occurrence_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Acesso restrito à gestão.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Informe uma justificativa.' using errcode = '22023'; end if;
  update public.occurrences set status = 'Em análise' where id = p_occurrence_id and status = 'Nova';
  if not found then raise exception 'A ocorrência não está disponível para triagem.' using errcode = 'P0001'; end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id) values (p_occurrence_id, 'triaged', 'Triagem iniciada', trim(p_note), 'Nova', 'Em análise', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.assign_occurrence(p_occurrence_id uuid, p_team_name text, p_collaborator_ids uuid[], p_note text, p_due_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_team_id uuid; v_count integer;
begin
  if not public.is_manager() then raise exception 'Acesso restrito à gestão.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 or coalesce(cardinality(p_collaborator_ids),0) < 1 then raise exception 'Informe responsáveis e justificativa.' using errcode = '22023'; end if;
  select id into v_team_id from public.teams where name = p_team_name and is_active;
  if v_team_id is null then raise exception 'Equipe indisponível.' using errcode = '22023'; end if;
  select count(*) into v_count from public.collaborators where id = any(p_collaborator_ids) and team_id = v_team_id and is_active;
  if v_count <> cardinality(p_collaborator_ids) then raise exception 'Selecione colaboradores ativos da equipe escolhida.' using errcode = '22023'; end if;
  update public.occurrences set status = 'Programada', team_id = v_team_id, due_at = p_due_at where id = p_occurrence_id and status = 'Em análise';
  if not found then raise exception 'A ocorrência não está disponível para atribuição.' using errcode = 'P0001'; end if;
  insert into public.assignments (occurrence_id, collaborator_id, assigned_by) select p_occurrence_id, unnest(p_collaborator_ids), auth.uid();
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id) values (p_occurrence_id, 'assigned', 'Serviço programado', trim(p_note), 'Em análise', 'Programada', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.start_occurrence(p_occurrence_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_collaborator_id uuid := public.current_collaborator_id();
begin
  if v_collaborator_id is null then raise exception 'Perfil de colaborador ativo necessário.' using errcode = '42501'; end if;
  update public.occurrences o set status = 'Em execução' where o.id = p_occurrence_id and o.status = 'Programada' and exists (select 1 from public.assignments a where a.occurrence_id = o.id and a.collaborator_id = v_collaborator_id);
  if not found then raise exception 'Você não pode iniciar esta ocorrência.' using errcode = '42501'; end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id) values (p_occurrence_id, 'started', 'Atendimento iniciado', 'O colaborador responsável iniciou o serviço.', 'Programada', 'Em execução', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.record_execution_progress(p_occurrence_id uuid, p_note text, p_progress smallint, p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_collaborator_id uuid := public.current_collaborator_id(); v_update_id bigint;
begin
  if v_collaborator_id is null then raise exception 'Perfil de colaborador ativo necessário.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 or p_progress not between 0 and 100 then raise exception 'Informe andamento e percentual válidos.' using errcode = '22023'; end if;
  if not exists (select 1 from public.occurrences o join public.assignments a on a.occurrence_id = o.id where o.id = p_occurrence_id and o.status = 'Em execução' and a.collaborator_id = v_collaborator_id) then raise exception 'Você não pode atualizar esta ocorrência.' using errcode = '42501'; end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^evidence/' || auth.uid()::text || '/')) then raise exception 'Evidência inválida.' using errcode = '22023'; end if;
  insert into public.execution_updates (occurrence_id, collaborator_id, kind, note, progress) values (p_occurrence_id, v_collaborator_id, 'progress', trim(p_note), p_progress) returning id into v_update_id;
  if p_media_path is not null then insert into public.occurrence_media (occurrence_id, execution_update_id, kind, object_path, mime_type, byte_size, created_by) values (p_occurrence_id, v_update_id, 'evidence', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid()); end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, actor_id) values (p_occurrence_id, 'progress', 'Andamento registrado', trim(p_note), auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.conclude_occurrence(p_occurrence_id uuid, p_note text, p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_collaborator_id uuid := public.current_collaborator_id(); v_update_id bigint;
begin
  if v_collaborator_id is null then raise exception 'Perfil de colaborador ativo necessário.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 10 and 1000 then raise exception 'Descreva a conclusão do serviço.' using errcode = '22023'; end if;
  if not exists (select 1 from public.occurrences o join public.assignments a on a.occurrence_id = o.id where o.id = p_occurrence_id and o.status = 'Em execução' and a.collaborator_id = v_collaborator_id) then raise exception 'Você não pode concluir esta ocorrência.' using errcode = '42501'; end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^evidence/' || auth.uid()::text || '/')) then raise exception 'Evidência inválida.' using errcode = '22023'; end if;
  update public.occurrences set status = 'Aguardando validação' where id = p_occurrence_id;
  insert into public.execution_updates (occurrence_id, collaborator_id, kind, note, progress) values (p_occurrence_id, v_collaborator_id, 'conclusion', trim(p_note), 100) returning id into v_update_id;
  if p_media_path is not null then insert into public.occurrence_media (occurrence_id, execution_update_id, kind, object_path, mime_type, byte_size, created_by) values (p_occurrence_id, v_update_id, 'evidence', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid()); end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id) values (p_occurrence_id, 'concluded', 'Conclusão enviada para validação', trim(p_note), 'Em execução', 'Aguardando validação', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.validate_occurrence(p_occurrence_id uuid, p_decision text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_next public.occurrence_status; v_action text; v_title text;
begin
  if not public.is_manager() then raise exception 'Acesso restrito à gestão.' using errcode = '42501'; end if;
  if p_decision not in ('approve','correct') or char_length(trim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Informe uma decisão e justificativa válidas.' using errcode = '22023'; end if;
  v_next := case when p_decision = 'approve' then 'Resolvida'::public.occurrence_status else 'Em execução'::public.occurrence_status end;
  v_action := case when p_decision = 'approve' then 'approved' else 'returned' end;
  v_title := case when p_decision = 'approve' then 'Serviço aprovado' else 'Serviço devolvido para correção' end;
  update public.occurrences set status = v_next, resolved_at = case when v_next = 'Resolvida' then now() else null end where id = p_occurrence_id and status = 'Aguardando validação';
  if not found then raise exception 'A ocorrência não aguarda validação.' using errcode = 'P0001'; end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id) values (p_occurrence_id, v_action, v_title, trim(p_note), 'Aguardando validação', v_next, auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end; $$;

create or replace function public.list_collaborators()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Acesso restrito à gestão.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.full_name, 'email', c.email, 'phone', c.phone, 'employeeCode', c.employee_code,
    'team', t.name, 'role', c.job_title, 'active', c.is_active, 'createdAt', c.created_at,
    'assignedCount', (select count(*) from public.assignments a join public.occurrences o on o.id=a.occurrence_id where a.collaborator_id=c.id and o.status <> 'Resolvida'),
    'completedCount', (select count(*) from public.assignments a join public.occurrences o on o.id=a.occurrence_id where a.collaborator_id=c.id and o.status = 'Resolvida'),
    'overdueCount', (select count(*) from public.assignments a join public.occurrences o on o.id=a.occurrence_id where a.collaborator_id=c.id and o.due_at < now() and o.status <> 'Resolvida')
  ) order by c.full_name) from public.collaborators c join public.teams t on t.id=c.team_id), '[]'::jsonb);
end; $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function public.current_profile(), public.list_occurrences(text), public.get_occurrence(uuid) to anon, authenticated;
grant execute on function public.create_occurrence(text,text,text,text,text,text,numeric,numeric,text,text,integer), public.advance_occurrence_to_analysis(uuid,text), public.assign_occurrence(uuid,text,uuid[],text,timestamptz), public.start_occurrence(uuid), public.record_execution_progress(uuid,text,smallint,text,text,integer), public.conclude_occurrence(uuid,text,text,text,integer), public.validate_occurrence(uuid,text,text), public.list_collaborators() to authenticated;

alter default privileges in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges in schema public revoke usage, select on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
