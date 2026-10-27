import { requireSupabaseConfig, supabase } from './supabase';
import type { Collaborator, ExecutionUpdate, Occurrence, ReportInput } from './types';

type RawOccurrence = Omit<Occurrence, 'photo'> & { photoPath?: string|null; executionUpdates?: Array<ExecutionUpdate & { photoPath?: string|null }> };
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
async function rpc<T>(name: string, params?: Record<string, unknown>) {
  requireSupabaseConfig();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}
async function signedUrl(path?: string|null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('occurrence-media').createSignedUrl(path, 60 * 30);
  return error ? null : data.signedUrl;
}
async function normalize(raw: RawOccurrence, includeMedia = false): Promise<Occurrence> {
  const executionUpdates = includeMedia && raw.executionUpdates ? await Promise.all(raw.executionUpdates.map(async update => ({ ...update, photo: await signedUrl(update.photoPath) }))) : raw.executionUpdates;
  return { ...raw, photo: includeMedia ? await signedUrl(raw.photoPath) : null, executionUpdates } as Occurrence;
}
async function uploadMedia(file: File, folder: 'occurrences'|'evidence') {
  if (!['image/jpeg','image/png'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Envie uma imagem JPG ou PNG de até 2 MB.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Entre em sua conta para enviar uma imagem.');
  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${folder}/${userData.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('occurrence-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return { path, mimeType: file.type, byteSize: file.size };
}
async function invokeManager(payload: Record<string, unknown>) {
  requireSupabaseConfig();
  const { data, error } = await supabase.functions.invoke('manage-collaborator', { body: payload });
  if (error) throw new Error(message(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export const api = {
  async list(scope: 'public'|'mine'|'assigned'|'all' = 'public') { return Promise.all((await rpc<RawOccurrence[]>('list_occurrences', { p_scope: scope })).map(record => normalize(record))); },
  async detail(id: string) { return normalize(await rpc<RawOccurrence>('get_occurrence', { p_occurrence_id: id }), true); },
  async create(input: ReportInput) {
    const media = input.photo ? await uploadMedia(input.photo, 'occurrences') : null;
    try { return normalize(await rpc<RawOccurrence>('create_occurrence', {
      p_title: input.title, p_category: input.category, p_region: input.region, p_address: input.address,
      p_neighborhood: input.neighborhood, p_description: input.description, p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null, p_media_path: media?.path ?? null, p_media_mime_type: media?.mimeType ?? null, p_media_byte_size: media?.byteSize ?? null,
    }), true); }
    catch (error) { if (media) await supabase.storage.from('occurrence-media').remove([media.path]); throw error; }
  },
  async triage(id: string, note: string) { return normalize(await rpc<RawOccurrence>('advance_occurrence_to_analysis', { p_occurrence_id: id, p_note: note }), true); },
  async assign(id: string, data: { team: string; collaboratorIds: string[]; note: string; dueAt?: string }) { return normalize(await rpc<RawOccurrence>('assign_occurrence', { p_occurrence_id: id, p_team_name: data.team, p_collaborator_ids: data.collaboratorIds, p_note: data.note, p_due_at: data.dueAt || null }), true); },
  async collaborators() { return rpc<Collaborator[]>('list_collaborators'); },
  async createCollaborator(data: Omit<Collaborator, 'id'|'active'|'createdAt'|'assignedCount'|'completedCount'|'overdueCount'>) { return invokeManager({ action: 'invite', ...data }); },
  async setCollaborator(id: string, active: boolean) { return invokeManager({ action: 'set-active', collaboratorId: id, active }); },
  async collaboratorTasks() { return Promise.all((await rpc<RawOccurrence[]>('list_occurrences', { p_scope: 'assigned' })).map(record => normalize(record))); },
  async start(id: string) { return normalize(await rpc<RawOccurrence>('start_occurrence', { p_occurrence_id: id }), true); },
  async progress(id: string, data: { note: string; progress: number; photo: File|null }) {
    const media = data.photo ? await uploadMedia(data.photo, 'evidence') : null;
    return normalize(await rpc<RawOccurrence>('record_execution_progress', { p_occurrence_id: id, p_note: data.note, p_progress: data.progress, p_media_path: media?.path ?? null, p_media_mime_type: media?.mimeType ?? null, p_media_byte_size: media?.byteSize ?? null }), true);
  },
  async conclude(id: string, data: { note: string; photo: File|null }) {
    const media = data.photo ? await uploadMedia(data.photo, 'evidence') : null;
    return normalize(await rpc<RawOccurrence>('conclude_occurrence', { p_occurrence_id: id, p_note: data.note, p_media_path: media?.path ?? null, p_media_mime_type: media?.mimeType ?? null, p_media_byte_size: media?.byteSize ?? null }), true);
  },
  async validate(id: string, data: { decision: 'aprovar'|'corrigir'; note: string }) { return normalize(await rpc<RawOccurrence>('validate_occurrence', { p_occurrence_id: id, p_decision: data.decision === 'aprovar' ? 'approve' : 'correct', p_note: data.note }), true); },
};
