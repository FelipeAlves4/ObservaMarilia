import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { DemoCollaborator } from '../types';
import { ErrorBox, Panel } from '../components/ui';

export function CollaboratorAccess(){
  const [people,setPeople]=useState<DemoCollaborator[]>([]);
  const [selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let mounted=true;
    api.demoCollaborators().then(list=>{
      if(mounted){setPeople(list);setSelected(previous=>list.some(person=>person.id===previous)?previous:(list[0]?.id||''));}
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Não foi possível carregar colaboradores.');})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[]);
  function enter(e:FormEvent){
    e.preventDefault();
    if(selected&&people.some(person=>person.id===selected))window.location.hash='/colaborador?perfil='+encodeURIComponent(selected);
  }
  return <div className="collaborator-shell">
    <header className="collaborator-header"><a href="#/" className="collaborator-brand">Observa<span>Marília</span></a><a href="#/acesso" className="collaborator-back">Voltar aos acessos</a></header>
    <main className="collaborator-main collaborator-access">
      <div className="collaborator-access-intro"><span className="collaborator-access-icon" aria-hidden="true">👷</span><h1>Portal do colaborador</h1><p>Escolha um colaborador ativo para explorar suas tarefas de campo e registrar a execução dos serviços.</p></div>
      <Panel title="Entrar na demonstração" subtitle="Nesta versão acadêmica, a seleção do perfil não exige senha.">
        <form className="collaborator-form" onSubmit={enter}>
          <label htmlFor="collaborator-select">Colaborador</label>
          <select id="collaborator-select" value={selected} disabled={loading||!people.length} onChange={e=>setSelected(e.target.value)} required>
            {loading?<option value="">Carregando colaboradores…</option>:!people.length?<option value="">Nenhum colaborador ativo</option>:people.map(person=><option key={person.id} value={person.id}>{person.name} · {person.team}</option>)}
          </select>
          <button className="btn" disabled={loading||!selected}>Acessar minhas atividades →</button>
        </form>
        <ErrorBox error={error}/>
        {!loading&&!people.length?<p className="form-info">Nenhum perfil ativo disponível. Cadastre ou ative um colaborador na área do gestor.</p>:null}
        <p className="form-info">Deseja criar outro colaborador? <a href="#/gestor/colaboradores">Abra o cadastro do gestor</a>. Não use informações reais neste protótipo sem autenticação.</p>
      </Panel>
    </main>
  </div>;
}
