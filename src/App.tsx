import { useEffect, useState } from 'react';
import { useData, useRoute } from './data';
import { inPeriod } from './helpers';
import { ManagerLayout, PublicLayout } from './components/Layout';
import { ErrorBox } from './components/ui';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Report } from './pages/Report';
import { MapPage } from './pages/MapPage';
import { Occurrences } from './pages/Occurrences';
import { Detail } from './pages/Detail';
import { Alerts } from './pages/Alerts';
import { Teams } from './pages/Teams';
import { Indicators } from './pages/Indicators';
import { Information } from './pages/Information';
import { Presentation } from './pages/Presentation';
import { Collaborators } from './pages/Collaborators';
import { CollaboratorPortal } from './pages/CollaboratorPortal';
import { Access } from './pages/Access';
import { AdminManagement } from './pages/AdminManagement';
import { useAuth } from './auth';
import { canOpenProtectedRoute } from './accessPolicy';
export default function App() {
  const fullRoute=useRoute(); const [route,query='']=fullRoute.split('?'); const manager=route.startsWith('/gestor'); const collaborator=route.startsWith('/colaborador'); const admin=route.startsWith('/admin');
  const citizenMode = route === '/cidadao' || route.startsWith('/cidadao/');
  const citizenPage = citizenMode ? route.slice('/cidadao'.length) || '/' : route;
  const publicCitizenPage = ['/', '/mapa', '/indicadores', '/como-funciona', '/relatar', '/meus-relatos'].includes(citizenPage) || /^\/ocorrencias\/[^/]+$/.test(citizenPage);
  const pageRoute = citizenMode && !publicCitizenPage ? '/pagina-inexistente' : citizenPage;
  const [period,setPeriod]=useState('7'); const { records,mine,loading,error,refresh }=useData(); const { profile, loading: authLoading } = useAuth();
  const periodRecords=inPeriod(records,period); const initialRegion=new URLSearchParams(query).get('regiao') || '';
  useEffect(() => { document.title=(admin ? 'Administração' : collaborator ? 'Colaborador' : manager ? 'Gestor' : 'Cidade')+' • ObservaMarília'; },[admin,collaborator,manager]);
  let content;
  if(route === '/acesso' || route === '/admin/login') { const accessQuery = new URLSearchParams(query); return <Access requested={accessQuery.get('returnTo') || ''} accessType={route === '/admin/login' ? 'admin' : accessQuery.get('tipo') || new URLSearchParams(location.search).get('tipo')} />; }
  if(authLoading) return <div className="loading" role="status">Verificando sessão…</div>;
  if (!canOpenProtectedRoute(profile, route)) {
    return <Access requested={query ? `${route}?${query}` : route} accessType={admin || citizenMode ? 'admin' : undefined} />;
  }
  if(route === '/admin/secretarias') return <AdminManagement view="departments" />;
  if(route === '/admin/gestores') return <AdminManagement view="managers" />;
  if(pageRoute === '/relatar') return <Report />;
  else if(pageRoute === '/') content=<Home />;
  else if(pageRoute === '/apresentacao') content=<Presentation />;
  else if(route === '/colaborador') return <CollaboratorPortal key={fullRoute} adminMode={profile?.role === 'admin'} />;
  else if(route === '/gestor') content=<Dashboard records={periodRecords} />;
  else if(pageRoute === '/mapa' || route === '/gestor/mapa') content=<MapPage key={fullRoute} records={manager ? periodRecords : records} manager={manager} initialRegion={initialRegion} />;
  else if(pageRoute === '/meus-relatos') content=<Occurrences records={mine} mine />;
  else if(route === '/gestor/ocorrencias') content=<Occurrences records={periodRecords} />;
  else if(/^\/(gestor\/)?ocorrencias\/[^/]+$/.test(pageRoute)) content=<Detail key={route} id={pageRoute.split('/').pop()!} manager={manager} />;
  else if(route === '/gestor/alertas') content=<Alerts records={periodRecords} />;
  else if(route === '/gestor/equipes') content=<Teams records={periodRecords} />;
  else if(route === '/gestor/colaboradores') content=<Collaborators />;
  else if(pageRoute === '/indicadores' || route === '/gestor/indicadores') content=<Indicators records={manager ? periodRecords : records} manager={manager} />;
  else if(pageRoute === '/como-funciona' || route === '/gestor/configuracoes') content=<Information settings={manager} />;
  else content=<div className="empty"><h1>Página não encontrada</h1><a className="btn" href="#/">Voltar ao início</a></div>;
  const body=<>{error ? <div className="connection-error"><ErrorBox error={error} /><button className="btn" onClick={() => void refresh()}>Tentar novamente</button></div> : null}{loading ? <div className="loading" role="status">Carregando dados da cidade…</div> : content}</>;
  return manager ? <ManagerLayout route={route} period={period} setPeriod={setPeriod}>{body}</ManagerLayout> : <PublicLayout route={pageRoute}>{body}</PublicLayout>;
}
