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
