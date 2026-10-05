import type { Occurrence, ReportInput, Status } from './types';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('A API não está disponível. Inicie o projeto com npm run dev.'); }
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data as T;
}
export const api = {
  list: (mine = false) => request<Occurrence[]>('/occurrences' + (mine ? '?mine=1' : '')),
  detail: (id: string) => request<Occurrence>('/occurrences/' + encodeURIComponent(id)),
  create: (data: ReportInput) => request<Occurrence>('/occurrences', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { status: Status; team: string; note: string }) => request<Occurrence>('/occurrences/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }),
};
