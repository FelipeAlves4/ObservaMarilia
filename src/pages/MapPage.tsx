import { useState } from 'react';
import { CityMap } from '../components/CityMap';
import { Filters, defaultFilters, filterRecords } from '../components/Filters';
import { Badge, Empty, Panel, RecentList, PageHeading } from '../components/ui';
import { exportCsv, signals } from '../helpers';
import type { Occurrence } from '../types';
export function MapPage({ records, manager = false, initialRegion = '' }: { records: Occurrence[]; manager?: boolean; initialRegion?: string }) {
  const [filters,setFilters]=useState({...defaultFilters,region:initialRegion});
  const [selected,setSelected]=useState(initialRegion || 'Zona Norte');
  const [heat,setHeat]=useState(true);
  const visible=filterRecords(records,filters);
  const regionRecords=visible.filter(r => r.region === selected);
  const alert=signals(visible).find(a => a.region === selected);
  return <>{!manager ? <PageHeading title="Mapa da cidade" subtitle="Explore os relatos enviados pela população." /> : null}
    <Filters value={filters} onChange={setFilters} action={<button className="btn" onClick={() => setHeat(!heat)} aria-pressed={heat}>Camadas: {heat ? 'calor ativo' : 'sem calor'}</button>} />
    <div className="map-page-grid"><Panel title="Mapa de ocorrências" subtitle={`${visible.length} ocorrências visíveis nesta área`} action={<Badge tone="green">{heat ? 'Mapa de calor ativo' : 'Ocorrências'}</Badge>}><CityMap records={visible} variant="full" selected={selected} onSelect={setSelected} heat={heat} /><div className="map-footer"><div><small>Área selecionada</small><strong>{selected}</strong></div><button className="btn btn-outline" onClick={() => exportCsv(visible)}>Exportar visão</button></div></Panel>
      <Panel className="map-aside"><small className="eyebrow">ÁREA SELECIONADA</small><h2>{selected}</h2><p>Chamados do período e filtros selecionados</p><div className="mini-stats"><div><strong>{regionRecords.length}</strong><small>Ocorrências</small></div><div><strong>{regionRecords.filter(r => r.status !== 'Resolvida').length}</strong><small>Em aberto</small></div></div>
        {alert ? <div className="intelligence small-intelligence"><small>INTELIGÊNCIA DA CIDADE</small><h3>Concentração detectada</h3><p>{alert.description}</p><div className="suggestion">Sugestão<p>Priorizar vistoria de {alert.category.toLowerCase()} nesta região.</p></div></div> : null}
        <h3 className="spaced-title">Ocorrências da região</h3><RecentList records={regionRecords} manager={manager} limit={5} />{!regionRecords.length ? <Empty title="Nenhum relato nesta região." text="Selecione outro ponto ou limpe os filtros." /> : null}<a className="btn full-width" href={manager ? '#/gestor/ocorrencias' : '#/meus-relatos'}>{manager ? 'Ver fila completa de ocorrências' : 'Acompanhar meus relatos'}</a>
      </Panel></div>
  </>;
}
