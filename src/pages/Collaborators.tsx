import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Collaborator } from '../types';
import { Badge, Empty, ErrorBox, PageHeading, Panel, Stats } from '../components/ui';

const blank = { name:'', email:'', phone:'', employeeCode:'', team:'Equipe Norte 02', role:'' };
export function Collaborators() {
  const [people,setPeople]=useState<Collaborator[]>([]),[form,setForm]=useState(blank),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const load=async()=>{setLoading(true);try{setPeople(await api.collaborators());setError('');}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar colaboradores.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.createCollaborator(form);setForm(blank);setSaved('Colaborador cadastrado e disponível para atribuições.');await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar.');}finally{setBusy(false);}}
  async function toggle(person:Collaborator){setError('');try{await api.setCollaborator(person.id,{active:!person.active});await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar.');}}
  const active=people.filter(p=>p.active);
  return <><PageHeading title="Colaboradores" subtitle="Cadastre responsáveis, acompanhe a carga e preserve a atribuição por equipe." />
    <Stats items={[{value:active.length,label:'Colaboradores ativos',note:'Disponíveis para atribuição'},{value:people.reduce((n,p)=>n+(p.assignedCount||0),0),label:'Tarefas em aberto',note:'Atribuições em operação',color:'#f59e0b'},{value:people.reduce((n,p)=>n+(p.overdueCount||0),0),label:'Tarefas atrasadas',note:'Prazos vencidos',color:'#ef4444'},{value:people.reduce((n,p)=>n+(p.completedCount||0),0),label:'Serviços validados',note:'Histórico consolidado',color:'#10b981'}]} />
    <div className="collaborator-admin-grid"><Panel title="Novo colaborador" subtitle="Dados fictícios de demonstração; não exponha contatos na área pública."><form className="collaborator-form" onSubmit={submit} noValidate>{Object.entries(form).map(([key,value])=><label key={key}>{({name:'Nome completo',email:'E-mail',phone:'Telefone',employeeCode:'Matrícula',team:'Equipe',role:'Função'} as Record<string,string>)[key]}<input required minLength={key==='name'?3:2} value={value} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={key==='team'?'Ex.: Equipe Norte 02':undefined} /></label>)}<button className="btn" disabled={busy}>{busy?'Salvando…':'Cadastrar colaborador'}</button></form><ErrorBox error={error}/>{saved?<p className="success-message" role="status">{saved}</p>:null}</Panel>
      <Panel title="Equipe cadastrada" subtitle={`${people.length} registro(s) no ambiente de demonstração`}>{loading?<div className="loading" role="status">Carregando colaboradores…</div>:people.length?<div className="collaborator-list">{people.map(person=><article key={person.id} className="collaborator-row"><div><strong>{person.name}</strong><small>{person.role} · {person.employeeCode}</small><p>{person.team}</p></div><div className="collaborator-load"><span>{person.assignedCount||0} abertas</span><span>{person.completedCount||0} concluídas</span></div><Badge tone={person.active?'green':'gray'}>{person.active?'Ativo':'Inativo'}</Badge><button className="btn btn-light" onClick={()=>void toggle(person)}>{person.active?'Desativar':'Ativar'}</button></article>)}</div>:<Empty title="Nenhum colaborador cadastrado." text="Cadastre uma pessoa para iniciar atribuições individuais."/>}</Panel></div>
  </>;
}
