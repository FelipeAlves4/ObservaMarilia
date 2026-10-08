import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { categories, regions, teams, triage, validateReport, transitions, requiredText, ValidationError, AuthorizationError } from './domain.mjs';

const manager = { id: 'gestor-demo', name: 'Gestor demonstrativo', role: 'gestor' };
const demoCollaborators = [
  ['colab-joao', 'João Silva', 'joao.silva@demo.local', '(14) 99999-0101', 'MAT-001', 'Equipe Norte 02', 'Agente de pavimentação'],
  ['colab-maria', 'Maria Oliveira', 'maria.oliveira@demo.local', '(14) 99999-0102', 'MAT-002', 'Equipe Luz 03', 'Técnica de iluminação'],
  ['colab-carlos', 'Carlos Santos', 'carlos.santos@demo.local', '(14) 99999-0103', 'MAT-003', 'Equipe Limpeza 04', 'Agente de limpeza urbana'],
];

export function createDatabase(path = 'data/observamarilia.sqlite', seed = true) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`CREATE TABLE IF NOT EXISTS occurrences (
    id TEXT PRIMARY KEY, protocol TEXT NOT NULL UNIQUE, owner TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, region TEXT NOT NULL,
    address TEXT NOT NULL, neighborhood TEXT NOT NULL, description TEXT NOT NULL, photo TEXT, priority TEXT NOT NULL, status TEXT NOT NULL,
    team TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT
  ); CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, occurrence_id TEXT NOT NULL REFERENCES occurrences(id), title TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS collaborators (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, employee_code TEXT NOT NULL UNIQUE,
    team TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS assignments (
    occurrence_id TEXT NOT NULL REFERENCES occurrences(id), collaborator_id TEXT NOT NULL REFERENCES collaborators(id), assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL,
    PRIMARY KEY (occurrence_id, collaborator_id)
  ); CREATE TABLE IF NOT EXISTS execution_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, occurrence_id TEXT NOT NULL REFERENCES occurrences(id), collaborator_id TEXT NOT NULL REFERENCES collaborators(id),
    kind TEXT NOT NULL, note TEXT NOT NULL, progress INTEGER, photo TEXT, created_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS idx_occurrences_region_category ON occurrences(region,category); CREATE INDEX IF NOT EXISTS idx_history_occurrence ON history(occurrence_id,id);
  CREATE INDEX IF NOT EXISTS idx_assignments_collaborator ON assignments(collaborator_id,occurrence_id); CREATE INDEX IF NOT EXISTS idx_execution_occurrence ON execution_updates(occurrence_id,id);`);
  migrate();

  function columns(table) { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name)); }
  function addColumn(table, definition) { if (!columns(table).has(definition.split(/\s+/)[0])) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`); }
  function migrate() {
    addColumn('occurrences', 'due_at TEXT');
    for (const column of ['action TEXT', 'from_status TEXT', 'to_status TEXT', 'actor_id TEXT', 'actor_name TEXT', 'actor_role TEXT', 'attachment_ref TEXT']) addColumn('history', column);
  }
  function transaction(callback) { db.exec('BEGIN IMMEDIATE'); try { const value = callback(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } }
  function event(id, title, note, actor = manager, meta = {}) {
    const { action = title, fromStatus = null, toStatus = null, attachmentRef = null, time = new Date().toISOString() } = meta;
    db.prepare(`INSERT INTO history (occurrence_id,title,note,created_at,action,from_status,to_status,actor_id,actor_name,actor_role,attachment_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, title, note, time, action, fromStatus, toStatus, actor.id, actor.name, actor.role, attachmentRef);
  }
  function assignees(id) { return db.prepare('SELECT c.id,c.name,c.team,c.role FROM assignments a JOIN collaborators c ON c.id=a.collaborator_id WHERE a.occurrence_id=? ORDER BY c.name').all(id); }
  function executionUpdates(id, withPhoto = true) { return db.prepare(`SELECT e.id,e.kind,e.note,e.progress,${withPhoto ? 'e.photo' : 'NULL AS photo'},e.created_at AS createdAt,c.name AS collaboratorName FROM execution_updates e JOIN collaborators c ON c.id=e.collaborator_id WHERE e.occurrence_id=? ORDER BY e.id`).all(id); }
  function get(id, withPhoto = true) {
    const row = db.prepare('SELECT * FROM occurrences WHERE id=?').get(id); if (!row) return null;
    const history = db.prepare('SELECT title,note,created_at AS createdAt,action,from_status AS fromStatus,to_status AS toStatus,actor_name AS actorName,actor_role AS actorRole,attachment_ref AS attachmentRef FROM history WHERE occurrence_id=? ORDER BY id').all(id);
    return { id:row.id, protocol:row.protocol, title:row.title, category:row.category, region:row.region, address:row.address, neighborhood:row.neighborhood, description:row.description, photo:withPhoto ? row.photo : undefined, hasPhoto:Boolean(row.photo), priority:row.priority, status:row.status, team:row.team, reason:row.reason, createdAt:row.created_at, resolvedAt:row.resolved_at, dueAt:row.due_at, assignedAt:db.prepare('SELECT min(assigned_at) AS at FROM assignments WHERE occurrence_id=?').get(id).at, assignees:assignees(id), executionUpdates:executionUpdates(id,withPhoto), history };
  }
  function list(owner) { const rows = owner ? db.prepare('SELECT id FROM occurrences WHERE owner=? ORDER BY created_at DESC').all(owner) : db.prepare('SELECT id FROM occurrences ORDER BY created_at DESC').all(); return rows.map(row => get(row.id, false)); }
  function actor(actorId) {
    if (actorId === manager.id) return manager;
    const collaborator = db.prepare('SELECT id,name,team,role,active FROM collaborators WHERE id=?').get(actorId);
    if (!collaborator || !collaborator.active) throw new AuthorizationError('Usuário não autorizado ou inativo.');
    return { ...collaborator, role:'colaborador' };
  }
  function requireManager(user) { if (!user || user.role !== 'gestor') throw new AuthorizationError('Apenas gestores podem realizar esta ação.'); }
  function requireAssignment(id, user) { if (!user || user.role !== 'colaborador') throw new AuthorizationError('Apenas colaboradores podem executar serviços.'); if (!db.prepare('SELECT 1 FROM assignments WHERE occurrence_id=? AND collaborator_id=?').get(id,user.id)) throw new AuthorizationError('Esta tarefa não foi atribuída ao colaborador atual.'); }
  function validateEvidence(photo) {
    if (!photo) return null;
    if (typeof photo !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) throw new ValidationError('A evidência deve ser JPG ou PNG.');
    const data = Buffer.from(photo.split(',')[1], 'base64'); const png = data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])); const jpeg = data[0] === 255 && data[1] === 216;
    if (data.length > 2 * 1024 * 1024 || !(photo.startsWith('data:image/png') ? png : jpeg)) throw new ValidationError('A evidência é inválida ou excede 2 MB.');
    return photo;
  }
  function create(input, owner = 'cidadao-demo') {
    const data = validateReport(input), analysis = triage(data.category,data.description);
    return transaction(() => { const now=new Date().toISOString(), id=randomUUID(), count=Number(db.prepare('SELECT count(*) AS n FROM occurrences').get().n)+1, protocol=`OCO-${new Date().getUTCFullYear()}-${String(count).padStart(4,'0')}`;
      db.prepare('INSERT INTO occurrences (id,protocol,owner,title,category,region,address,neighborhood,description,photo,priority,status,team,reason,created_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,protocol,owner,data.title,data.category,data.region,data.address,data.neighborhood,data.description,data.photo,analysis.priority,'Em análise',null,analysis.reason,now,null);
      event(id,'Ocorrência criada','Relato registrado pelo cidadão.',{id:owner,name:'Cidadão demonstrativo',role:'cidadao'},{action:'create',toStatus:'Em análise',time:now}); event(id,'Triagem demonstrativa',analysis.reason,manager,{action:'triage',toStatus:'Em análise',time:now}); return get(id);
    });
  }
  function update(id,input,user=manager) {
    requireManager(user); const current=get(id); if (!current) return null;
    if (!transitions[current.status]?.includes(input.status)) throw new ValidationError('Etapa inválida. Siga o fluxo de atendimento.'); if (!teams.includes(input.team)) throw new ValidationError('Selecione uma equipe responsável.'); const note=requiredText(input.note,'Justificativa',5,600);
    if (input.status === 'Resolvida' && current.status !== 'Aguardando validação') throw new ValidationError('A resolução exige conclusão e validação do gestor.');
    return transaction(() => { const now=new Date().toISOString(); db.prepare('UPDATE occurrences SET status=?,team=?,resolved_at=? WHERE id=?').run(input.status,input.team,input.status==='Resolvida'?now:null,id); event(id,input.status,`${input.team} · ${note}`,user,{action:'status_change',fromStatus:current.status,toStatus:input.status,time:now}); return get(id); });
  }
  function listCollaborators(user) { if (user) requireManager(user); return db.prepare(`SELECT c.id,c.name,c.email,c.phone,c.employee_code AS employeeCode,c.team,c.role,c.active,c.created_at AS createdAt,COUNT(DISTINCT CASE WHEN o.status <> 'Resolvida' THEN a.occurrence_id END) AS assignedCount,COUNT(DISTINCT CASE WHEN o.status='Resolvida' THEN a.occurrence_id END) AS completedCount,COUNT(DISTINCT CASE WHEN o.due_at IS NOT NULL AND o.due_at < datetime('now') AND o.status <> 'Resolvida' THEN a.occurrence_id END) AS overdueCount FROM collaborators c LEFT JOIN assignments a ON a.collaborator_id=c.id LEFT JOIN occurrences o ON o.id=a.occurrence_id GROUP BY c.id ORDER BY c.name`).all().map(row=>({...row,active:Boolean(row.active)})); }
  function createCollaborator(input,user) { requireManager(user); const name=requiredText(input.name,'Nome',3,120),email=requiredText(input.email,'E-mail',5,160),phone=requiredText(input.phone,'Telefone',8,30),employeeCode=requiredText(input.employeeCode,'Matrícula',2,40),team=requiredText(input.team,'Equipe',3,80),role=requiredText(input.role,'Função',3,100),id=randomUUID(); try { db.prepare('INSERT INTO collaborators VALUES (?,?,?,?,?,?,?,?,?)').run(id,name,email,phone,employeeCode,team,role,1,new Date().toISOString()); } catch { throw new ValidationError('E-mail ou matrícula já cadastrados.'); } return listCollaborators().find(item=>item.id===id); }
  function setCollaborator(id,input,user) { requireManager(user); if (!db.prepare('SELECT 1 FROM collaborators WHERE id=?').get(id)) return null; const active=typeof input.active==='boolean'?Number(input.active):null, team=typeof input.team==='string'?requiredText(input.team,'Equipe',3,80):null; if(active===null && !team) throw new ValidationError('Informe uma alteração válida.'); db.prepare('UPDATE collaborators SET active=COALESCE(?,active),team=COALESCE(?,team) WHERE id=?').run(active,team,id); return listCollaborators().find(item=>item.id===id); }
  function assign(id,input,user) {
    requireManager(user); const current=get(id); if (!current) return null; if(current.status!=='Em análise') throw new ValidationError('A atribuição inicial só pode ocorrer durante a análise.'); const team=requiredText(input.team,'Equipe',3,80),note=requiredText(input.note,'Justificativa',5,600); if(!Array.isArray(input.collaboratorIds)||!input.collaboratorIds.length) throw new ValidationError('Selecione ao menos um colaborador.'); const ids=[...new Set(input.collaboratorIds)], selected=ids.map(collaboratorId=>db.prepare('SELECT id,name,team,active FROM collaborators WHERE id=?').get(collaboratorId)); if(selected.some(item=>!item||!item.active)) throw new ValidationError('Não é possível atribuir colaboradores inativos ou inexistentes.'); if(selected.some(item=>item.team!==team)) throw new ValidationError('Todos os colaboradores devem pertencer à equipe selecionada.'); const dueAt=input.dueAt?new Date(input.dueAt).toISOString():null; if(dueAt&&Number.isNaN(new Date(dueAt).getTime())) throw new ValidationError('Prazo inválido.');
    return transaction(()=>{const now=new Date().toISOString(); for(const person of selected) db.prepare('INSERT OR IGNORE INTO assignments VALUES (?,?,?,?)').run(id,person.id,user.id,now); db.prepare('UPDATE occurrences SET status=?,team=?,due_at=? WHERE id=?').run('Programada',team,dueAt,id); event(id,'Serviço atribuído',`${team} · ${selected.map(item=>item.name).join(', ')}. ${note}`,user,{action:'assign',fromStatus:'Em análise',toStatus:'Programada',time:now}); return get(id);});
  }
  function start(id,user) { const current=get(id); if(!current)return null; requireAssignment(id,user); if(current.status!=='Programada') throw new ValidationError('Apenas tarefas programadas podem ser iniciadas.'); return transaction(()=>{const now=new Date().toISOString();db.prepare('UPDATE occurrences SET status=? WHERE id=?').run('Em execução',id);event(id,'Serviço iniciado','Colaborador iniciou a execução em campo.',user,{action:'start',fromStatus:'Programada',toStatus:'Em execução',time:now});return get(id);}); }
  function progress(id,input,user) { const current=get(id);if(!current)return null;requireAssignment(id,user);if(current.status!=='Em execução')throw new ValidationError('Registros de andamento exigem uma tarefa em execução.');const note=requiredText(input.note,'Andamento',5,1000),progressValue=Number(input.progress);if(!Number.isInteger(progressValue)||progressValue<0||progressValue>100)throw new ValidationError('Informe o progresso entre 0 e 100.');const photo=validateEvidence(input.photo);return transaction(()=>{const now=new Date().toISOString();db.prepare('INSERT INTO execution_updates (occurrence_id,collaborator_id,kind,note,progress,photo,created_at) VALUES (?,?,?,?,?,?,?)').run(id,user.id,'andamento',note,progressValue,photo,now);event(id,'Andamento registrado',note,user,{action:'progress',fromStatus:'Em execução',toStatus:'Em execução',attachmentRef:photo?'evidência anexada':null,time:now});return get(id);}); }
  function conclude(id,input,user) { const current=get(id);if(!current)return null;requireAssignment(id,user);if(current.status!=='Em execução')throw new ValidationError('A conclusão exige uma tarefa em execução.');const note=requiredText(input.note,'Conclusão',10,1000),photo=validateEvidence(input.photo);return transaction(()=>{const now=new Date().toISOString();db.prepare('INSERT INTO execution_updates (occurrence_id,collaborator_id,kind,note,progress,photo,created_at) VALUES (?,?,?,?,?,?,?)').run(id,user.id,'conclusao',note,100,photo,now);db.prepare('UPDATE occurrences SET status=? WHERE id=?').run('Aguardando validação',id);event(id,'Conclusão enviada para validação',note,user,{action:'submit_completion',fromStatus:'Em execução',toStatus:'Aguardando validação',attachmentRef:photo?'evidência anexada':null,time:now});return get(id);}); }
  function validate(id,input,user) { requireManager(user);const current=get(id);if(!current)return null;if(current.status!=='Aguardando validação')throw new ValidationError('Não há uma conclusão aguardando validação.');const note=requiredText(input.note,'Justificativa',5,1000);if(!['aprovar','corrigir'].includes(input.decision))throw new ValidationError('Decisão de validação inválida.');return transaction(()=>{const now=new Date().toISOString(),status=input.decision==='aprovar'?'Resolvida':'Em execução';db.prepare('UPDATE occurrences SET status=?,resolved_at=? WHERE id=?').run(status,status==='Resolvida'?now:null,id);event(id,input.decision==='aprovar'?'Serviço aprovado':'Correção solicitada',note,user,{action:input.decision==='aprovar'?'approve':'request_correction',fromStatus:'Aguardando validação',toStatus:status,time:now});return get(id);}); }
  function collaboratorTasks(user) { if(!user||user.role!=='colaborador')throw new AuthorizationError('Acesso restrito a colaboradores.');return db.prepare('SELECT occurrence_id AS id FROM assignments WHERE collaborator_id=? ORDER BY assigned_at DESC').all(user.id).map(row=>get(row.id)); }
  function seedData() {
    if(!Number(db.prepare('SELECT count(*) AS n FROM collaborators').get().n)) for(const [id,name,email,phone,employeeCode,team,role] of demoCollaborators) db.prepare('INSERT INTO collaborators VALUES (?,?,?,?,?,?,?,?,?)').run(id,name,email,phone,employeeCode,team,role,1,new Date().toISOString());
    if(Number(db.prepare('SELECT count(*) AS n FROM occurrences').get().n))return;
    transaction(()=>{for(let i=0;i<24;i++){const cat=i<5?categories[i]:i<12?categories[0]:i<18?categories[1]:i<23?categories[2]:categories[3],region=i<5?regions[i]:i<12?regions[0]:i<18?regions[2]:i<23?regions[1]:regions[3],status=['Em análise','Programada','Em execução','Aguardando validação','Resolvida','Nova'][i%6],created=new Date(Date.now()-(i+1)*6*3600000).toISOString(),resolved=status==='Resolvida'?new Date(new Date(created).getTime()+6*3600000).toISOString():null,id=`demo-${String(i+1).padStart(3,'0')}`,team=['Em análise','Nova'].includes(status)?null:cat==='Iluminação'?'Equipe Luz 03':cat==='Lixo e limpeza'?'Equipe Limpeza 04':'Equipe Norte 02',collaborator=team==='Equipe Luz 03'?'colab-maria':team==='Equipe Limpeza 04'?'colab-carlos':'colab-joao',name=collaborator==='colab-maria'?'Maria Oliveira':collaborator==='colab-carlos'?'Carlos Santos':'João Silva',description=cat==='Pavimentação'?'Buraco grande próximo à faixa de pedestres, causando risco para carros e motos.':`Problema de ${cat.toLowerCase('pt-BR')} observado no local. Solicito a vistoria da equipe municipal.`,analysis=triage(cat,description),title=i<5?['Buraco na Av. das Esmeraldas','Lâmpada apagada · Rua 12','Descarte irregular · Praça Central','Árvore caída · Rua dos Ipês','Sinalização danificada · Av. Rio Branco'][i]:`${cat} · ${['Av. República','Rua Goiás','Rua Amazonas','Rua São Paulo'][i%4]}`;db.prepare('INSERT INTO occurrences (id,protocol,owner,title,category,region,address,neighborhood,description,photo,priority,status,team,reason,created_at,resolved_at,due_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,`OCO-${new Date().getUTCFullYear()}-${String(i+1).padStart(4,'0')}`,i<3?'cidadao-demo':'outro-demo',title,cat,region,i===0?'Av. das Esmeraldas, 245':`Rua ${i+1}, ${120+i*15}`,'Bairro demonstrativo',description,null,analysis.priority,status,team,analysis.reason,created,resolved,team?new Date(Date.now()+(i+2)*86400000).toISOString():null);event(id,'Ocorrência criada','Dado fictício para apresentação acadêmica.',{id:'cidadao-demo',name:'Cidadão demonstrativo',role:'cidadao'},{action:'create',toStatus:'Em análise',time:created});if(status!=='Nova')event(id,'Triagem demonstrativa',analysis.reason,manager,{action:'triage',toStatus:'Em análise',time:created});if(team){db.prepare('INSERT INTO assignments VALUES (?,?,?,?)').run(id,collaborator,manager.id,created);event(id,'Serviço atribuído',`Encaminhada para ${team}.`,manager,{action:'assign',fromStatus:'Em análise',toStatus:'Programada',time:created});}if(['Em execução','Aguardando validação','Resolvida'].includes(status))event(id,'Serviço iniciado','Equipe iniciou o atendimento.',{id:collaborator,name,role:'colaborador'},{action:'start',fromStatus:'Programada',toStatus:'Em execução',time:created});if(['Aguardando validação','Resolvida'].includes(status)){db.prepare('INSERT INTO execution_updates (occurrence_id,collaborator_id,kind,note,progress,photo,created_at) VALUES (?,?,?,?,?,?,?)').run(id,collaborator,'conclusao','Serviço executado para demonstração.',100,null,created);event(id,'Conclusão enviada para validação','Serviço executado para demonstração.',{id:collaborator,name,role:'colaborador'},{action:'submit_completion',fromStatus:'Em execução',toStatus:'Aguardando validação',time:created});}if(resolved)event(id,'Serviço aprovado','Atendimento concluído (demonstração).',manager,{action:'approve',fromStatus:'Aguardando validação',toStatus:'Resolvida',time:resolved});}}
    );
  }
  if(seed)seedData();
  return { db,get,list,create,update,actor,listCollaborators,createCollaborator,setCollaborator,assign,start,progress,conclude,validate,collaboratorTasks,close:()=>db.close() };
}
