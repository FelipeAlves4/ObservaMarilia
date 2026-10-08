import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from '../helpers';
import type { Occurrence } from '../types';
export const asset = (screen: string, name: string) => `/assets/${screen}-${name}.svg`;
export function ResponsiveAsset({ src, alt, width, height }: { src:string; alt:string; width:number; height:number }) {
  const ref=useRef<HTMLDivElement>(null); const [available,setAvailable]=useState(width);
  useEffect(() => {
    if(!ref.current) return;
    const observer=new ResizeObserver(entries => setAvailable(entries[0].contentRect.width));
    observer.observe(ref.current); return () => observer.disconnect();
  },[]);
  return <div ref={ref} className="responsive-asset" style={{width:'100%',maxWidth:width,height:available*height/width}}><img src={src} alt={alt} style={{transform:`scale(${available/width})`,transformOrigin:'top left'}} /></div>;
}
export function Brand({ dark = false }: { dark?: boolean }) {
  return <a className={'brand ' + (dark ? 'brand-dark' : '')} href={dark ? '#/gestor' : '#/'} aria-label="ObservaMarília, página inicial">
    <span className="brand-logo"><img src={asset(dark ? 'dashboard' : '23-2', 'imgLogoOficialObservaMarilia')} alt="" /></span>
    <span><strong>ObservaMarilia</strong><small>Inteligência Urbana</small></span>
  </a>;
}
export function Panel({ title, subtitle, children, className = '', action }: { title?: string; subtitle?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={'panel ' + className}>
    {title ? <div className="panel-heading"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div> : null}
    {children}
  </section>;
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const color = tone || (children === 'Alta' || children === 'Crítico' ? 'red' : children === 'Média' || children === 'Programada' || children === 'Em execução' || children === 'Atenção' ? 'amber' : children === 'Aguardando validação' ? 'blue' : children === 'Resolvida' || children === 'Baixa' ? 'green' : 'blue');
  return <span className={'badge badge-' + color}>{children}</span>;
}
export interface StatItem { value: string | number; label: string; note?: string; color?: string }
export function Stats({ items, className = '' }: { items: StatItem[]; className?: string }) {
  return <div className={'stats ' + className}>{items.map((item,i) => <div className="stat" key={item.label} style={{ '--accent': item.color || ['#2563eb','#f59e0b','#10b981','#7c3aed'][i % 4] } as React.CSSProperties}>
    <strong>{typeof item.value === 'number' ? formatNumber(item.value) : item.value}</strong><span>{item.label}</span>{item.note ? <small>{item.note}</small> : null}
  </div>)}</div>;
}
export function Empty({ title = 'Nenhuma ocorrência encontrada.', text = 'Experimente ajustar os filtros ou enviar um novo relato.' }: { title?: string; text?: string }) {
  return <div className="empty"><strong>{title}</strong><p>{text}</p></div>;
}
export function ErrorBox({ error }: { error: string }) { return error ? <p className="error-box" role="alert">{error}</p> : null; }
export function RecentList({ records, manager = false, limit = 4 }: { records: Occurrence[]; manager?: boolean; limit?: number }) {
  return <div className="recent-list">{records.slice(0, limit).map(r => <a key={r.id} className="recent-row" href={`#/${manager ? 'gestor/' : ''}ocorrencias/${r.id}`}>
    <div><strong>{r.title}</strong><small>{r.region}</small></div><Badge>{r.priority}</Badge><Badge>{r.status}</Badge>
  </a>)}{!records.length ? <Empty /> : null}</div>;
}
export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
