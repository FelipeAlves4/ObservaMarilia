-- Administrators may use the existing manager workflow with their own identity.
-- The manager workflow is city-wide; it does not require a department binding.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
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

-- A collaborator is an assigned person, not a presentation role. Administrative
-- field actions therefore record the administrator as actor without using a
-- collaborator's ID or changing the administrator's profile.
alter table public.execution_updates alter column collaborator_id drop not null;
alter table public.execution_updates add column actor_id uuid references public.profiles(id) on delete restrict;
alter table public.execution_updates add constraint execution_update_author_check
  check ((collaborator_id is not null) <> (actor_id is not null));

create or replace function public.occurrence_payload(p_occurrence_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
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
    'executionUpdates', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'kind', case when e.kind = 'conclusion' then 'conclusao' else 'andamento' end,
      'note', e.note, 'progress', e.progress, 'photoPath', m.object_path,
      'createdAt', e.created_at, 'collaboratorName',
      case when e.collaborator_id is null then actor.full_name || ' (administração)' else c.full_name end
    ) order by e.created_at)
       from public.execution_updates e
       left join public.collaborators c on c.id = e.collaborator_id
       left join public.profiles actor on actor.id = e.actor_id
       left join public.occurrence_media m on m.execution_update_id = e.id
       where e.occurrence_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('title', h.title, 'note', h.note, 'createdAt', h.created_at, 'action', h.action, 'fromStatus', h.from_status, 'toStatus', h.to_status, 'actorName', coalesce(p.full_name, 'Sistema')) order by h.created_at)
       from public.occurrence_history h left join public.profiles p on p.id = h.actor_id where h.occurrence_id = o.id), '[]'::jsonb)
  )
  from public.occurrences o left join public.teams t on t.id = o.team_id
  where o.id = p_occurrence_id;
$$;

create function public.admin_list_assigned_occurrences()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito à administração.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(public.occurrence_payload(o.id) order by o.created_at desc)
    from public.occurrences o
    where exists (select 1 from public.assignments a where a.occurrence_id = o.id)), '[]'::jsonb);
end;
$$;

create function public.admin_start_occurrence(p_occurrence_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito à administração.' using errcode = '42501'; end if;
  update public.occurrences o set status = 'Em execução'
  where o.id = p_occurrence_id and o.status = 'Programada'
    and exists (select 1 from public.assignments a where a.occurrence_id = o.id);
  if not found then raise exception 'A ocorrência não está disponível para início.' using errcode = 'P0001'; end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id)
  values (p_occurrence_id, 'started', 'Atendimento iniciado pela administração', 'A administração iniciou o serviço.', 'Programada', 'Em execução', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end;
$$;

create function public.admin_record_execution_progress(
  p_occurrence_id uuid, p_note text, p_progress smallint,
  p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_update_id bigint;
begin
  if not public.is_admin() then raise exception 'Acesso restrito à administração.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 or p_progress is null or p_progress not between 0 and 100 then raise exception 'Informe andamento e percentual válidos.' using errcode = '22023'; end if;
  perform 1 from public.occurrences o where o.id = p_occurrence_id and o.status = 'Em execução'
    and exists (select 1 from public.assignments a where a.occurrence_id = o.id) for update;
  if not found then
    raise exception 'A ocorrência não está disponível para atualização.' using errcode = 'P0001';
  end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^evidence/' || auth.uid()::text || '/')) then raise exception 'Evidência inválida.' using errcode = '22023'; end if;
  insert into public.execution_updates (occurrence_id, actor_id, kind, note, progress)
  values (p_occurrence_id, auth.uid(), 'progress', trim(p_note), p_progress) returning id into v_update_id;
  if p_media_path is not null then
    insert into public.occurrence_media (occurrence_id, execution_update_id, kind, object_path, mime_type, byte_size, created_by)
    values (p_occurrence_id, v_update_id, 'evidence', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid());
  end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, actor_id)
  values (p_occurrence_id, 'progress', 'Andamento registrado pela administração', trim(p_note), auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end;
$$;

create function public.admin_conclude_occurrence(
  p_occurrence_id uuid, p_note text,
  p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_update_id bigint;
begin
  if not public.is_admin() then raise exception 'Acesso restrito à administração.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 10 and 1000 then raise exception 'Descreva a conclusão do serviço.' using errcode = '22023'; end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^evidence/' || auth.uid()::text || '/')) then raise exception 'Evidência inválida.' using errcode = '22023'; end if;
  update public.occurrences o set status = 'Aguardando validação'
  where o.id = p_occurrence_id and o.status = 'Em execução'
    and exists (select 1 from public.assignments a where a.occurrence_id = o.id);
  if not found then raise exception 'A ocorrência não está disponível para conclusão.' using errcode = 'P0001'; end if;
  insert into public.execution_updates (occurrence_id, actor_id, kind, note, progress)
  values (p_occurrence_id, auth.uid(), 'conclusion', trim(p_note), 100) returning id into v_update_id;
  if p_media_path is not null then
    insert into public.occurrence_media (occurrence_id, execution_update_id, kind, object_path, mime_type, byte_size, created_by)
    values (p_occurrence_id, v_update_id, 'evidence', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid());
  end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, from_status, to_status, actor_id)
  values (p_occurrence_id, 'concluded', 'Conclusão enviada pela administração', trim(p_note), 'Em execução', 'Aguardando validação', auth.uid());
  return public.occurrence_payload(p_occurrence_id);
end;
$$;

revoke all on function public.admin_list_assigned_occurrences(), public.admin_start_occurrence(uuid),
  public.admin_record_execution_progress(uuid,text,smallint,text,text,integer),
  public.admin_conclude_occurrence(uuid,text,text,text,integer) from public, anon;
grant execute on function public.admin_list_assigned_occurrences(), public.admin_start_occurrence(uuid),
  public.admin_record_execution_progress(uuid,text,smallint,text,text,integer),
  public.admin_conclude_occurrence(uuid,text,text,text,integer) to authenticated;
