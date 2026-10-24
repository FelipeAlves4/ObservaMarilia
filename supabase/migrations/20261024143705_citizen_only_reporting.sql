create or replace function public.create_occurrence(
  p_title text, p_category text, p_region text, p_address text, p_neighborhood text,
  p_description text, p_latitude numeric default null, p_longitude numeric default null,
  p_media_path text default null, p_media_mime_type text default null, p_media_byte_size integer default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid := extensions.gen_random_uuid();
  v_priority public.occurrence_priority;
  v_protocol text;
begin
  if auth.uid() is null or not public.is_active_account() then
    raise exception 'Entre em uma conta ativa para registrar um relato.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'citizen') then
    raise exception 'Somente contas cidadãs podem registrar relatos.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title,''))) not between 5 and 100 or char_length(trim(coalesce(p_description,''))) not between 10 and 1200
     or char_length(trim(coalesce(p_address,''))) not between 5 and 160 or char_length(trim(coalesce(p_neighborhood,''))) not between 2 and 80 then
    raise exception 'Revise os campos obrigatórios do relato.' using errcode = '22023';
  end if;
  if p_category not in ('Pavimentação', 'Iluminação', 'Lixo e limpeza', 'Árvores', 'Outros') or p_region not in ('Zona Norte', 'Centro', 'Zona Leste', 'Zona Sul', 'Zona Oeste') then
    raise exception 'Categoria ou região inválida.' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null) or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Coordenadas inválidas.' using errcode = '22023';
  end if;
  if p_media_path is not null and (p_media_mime_type not in ('image/jpeg','image/png') or p_media_byte_size not between 1 and 2097152 or p_media_path !~ ('^occurrences/' || auth.uid()::text || '/')) then
    raise exception 'Foto inválida.' using errcode = '22023';
  end if;
  v_priority := public.triage_priority(p_category, p_description);
  v_protocol := format('OCO-%s-%s', to_char(now(), 'YYYY'), lpad(nextval('public.occurrence_protocol_sequence')::text, 6, '0'));
  insert into public.occurrences (id, protocol, reporter_id, title, category, region, address, neighborhood, description, latitude, longitude, priority, triage_reason)
  values (v_id, v_protocol, auth.uid(), trim(p_title), p_category, p_region, trim(p_address), trim(p_neighborhood), trim(p_description), p_latitude, p_longitude, v_priority, public.triage_reason(p_category, p_description));
  if p_media_path is not null then
    insert into public.occurrence_media (occurrence_id, kind, object_path, mime_type, byte_size, created_by)
    values (v_id, 'report', p_media_path, p_media_mime_type, p_media_byte_size, auth.uid());
  end if;
  insert into public.occurrence_history (occurrence_id, action, title, note, to_status, actor_id)
  values (v_id, 'created', 'Relato recebido', 'Ocorrência registrada pela população.', 'Nova', auth.uid());
  return public.occurrence_payload(v_id);
end;
$$;
