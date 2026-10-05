import { categories, regions, type Occurrence } from './types';
export const formatNumber = (n: number) => n.toLocaleString('pt-BR');
export const dateTime = (date: string) => new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function inPeriod(records: Occurrence[], days: string) {
  if (days === 'all') return records;
  const cutoff = Date.now() - Number(days) * 86400000;
  return records.filter(r => new Date(r.createdAt).getTime() >= cutoff);
}
export function stats(records: Occurrence[]) {
  const resolved = records.filter(r => r.status === 'Resolvida');
  const durations = resolved.filter(r => r.resolvedAt).map(r => (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 86400000);
  return { total: records.length, open: records.length - resolved.length, resolved: resolved.length,
    rate: records.length ? Math.round(resolved.length / records.length * 100) : 0,
    average: durations.length ? (durations.reduce((a,b) => a+b, 0) / durations.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dias' : '—',
  };
}
export function categoryCounts(records: Occurrence[]) { return categories.map(category => ({ label: category, count: records.filter(r => r.category === category).length })); }
export function regionCounts(records: Occurrence[]) { return regions.map(region => ({ label: region, count: records.filter(r => r.region === region).length })); }
export function signals(records: Occurrence[]) {
  const open = records.filter(r => r.status !== 'Resolvida');
  const groups = regions.flatMap(region => categories.map(category => ({ region, category, count: open.filter(r => r.region === region && r.category === category).length })));
  return groups.filter(g => g.count >= 3).sort((a,b) => b.count - a.count).map(g => ({
    ...g, title: `${g.category} concentrada em ${g.region}`,
    description: `${g.count} chamados em aberto da mesma categoria nesta região. Considere uma vistoria conjunta.`,
    severity: g.count >= 6 ? 'Crítico' : 'Atenção',
  }));
}
export function exportCsv(records: Occurrence[]) {
  const escape = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const rows = [['Protocolo', 'Título', 'Categoria', 'Região', 'Status', 'Prioridade', 'Equipe', 'Data'],
    ...records.map(r => [r.protocol, r.title, r.category, r.region, r.status, r.priority, r.team || '', r.createdAt])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'observamarilia-ocorrencias.csv'; a.click(); URL.revokeObjectURL(url);
}
