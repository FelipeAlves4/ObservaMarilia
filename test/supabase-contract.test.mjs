import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('migrações protegem o domínio, o Storage e os papéis', async () => {
  const core = await read('supabase/migrations/20261024143042_observamarilia_core.sql');
  const privileges = await read('supabase/migrations/20261024143822_function_privileges.sql');
  assert.match(core, /alter table public\.occurrences enable row level security/i);
  assert.match(core, /occurrence-media/);
  assert.match(core, /create or replace function public\.validate_occurrence/i);
  assert.match(privileges, /revoke all on all functions in schema public from public/i);
  assert.match(privileges, /claim_geocode\(text\) to authenticated/i);
});

test('cliente de produção usa Supabase e não chama a API SQLite', async () => {
  const api = await read('src/api.ts');
  const geocoder = await read('src/map/geocode.ts');
  assert.match(api, /supabase\.rpc/);
  assert.match(api, /occurrence-media/);
  assert.doesNotMatch(api, /\/api\//);
  assert.match(geocoder, /functions\.invoke\('geocode-marilia'/);
  assert.doesNotMatch(geocoder, /nominatim\.openstreetmap\.org/);
});

test('domínio administrativo exige RBAC e mantém credenciais privilegiadas fora do cliente', async () => {
  const roleMigration = await read('supabase/migrations/20261112105900_add_admin_role.sql');
  const migration = await read('supabase/migrations/20261112110000_administrative_management.sql');
  const edgeFunction = await read('supabase/functions/manage-admin/index.ts');
  const api = await read('src/api.ts');
  assert.match(roleMigration, /add value if not exists 'admin'/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /create or replace function public\.is_admin/i);
  assert.match(edgeFunction, /profile\?\.role !== "admin"/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(api, /functions\.invoke\('manage-admin'/);
  assert.doesNotMatch(api, /SERVICE_ROLE/);
});
