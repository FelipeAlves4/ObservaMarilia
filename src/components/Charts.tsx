import { categories, categoryColors, regions, type Occurrence } from '../types';
import { stats } from '../helpers';
export function CategoryChart({ records }: { records: Occurrence[] }) {
  const counts = categories.map(category => ({ category, count:records.filter(r => r.category === category).length }));
  const max = Math.max(1,...counts.map(c => c.count));
  return <div className="bar-list">{counts.map(c => <div key={c.category}><div className="bar-label"><span>{c.category}</span><strong>{records.length ? Math.round(c.count / records.length * 100) : 0}%</strong></div><div className="bar-track"><div style={{ width:`${c.count / max * 84}%`, background:categoryColors[c.category] }} /></div></div>)}</div>;
}
export function RegionChart({ records }: { records: Occurrence[] }) {
  return <div className="bar-list region-bars">{regions.map((region,i) => { const result=stats(records.filter(r => r.region === region)); return <div key={region}><div className="bar-label"><span>{region}</span><strong>{result.rate}% <small>{result.average}</small></strong></div><div className="bar-track"><div style={{ width:`${result.rate}%`, background:['#10b981','#2563eb','#7c3aed','#f59e0b','#94a3b8'][i] }} /></div></div>; })}</div>;
}
export function DailyChart({ records }: { records: Occurrence[] }) {
  const days=Array.from({length:7},(_,i) => {
    const date=new Date(); date.setDate(date.getDate()-6+i);
    const key=date.toLocaleDateString('pt-BR');
    const daily=records.filter(r => new Date(r.createdAt).toLocaleDateString('pt-BR') === key);
    return { label:date.toLocaleDateString('pt-BR',{ day:'2-digit',month:'2-digit' }), count:daily.length, resolved:daily.filter(r => r.status === 'Resolvida').length };
  });
  const max=Math.max(1,...days.map(d => d.count));
  return <div className="daily-chart" role="img" aria-label={days.map(d => `${d.label}: ${d.count} chamados`).join('; ')}>{days.map(d => <div className="daily-column" key={d.label}><strong>{d.count}</strong><div className="daily-track"><div style={{ height:`${d.count / max * 100}%` }} /></div><small>{d.label}</small></div>)}</div>;
}
