-- Administrative domain: administrators own municipal departments and manager accounts.
-- All mutations are performed by the trusted manage-admin Edge Function; browser
-- clients only receive the narrow read RPCs below.
create table public.departments (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 3 and 140),
  acronym text not null unique check (acronym = upper(acronym) and char_length(trim(acronym)) between 2 and 16),
  description text not null default '' check (char_length(description) <= 700),
  institutional_email text not null check (institutional_email = lower(institutional_email) and position('@' in institutional_email) > 1),
  phone text not null check (char_length(trim(phone)) between 8 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manager_profiles (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  job_title text not null check (char_length(trim(job_title)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('department_created', 'department_updated', 'department_status_changed', 'manager_invited', 'manager_status_changed')),
  entity_type text not null check (entity_type in ('department', 'manager')),
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index manager_profiles_department_idx on public.manager_profiles(department_id);
create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

create trigger departments_updated_at before update on public.departments for each row execute procedure public.set_updated_at();
create trigger manager_profiles_updated_at before update on public.manager_profiles for each row execute procedure public.set_updated_at();

insert into public.departments (name, acronym, description, institutional_email, phone) values
  ('Secretaria Municipal de Obras Públicas', 'OBRAS', 'Planejamento, conservação e execução de obras urbanas.', 'obras@marilia.sp.gov.br', '(14) 3402-6000'),
  ('Secretaria Municipal de Meio Ambiente', 'SEMA', 'Proteção ambiental, arborização e sustentabilidade urbana.', 'meioambiente@marilia.sp.gov.br', '(14) 3402-6100'),
  ('Secretaria Municipal de Serviços Urbanos', 'SSU', 'Zeladoria, limpeza e manutenção dos espaços públicos.', 'servicosurbanos@marilia.sp.gov.br', '(14) 3402-6200'),
  ('Secretaria Municipal de Mobilidade Urbana', 'MOBI', 'Mobilidade, sinalização e segurança viária.', 'mobilidade@marilia.sp.gov.br', '(14) 3402-6300')
on conflict (name) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

-- Legacy manager accounts (created before the administrative domain) retain
-- their existing access. Every manager created by the new invitation flow must
-- have an active manager profile attached to an active department.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager' and p.account_status = 'active'
      and (
        not exists (select 1 from public.manager_profiles mp where mp.profile_id = p.id)
        or exists (
          select 1 from public.manager_profiles mp
          join public.departments d on d.id = mp.department_id
          where mp.profile_id = p.id and mp.is_active and d.is_active
        )
      )
  );
$$;

create or replace function public.current_profile()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.full_name, 'role', p.role, 'accountStatus', p.account_status,
    'collaboratorId', c.id, 'team', t.name, 'active',
    case when p.role = 'collaborator' then coalesce(c.is_active, true)
         when p.role = 'manager' then coalesce(mp.is_active and d.is_active, false)
         else true end,
    'departmentId', mp.department_id, 'department', d.name
  )
  from public.profiles p
  left join public.collaborators c on c.profile_id = p.id
  left join public.teams t on t.id = c.team_id
  left join public.manager_profiles mp on mp.profile_id = p.id
  left join public.departments d on d.id = mp.department_id
  where p.id = auth.uid();
$$;

create or replace function public.list_departments()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_manager()) then
    raise exception 'Acesso restrito à administração.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'acronym', d.acronym, 'description', d.description,
    'email', d.institutional_email, 'phone', d.phone, 'active', d.is_active,
    'createdAt', d.created_at, 'managerCount', (select count(*) from public.manager_profiles mp where mp.department_id = d.id and mp.is_active)
  ) order by d.is_active desc, d.name) from public.departments d), '[]'::jsonb);
end;
$$;

create or replace function public.list_admin_managers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito à administração.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', mp.profile_id, 'name', p.full_name, 'departmentId', d.id, 'department', d.name,
    'email', au.email, 'jobTitle', mp.job_title, 'active', mp.is_active and p.account_status = 'active',
    'createdAt', mp.created_at
  ) order by p.full_name) from public.manager_profiles mp
    join public.profiles p on p.id = mp.profile_id
    join auth.users au on au.id = mp.profile_id
    join public.departments d on d.id = mp.department_id), '[]'::jsonb);
end;
$$;

alter table public.departments enable row level security;
alter table public.manager_profiles enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on table public.departments, public.manager_profiles, public.admin_audit_log from anon, authenticated;
grant select on table public.departments, public.manager_profiles, public.admin_audit_log to authenticated;

create policy "departments readable by operations" on public.departments for select to authenticated
  using (public.is_admin() or public.is_manager());
create policy "manager profile readable by subject or admin" on public.manager_profiles for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "audit readable by admin" on public.admin_audit_log for select to authenticated
  using (public.is_admin());

revoke all on function public.is_admin(), public.list_departments(), public.list_admin_managers() from public;
grant execute on function public.current_profile(), public.list_departments(), public.list_admin_managers() to authenticated;
