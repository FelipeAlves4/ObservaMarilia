import type { Collaborator, Occurrence, ReportInput, Status } from './types';
export type Actor = 'gestor-demo' | 'colab-joao' | 'colab-maria' | 'colab-carlos';
async function request<T>(path: string, init?: RequestInit, actor?: Actor): Promise<T> {
  const response = await fetch('/api' + path, { ...init, headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Demo-Actor': actor } : {}), ...init?.headers } });
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
  update: (id: string, data: { status: Status; team: string; note: string }) => request<Occurrence>('/occurrences/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }, 'gestor-demo'),
  collaborators: () => request<Collaborator[]>('/collaborators', undefined, 'gestor-demo'),
  createCollaborator: (data: Omit<Collaborator, 'id' | 'active' | 'createdAt' | 'assignedCount' | 'completedCount' | 'overdueCount'>) => request<Collaborator>('/collaborators', { method:'POST', body:JSON.stringify(data) }, 'gestor-demo'),
  setCollaborator: (id: string, data: { active?: boolean; team?: string }) => request<Collaborator>('/collaborators/'+encodeURIComponent(id), { method:'PATCH', body:JSON.stringify(data) }, 'gestor-demo'),
  assign: (id:string,data:{ team:string; collaboratorIds:string[]; note:string; dueAt?:string }) => request<Occurrence>('/occurrences/'+encodeURIComponent(id)+'/assign',{method:'POST',body:JSON.stringify(data)},'gestor-demo'),
  collaboratorTasks: (actor: Actor = 'colab-joao') => request<Occurrence[]>('/collaborator/tasks', undefined, actor),
  start: (id:string,actor:Actor='colab-joao') => request<Occurrence>('/occurrences/'+encodeURIComponent(id)+'/start',{method:'POST',body:'{}'},actor),
  progress: (id:string,data:{note:string;progress:number;photo:string|null},actor:Actor='colab-joao') => request<Occurrence>('/occurrences/'+encodeURIComponent(id)+'/progress',{method:'POST',body:JSON.stringify(data)},actor),
  conclude: (id:string,data:{note:string;photo:string|null},actor:Actor='colab-joao') => request<Occurrence>('/occurrences/'+encodeURIComponent(id)+'/conclude',{method:'POST',body:JSON.stringify(data)},actor),
  validate: (id:string,data:{decision:'aprovar'|'corrigir';note:string}) => request<Occurrence>('/occurrences/'+encodeURIComponent(id)+'/validate',{method:'POST',body:JSON.stringify(data)},'gestor-demo'),
};
