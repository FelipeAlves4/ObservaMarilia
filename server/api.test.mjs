import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createDatabase } from './database.mjs';
import { createApp } from './index.mjs';

let store, server, base;
const report = { title:'Buraco próximo à escola', category:'Pavimentação', region:'Zona Norte',
  address:'Rua Teste, 200', neighborhood:'Bairro Teste', description:'Buraco profundo com risco de acidente próximo à escola.', photo:null };
before(async () => {
  store=createDatabase(':memory:',true); server=createApp(store); server.listen(0,'127.0.0.1');
  await once(server,'listening'); base=`http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await once(server,'close'); store.close(); });
async function send(path, method, body, headers={}) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(method==='PATCH'?{'X-Demo-Actor':'gestor-demo'}:{}),...headers},body:body === undefined ? undefined : JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
test('Cria um relato com protocolo único, prioridade e histórico',async () => {
  const first=await send('/api/occurrences','POST',report); const second=await send('/api/occurrences','POST',report);
  assert.equal(first.status,201); assert.equal(first.data.priority,'Alta'); assert.equal(first.data.status,'Em análise');
  assert.match(first.data.protocol,/^OCO-\d{4}-\d{4}$/); assert.notEqual(first.data.protocol,second.data.protocol);
  assert.equal(first.data.history.length,2); assert.match(first.data.reason,/risco/);
});
test('Rejeita campos e fotos inválidos sem gravar registros',async () => {
  const before=store.list().length;
  for(const input of [{...report,description:'curta'},{...report,category:'Inválida'},{...report,region:'Outra cidade'}, {...report,photo:'data:image/png;base64,YWJj'}]) {
    const r=await send('/api/occurrences','POST',input); assert.equal(r.status,400);
  }
  assert.equal(store.list().length,before);
});
test('Persiste uma foto PNG e só a retorna no detalhe',async () => {
  const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const result=await send('/api/occurrences','POST',{...report,photo}); assert.equal(result.status,201);
  const list=await send('/api/occurrences','GET'); const item=list.data.find(r => r.id === result.data.id);
  assert.equal(item.hasPhoto,true); assert.equal(item.photo,undefined);
  const detail=await send('/api/occurrences/'+item.id,'GET'); assert.equal(detail.data.photo,photo);
});
test('Exige equipe e justificativa; impede pular etapas e resolução sem validação',async () => {
  const {data}=await send('/api/occurrences','POST',report); const path='/api/occurrences/'+data.id;
  assert.equal((await send(path,'PATCH',{status:'Resolvida',team:'Equipe Norte 02',note:'Atendimento concluído'})).status,400);
  assert.equal((await send(path,'PATCH',{status:'Programada',team:'Equipe inexistente',note:'Vistoria agendada'})).status,400);
  assert.equal((await send(path,'PATCH',{status:'Programada',team:'Equipe Norte 02',note:''})).status,400);
  for(const status of ['Programada','Em execução']) {
    const r=await send(path,'PATCH',{status,team:'Equipe Norte 02',note:'Atualização da equipe de atendimento'});
    assert.equal(r.status,200); assert.equal(r.data.status,status);
  }
  const final=(await send(path,'GET')).data;
  assert.equal(final.status,'Em execução'); assert.equal(final.history.length,4);
  assert.equal((await send(path,'PATCH',{status:'Resolvida',team:'Equipe Norte 02',note:'Sem validação'})).status,400);
});
test('Separa os relatos do cidadão demo e retorna 404 para IDs ausentes',async () => {
  const other=store.create({...report,title:'Outro cidadão reportou'},'outro-demo');
  const own=await send('/api/occurrences?mine=1','GET'); assert.ok(!own.data.some(r => r.id === other.id));
  assert.equal((await send('/api/occurrences/inexistente','GET')).status,404);
});
test('Bloqueia origem externa e conteúdo incorreto nas escritas',async () => {
  assert.equal((await send('/api/occurrences','POST',report,{'Origin':'https://outro.example'})).status,403);
  const r=await fetch(base+'/api/occurrences',{method:'POST',headers:{'Content-Type':'text/plain'},body:'texto'}); assert.equal(r.status,415);
  assert.equal((await send('/api/occurrences','POST',null)).status,400);
});
test('Mantém relatos e histórico depois de reabrir o SQLite',() => {
  const dir=mkdtempSync(join(tmpdir(),'observamarilia-test-')); const path=join(dir,'test.sqlite');
  let database=createDatabase(path,false);
  try {
    const r=database.create(report); database.update(r.id,{status:'Programada',team:'Equipe Norte 02',note:'Vistoria programada para o período'});
    database.close(); database=createDatabase(path,false);
    assert.equal(database.get(r.id).status,'Programada'); assert.equal(database.get(r.id).history.length,3);
  } finally { database.close(); rmSync(dir,{recursive:true,force:true}); }
});
test('O seed é idempotente e contém somente os 3 relatos do perfil demo',() => {
  const seeded=createDatabase(':memory:');
  try { assert.equal(seeded.list().length,24); assert.equal(seeded.list('cidadao-demo').length,3); }
  finally { seeded.close(); }
});
test('Fluxo vertical: gestor atribui, colaborador executa e gestor valida', async () => {
  const created=await send('/api/occurrences','POST',report); const path='/api/occurrences/'+created.data.id;
  const managerHeaders={'X-Demo-Actor':'gestor-demo'};
  const collaborators=await send('/api/collaborators','GET',undefined,managerHeaders);
  assert.equal(collaborators.status,200); const joao=collaborators.data.find(person=>person.id==='colab-joao'); assert.ok(joao);
  const assigned=await send(path+'/assign','POST',{team:'Equipe Norte 02',collaboratorIds:[joao.id],note:'Vistoria e reparo priorizados.',dueAt:'2030-01-10T12:00'},managerHeaders);
  assert.equal(assigned.status,200); assert.equal(assigned.data.status,'Programada'); assert.equal(assigned.data.assignees[0].id,joao.id);
  const tasks=await send('/api/collaborator/tasks','GET',undefined,{'X-Demo-Actor':'colab-joao'}); assert.ok(tasks.data.some(task=>task.id===created.data.id));
  assert.equal((await send(path+'/start','POST',{}, {'X-Demo-Actor':'colab-joao'})).data.status,'Em execução');
  assert.equal((await send(path+'/progress','POST',{note:'Área isolada e massa asfáltica preparada.',progress:55,photo:null},{'X-Demo-Actor':'colab-joao'})).status,200);
  const submitted=await send(path+'/conclude','POST',{note:'Buraco reparado com aplicação de massa asfáltica. Via liberada.',photo:null},{'X-Demo-Actor':'colab-joao'});
  assert.equal(submitted.data.status,'Aguardando validação');
  const approved=await send(path+'/validate','POST',{decision:'aprovar',note:'Serviço conferido e aprovado pelo gestor.'},managerHeaders);
  assert.equal(approved.data.status,'Resolvida'); assert.ok(approved.data.resolvedAt); assert.ok(approved.data.history.some(event=>event.action==='approve'));
});
test('Rejeita alteração por colaborador não atribuído e atribuição de inativo', async () => {
  const created=await send('/api/occurrences','POST',report); const path='/api/occurrences/'+created.data.id;
  const forbidden=await send(path+'/start','POST',{}, {'X-Demo-Actor':'colab-maria'}); assert.equal(forbidden.status,403);
  const people=await send('/api/collaborators','GET',undefined,{'X-Demo-Actor':'gestor-demo'}); const maria=people.data.find(person=>person.id==='colab-maria');
  assert.equal((await send('/api/collaborators/'+maria.id,'PATCH',{active:false},{'X-Demo-Actor':'gestor-demo'})).status,200);
  const assignment=await send(path+'/assign','POST',{team:'Equipe Luz 03',collaboratorIds:[maria.id],note:'Encaminhamento para iluminação.'},{'X-Demo-Actor':'gestor-demo'});
  assert.equal(assignment.status,400);
});
