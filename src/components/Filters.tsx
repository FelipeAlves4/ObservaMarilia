import { categories, regions, statuses, type Occurrence } from '../types';
export interface FiltersValue { search: string; category: string; region: string; status: string; priority: string }
export const defaultFilters: FiltersValue = { search: '', category: '', region: '', status: '', priority: '' };
export function filterRecords(records: Occurrence[], f: FiltersValue) {
  const normalize = (s: string) => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = normalize(f.search);
  return records.filter(r => (!f.category || r.category === f.category) && (!f.region || r.region === f.region) && (!f.status || r.status === f.status) && (!f.priority || r.priority === f.priority) && normalize(`${r.title} ${r.protocol} ${r.address} ${r.neighborhood}`).includes(q));
}
export function Filters({ value, onChange, action }: { value: FiltersValue; onChange: (f: FiltersValue) => void; action?: React.ReactNode }) {
  const select = (key: keyof FiltersValue, label: string, options: readonly string[]) => <select aria-label={label} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}><option value="">{label}</option>{options.map(o => <option key={o}>{o}</option>)}</select>;
  return <div className="filters"><span className="filters-label">Filtros rápidos</span><div className="filters-controls">
    {select('category','Todas as categorias',categories)}{select('status','Todos os status',statuses)}{select('region','Todas as regiões',regions)}{select('priority','Todas as prioridades',['Alta','Média','Baixa'])}
    <input type="search" aria-label="Buscar ocorrência" placeholder="Buscar protocolo, rua ou bairro" value={value.search} onChange={e => onChange({ ...value, search:e.target.value })} />
    <button className="btn btn-light" onClick={() => onChange(defaultFilters)}>Limpar filtros</button>{action}
  </div></div>;
}
