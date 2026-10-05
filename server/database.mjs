import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { categories, regions, teams, triage, validateReport, transitions, requiredText, ValidationError } from './domain.mjs';

export function createDatabase(path = 'data/observamarilia.sqlite', seed = true) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS occurrences (
      id TEXT PRIMARY KEY, protocol TEXT NOT NULL UNIQUE, owner TEXT NOT NULL,
      title TEXT NOT NULL, category TEXT NOT NULL, region TEXT NOT NULL,
      address TEXT NOT NULL, neighborhood TEXT NOT NULL, description TEXT NOT NULL,
      photo TEXT, priority TEXT NOT NULL, status TEXT NOT NULL,
      team TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      title TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_occurrences_region_category ON occurrences(region, category);
    CREATE INDEX IF NOT EXISTS idx_history_occurrence ON history(occurrence_id, id);
  `);
  const insert = db.prepare(`INSERT INTO occurrences
    (id, protocol, owner, title, category, region, address, neighborhood, description, photo, priority, status, team, reason, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  function event(id, title, note, time = new Date().toISOString()) {
    db.prepare('INSERT INTO history (occurrence_id, title, note, created_at) VALUES (?, ?, ?, ?)').run(id, title, note, time);
  }
  function transaction(callback) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function get(id) {
    const row = db.prepare('SELECT * FROM occurrences WHERE id = ?').get(id);
    if (!row) return null;
    const history = db.prepare('SELECT title, note, created_at AS createdAt FROM history WHERE occurrence_id = ? ORDER BY id').all(id);
    return {
      id: row.id, protocol: row.protocol, title: row.title, category: row.category,
      region: row.region, address: row.address, neighborhood: row.neighborhood,
      description: row.description, photo: row.photo, priority: row.priority,
      status: row.status, team: row.team, reason: row.reason,
      createdAt: row.created_at, resolvedAt: row.resolved_at, history,
    };
  }
  function list(owner) {
    const rows = owner
      ? db.prepare('SELECT id FROM occurrences WHERE owner = ? ORDER BY created_at DESC').all(owner)
      : db.prepare('SELECT id FROM occurrences ORDER BY created_at DESC').all();
    return rows.map(row => { const { photo, ...item } = get(row.id); return { ...item, hasPhoto: Boolean(photo) }; });
  }
  function create(input, owner = 'cidadao-demo') {
    const data = validateReport(input);
    const analysis = triage(data.category, data.description);
    return transaction(() => {
      const now = new Date().toISOString();
      const year = new Date().getUTCFullYear();
      const count = Number(db.prepare('SELECT count(*) AS n FROM occurrences').get().n) + 1;
      const protocol = `OCO-${year}-${String(count).padStart(4, '0')}`;
      const id = randomUUID();
      insert.run(id, protocol, owner, data.title, data.category, data.region, data.address,
        data.neighborhood, data.description, data.photo, analysis.priority, 'Em análise', null, analysis.reason, now, null);
      event(id, 'Ocorrência criada', 'Relato registrado pelo cidadão.', now);
      event(id, 'Triagem demonstrativa', analysis.reason, now);
      return get(id);
    });
  }
  function update(id, input) {
    const current = get(id);
    if (!current) return null;
    if (!transitions[current.status].includes(input.status)) throw new ValidationError('Etapa inválida. Siga o fluxo de atendimento.');
    if (!teams.includes(input.team)) throw new ValidationError('Selecione uma equipe responsável.');
    const note = requiredText(input.note, 'Justificativa', 5, 600);
    return transaction(() => {
      const now = new Date().toISOString();
      db.prepare('UPDATE occurrences SET status = ?, team = ?, resolved_at = ? WHERE id = ?')
        .run(input.status, input.team, input.status === 'Resolvida' ? now : null, id);
      event(id, input.status, `${input.team} · ${note}`, now);
      return get(id);
    });
  }
  function seedData() {
    if (Number(db.prepare('SELECT count(*) AS n FROM occurrences').get().n)) return;
    const names = ['Buraco na Av. das Esmeraldas', 'Lâmpada apagada · Rua 12', 'Descarte irregular · Praça Central', 'Árvore caída · Rua dos Ipês', 'Sinalização danificada · Av. Rio Branco'];
    transaction(() => {
      for (let i = 0; i < 24; i++) {
        const cat = i < 5 ? categories[i] : i < 12 ? categories[0] : i < 18 ? categories[1] : i < 23 ? categories[2] : categories[3];
        const region = i < 5 ? regions[i] : i < 12 ? regions[0] : i < 18 ? regions[2] : i < 23 ? regions[1] : regions[3];
        const status = ['Em análise', 'Programada', 'Em execução', 'Resolvida', 'Nova'][i % 5];
        const created = new Date(Date.now() - (i + 1) * 6 * 3600000).toISOString();
        const resolved = status === 'Resolvida' ? new Date(new Date(created).getTime() + 6 * 3600000).toISOString() : null;
        const description = cat === 'Pavimentação'
          ? 'Buraco grande próximo à faixa de pedestres, causando risco para carros e motos.'
          : cat === 'Árvores' ? 'Árvore com risco de queda próxima à passagem de pedestres. Solicito uma vistoria.'
          : `Problema de ${cat.toLowerCase()} observado no local. Solicito a vistoria da equipe municipal.`;
        const analysis = triage(cat, description);
        const id = `demo-${String(i + 1).padStart(3, '0')}`;
        const title = i < 5 ? names[i] : `${cat} · ${['Av. República', 'Rua Goiás', 'Rua Amazonas', 'Rua São Paulo'][i % 4]}`;
        insert.run(id, `OCO-${new Date().getUTCFullYear()}-${String(i + 1).padStart(4, '0')}`, i < 3 ? 'cidadao-demo' : 'outro-demo',
          title, cat, region,
          i === 0 ? 'Av. das Esmeraldas, 245' : `Rua ${i + 1}, ${120 + i * 15}`, 'Bairro demonstrativo',
          description, null, analysis.priority, status, ['Programada','Em execução','Resolvida'].includes(status) ? teams[i % teams.length] : null,
          analysis.reason, created, resolved);
        event(id, 'Ocorrência criada', 'Dado fictício para apresentação acadêmica.', created);
        if (status !== 'Nova') event(id, 'Triagem demonstrativa', analysis.reason, created);
        if (['Programada','Em execução','Resolvida'].includes(status)) event(id, 'Programada', `Encaminhada para ${teams[i % teams.length]}.`, created);
        if (['Em execução','Resolvida'].includes(status)) event(id, 'Em execução', 'Equipe iniciou o atendimento.', created);
        if (resolved) event(id, 'Resolvida', 'Atendimento concluído (demonstração).', resolved);
      }
    });
  }
  if (seed) seedData();
  return { db, get, list, create, update, close: () => db.close() };
}
