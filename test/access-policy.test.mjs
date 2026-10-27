import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/accessPolicy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('direciona cada papel somente para a área permitida', () => {
  const citizen = { role: 'citizen', accountStatus: 'active' };
  const manager = { role: 'manager', accountStatus: 'active' };
  const collaborator = { role: 'collaborator', accountStatus: 'active', active: true };
  assert.equal(policy.hasAreaAccess(citizen, 'citizen'), true);
  assert.equal(policy.hasAreaAccess(citizen, 'manager'), false);
  assert.equal(policy.hasAreaAccess(manager, 'manager'), true);
  assert.equal(policy.hasAreaAccess(manager, 'collaborator'), false);
  assert.equal(policy.hasAreaAccess(collaborator, 'collaborator'), true);
  assert.equal(policy.safeDestination(citizen, '/gestor'), '/meus-relatos');
  assert.equal(policy.safeDestination(manager, '/gestor/mapa?regiao=norte'), '/gestor/mapa?regiao=norte');
  assert.equal(policy.safeDestination(collaborator, '/meus-relatos'), '/colaborador');
});

test('bloqueia contas suspensas e colaboradores inativos', () => {
  const suspended = { role: 'manager', accountStatus: 'suspended' };
  const inactiveWorker = { role: 'collaborator', accountStatus: 'active', active: false };
  assert.match(policy.profileAccessIssue(suspended), /suspensa/i);
  assert.equal(policy.hasAreaAccess(suspended, 'manager'), false);
  assert.match(policy.profileAccessIssue(inactiveWorker), /inativo/i);
  assert.equal(policy.hasAreaAccess(inactiveWorker, 'collaborator'), false);
});
