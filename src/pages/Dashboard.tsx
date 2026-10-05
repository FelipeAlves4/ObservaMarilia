import { useState } from 'react';
import { Panel, RecentList, Stats, Empty } from '../components/ui';
import { CategoryChart } from '../components/Charts';
import { CityMap } from '../components/CityMap';
import { signals, stats } from '../helpers';
import type { Occurrence, Region } from '../types';
export function Dashboard({ records }: { records: Occurrence[] }) {
  const result=stats(records); const alerts=signals(records); const [region,setRegion]=useState<Region>();
  return <>
    <Stats items={[{value:result.total,label:'Ocorrências totais',note:'Chamados no período selecionado'},{value:result.open,label:'Em aberto',note:'Aguardando conclusão'},{value:result.resolved,label:'Resolvidas',note:`${result.rate}% de taxa de solução`},{value:result.average,label:'Tempo médio',note:'Entre abertura e conclusão'}]} />
    <div className="dashboard-top"><Panel title="Mapa de ocorrências" subtitle="Concentração e prioridade por região"><CityMap records={records} selected={region} onSelect={setRegion} />{region ? <a className="map-selection" href={'#/gestor/mapa?regiao='+encodeURIComponent(region)}>Explorar {region}</a> : null}</Panel>
      <Panel className="intelligence" title="Inteligência da cidade" subtitle={`${alerts.length} sinais detectados no período`}>
        <div className="intelligence-signals">{alerts.slice(0,3).map((a,i) => <a key={a.title} href={'#/gestor/mapa?regiao='+encodeURIComponent(a.region)} className="intelligence-signal" style={{ '--accent':['#ef4444','#f59e0b','#10b981'][i] } as React.CSSProperties}><strong>{a.title}</strong><p>{a.description}</p></a>)}{!alerts.length ? <Empty title="Nenhuma concentração detectada." text="São necessários 3 chamados abertos da mesma categoria e região." /> : null}</div>
        <div className="intelligence-actions"><a className="btn btn-teal" href={alerts.length ? '#/gestor/ocorrencias' : '#/gestor/equipes'}>Criar ordem de serviço</a><a className="btn btn-dark-light" href="#/gestor/alertas">Ver justificativa da análise</a></div>
        <small className="analysis-note">Análise demonstrativa por regras · validação humana necessária</small>
      </Panel></div>
    <div className="dashboard-bottom"><Panel title="Ocorrências por categoria" subtitle="Distribuição dos chamados no período selecionado"><CategoryChart records={records} /></Panel>
      <Panel title="Ocorrências recentes" subtitle="Chamados com maior impacto operacional"><RecentList records={records} manager /></Panel></div>
  </>;
}
