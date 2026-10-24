import { useState, type ReactNode } from 'react';
import { Brand, asset } from './ui';
import { useAuth } from '../auth';
const nav = [['/gestor','Visão geral'],['/gestor/mapa','Mapa da cidade'],['/gestor/ocorrencias','Ocorrências'],['/gestor/alertas','Alertas da IA'],['/gestor/equipes','Equipes'],['/gestor/colaboradores','Colaboradores'],['/gestor/indicadores','Indicadores'],['/gestor/configuracoes','Configurações']];
const headings: Record<string,[string,string]> = {
  '/gestor':['Visão geral da cidade','Ocorrências, regiões críticas e recomendações em tempo real.'],
  '/gestor/mapa':['Mapa da cidade','Explore ocorrências, hotspots e prioridades em todo o município.'],
  '/gestor/ocorrencias':['Ocorrências','Organize, encaminhe e acompanhe os chamados da população.'],
  '/gestor/alertas':['Central de Alertas da IA','Padrões e recomendações. Análise por regras nesta demonstração.'],
  '/gestor/equipes':['Equipes e operações','Distribua, acompanhe e conclua os chamados priorizados pela cidade.'],
  '/gestor/colaboradores':['Colaboradores','Cadastre responsáveis, acompanhe a carga e preserve a operação por equipe.'],
  '/gestor/indicadores':['Indicadores da cidade','Desempenho urbano, eficiência operacional e transparência em um só lugar.'],
  '/gestor/configuracoes':['Configurações','Informações do projeto e da demonstração acadêmica.'],
};
export function ManagerLayout({ children, route, period, setPeriod }: { children: ReactNode; route: string; period: string; setPeriod: (v:string) => void }) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const initials=(profile?.name ?? 'Gestor').split(' ').map(name=>name[0]).join('').slice(0,2).toUpperCase();
  const heading = headings[route] || ['Detalhes da ocorrência','Acompanhe análise, andamento e encaminhamento da solicitação.'];
  return <div className="manager-shell">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Pular para o conteúdo</a>
    <aside className={'sidebar ' + (open ? 'sidebar-open' : '')}>
      <Brand dark /><nav aria-label="Menu do gestor">{nav.map(([path,label]) => <a href={'#'+path} key={path} onClick={() => setOpen(false)} className={route === path || (path === '/gestor/ocorrencias' && route.startsWith(path+'/')) ? 'active' : ''} aria-current={route === path ? 'page' : undefined}>
        <img src={asset('dashboard',route === path || (path === '/gestor/ocorrencias' && route.startsWith(path+'/')) ? 'imgEllipse' : 'imgEllipse1')} alt="" />{label}
      </a>)}</nav>
      <div className="sidebar-status"><small>STATUS DA CIDADE</small><p><img src={asset('dashboard','imgEllipse2')} alt="" /> Painel operacional</p><span>Acompanhamento em tempo real</span><a href="#/">Ir à área do cidadão</a></div>
    </aside>
    {open ? <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} /> : null}
    <div className="manager-main"><header className="manager-header">
      <button className="mobile-menu btn btn-light" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
      <div><h1>{heading[0]}</h1><p>{heading[1]}</p></div>
      <select aria-label="Período dos indicadores" value={period} onChange={e => setPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="all">Todo o período</option></select>
      <button className="avatar" type="button" title="Sair da conta" onClick={() => void signOut()}>{initials}</button>
    </header><main id="main-content" className="manager-content" tabIndex={-1}>{children}</main><footer className="demo-footer">ObservaMarília · gestão urbana colaborativa</footer></div>
  </div>;
}
export function PublicLayout({ children, route = '/' }: { children: ReactNode; route?: string }) {
  const accountView=route === '/meus-relatos';
  const { profile, signOut } = useAuth();
  const initials=(profile?.name ?? 'Cidadão').split(' ').map(name=>name[0]).join('').slice(0,2).toUpperCase();
  return <div className="public-shell"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Pular para o conteúdo</a><header className={'public-header ' + (accountView ? 'account-header' : '')}><Brand /><nav aria-label="Navegação do cidadão"><a href="#/mapa">Mapa da cidade</a><a href="#/indicadores">Indicadores</a><a href="#/como-funciona">Como funciona</a></nav>{accountView && profile ? <button className="citizen-account" type="button" title="Sair da conta" onClick={() => void signOut()}><span className="avatar">{initials}</span><span><strong>{profile.name}</strong><small>Minha conta · sair</small></span><b aria-hidden="true">⌄</b></button> : <div className="header-actions">{profile ? <a className="btn btn-light" href="#/meus-relatos">Minha conta</a> : <a className="btn btn-light" href="#/acesso">Entrar</a>}<a className="btn" href="#/relatar">Reportar problema</a></div>}</header>
    <main id="main-content" className={'public-content ' + (accountView ? 'account-content' : '')} tabIndex={-1}>{children}</main><footer className="public-footer"><Brand /><p>ObservaMarília · plataforma acadêmica de participação urbana</p></footer>
  </div>;
}
