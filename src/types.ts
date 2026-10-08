export const categories = ['Pavimentação', 'Iluminação', 'Lixo e limpeza', 'Árvores', 'Outros'] as const;
export const regions = ['Zona Norte', 'Centro', 'Zona Leste', 'Zona Sul', 'Zona Oeste'] as const;
export const statuses = ['Nova', 'Em análise', 'Programada', 'Em execução', 'Aguardando validação', 'Resolvida'] as const;
export const teams = ['Equipe Norte 02', 'Equipe Centro 01', 'Equipe Luz 03', 'Equipe Limpeza 04', 'Equipe Verde 01'] as const;
export type Category = typeof categories[number];
export type Region = typeof regions[number];
export type Status = typeof statuses[number];
export type Priority = 'Alta' | 'Média' | 'Baixa';
export interface HistoryEvent { title: string; note: string; createdAt: string; action?: string; fromStatus?: Status | null; toStatus?: Status | null; actorName?: string; actorRole?: string; attachmentRef?: string | null }
export interface Collaborator {
  id: string; name: string; email: string; phone: string; employeeCode: string; team: string;
  role: string; active: boolean; createdAt: string; assignedCount?: number; completedCount?: number; overdueCount?: number;
}
export interface ExecutionUpdate { id: number; kind: 'andamento' | 'conclusao'; note: string; progress: number | null; photo: string | null; createdAt: string; collaboratorName: string }
export interface Occurrence {
  id: string; protocol: string; title: string; category: Category; region: Region;
  address: string; neighborhood: string; description: string; priority: Priority;
  status: Status; team: string | null; reason: string; createdAt: string;
  resolvedAt: string | null; dueAt?: string | null; assignedAt?: string | null; assignees?: Pick<Collaborator, 'id' | 'name' | 'team' | 'role'>[];
  executionUpdates?: ExecutionUpdate[]; photo?: string | null; hasPhoto?: boolean; history: HistoryEvent[];
}
export interface ReportInput {
  title: string; category: Category; region: Region; address: string;
  neighborhood: string; description: string; photo: string | null;
}
export const nextStatus: Partial<Record<Status, Status>> = { 'Nova': 'Em análise', 'Em análise': 'Programada', 'Programada': 'Em execução', 'Em execução': 'Aguardando validação', 'Aguardando validação': 'Resolvida' };
export const categoryColors: Record<Category, string> = { 'Pavimentação': '#2563eb', 'Iluminação': '#7c3aed', 'Lixo e limpeza': '#10b981', 'Árvores': '#f59e0b', 'Outros': '#94a3b8' };
