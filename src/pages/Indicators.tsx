import { useState } from 'react';
import { Panel, Stats, PageHeading, Badge } from '../components/ui';
import { CategoryChart, DailyChart, RegionChart } from '../components/Charts';
import { categories, regions, type Occurrence } from '../types';
import { exportCsv, stats } from '../helpers';
export function Indicators({ records, manager = false }: { records: Occurrence[]; manager?: boolean }) {
  const [region,setRegion]=useState(''); const [category,setCategory]=useState('');
  const filtered=records.filter(r => (!region || r.region === region) && (!category || r.category === category)); const s=stats(filtered);
  return <>{!manager ? <PageHeading title="Indicadores da cidade" subtitle="Dados agregados de participação e atendimento da demonstração." /> : null}
    <Stats items={[{value:`${s.rate}%`,label:'Taxa de resolução',note:'Conclusões sobre o total'},{value:s.average,label:'Tempo médio',note:'Entre abertura e conclusão',color:'#10b981'},{value:s.open,label:'Em atendimento',note:'Chamados não concluídos'},{value:s.total,label:'Participação cidadã',note:'Relatos registrados',color:'#f59e0b'}]} />
    <div className="filters"><span className="filters-label">Visão dos indicadores</span><div className="filters-controls"><select aria-label="Região dos indicadores" value={region} onChange={e => setRegion(e.target.value)}><option value="">Todas as regiões</option>{regions.map(r => <option key={r}>{r}</option>)}</select><select aria-label="Categoria dos indicadores" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c}>{c}</option>)}</select><button className="btn" onClick={() => exportCsv(filtered)}>Exportar relatório</button></div></div>
    <div className="indicators-grid"><Panel title="Evolução dos registros" subtitle="Chamados abertos por dia nos últimos 7 dias" action={<Badge tone="green">{s.resolved} resolvidos</Badge>}><DailyChart records={filtered} /></Panel><Panel title="Desempenho por região" subtitle="Taxa de resolução e tempo médio"><RegionChart records={filtered} /></Panel></div>
    <div className="dashboard-bottom"><Panel title="Categorias com maior pressão" subtitle="Distribuição do volume de relatos registrados"><CategoryChart records={filtered} /></Panel><Panel title="Transparência e participação" subtitle="Indicadores disponíveis para a população"><div className="transparency-stats"><div><strong>{s.total}</strong><small>Chamados recebidos</small></div><div><strong>{s.resolved}</strong><small>Resolvidos</small></div><div><strong>{s.rate}%</strong><small>Taxa pública</small></div><div><strong>{s.average}</strong><small>Tempo médio</small></div></div><div className="publish-panel"><div><strong>Portal público de indicadores</strong><p>Dados calculados a partir dos registros do protótipo.</p></div><a className="btn btn-blue" href={manager ? '#/indicadores' : '#/relatar'}>{manager ? 'Ver portal' : 'Participar'}</a></div></Panel></div>
  </>;
}
