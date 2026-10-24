create schema if not exists private;

create table public.geocode_cache (
  query_key text primary key,
  latitude numeric(9,6),
  longitude numeric(9,6),
  label text,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create table private.geocode_rate_limit (
  singleton boolean primary key default true check (singleton),
  last_request_at timestamptz not null default 'epoch'
);
insert into private.geocode_rate_limit(singleton) values (true) on conflict do nothing;

alter table public.geocode_cache enable row level security;

create or replace function public.claim_geocode(p_query_key text)
returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare v_cache public.geocode_cache; v_last timestamptz;
begin
  if auth.uid() is null or not public.is_active_account() then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select * into v_cache from public.geocode_cache where query_key = p_query_key and expires_at > now();
  if found then return jsonb_build_object('cached', true, 'latitude', v_cache.latitude, 'longitude', v_cache.longitude, 'label', v_cache.label); end if;
  perform pg_advisory_xact_lock(hashtext('observamarilia-geocode-global'));
  select last_request_at into v_last from private.geocode_rate_limit where singleton = true for update;
  if v_last > now() - interval '1 second' then raise exception 'Aguarde um instante antes de fazer outra busca de endereço.' using errcode = 'P0001'; end if;
  update private.geocode_rate_limit set last_request_at = now() where singleton = true;
  return jsonb_build_object('cached', false);
end; $$;

revoke execute on function public.current_profile() from anon;
grant execute on function public.claim_geocode(text) to authenticated;
