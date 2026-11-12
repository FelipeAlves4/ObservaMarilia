import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type DepartmentInput = { name: string; acronym: string; description: string; email: string; phone: string; active?: boolean };
type Input =
  | { action: "create-department"; department: DepartmentInput }
  | { action: "update-department"; departmentId: string; department: DepartmentInput }
  | { action: "set-department-active"; departmentId: string; active: boolean }
  | { action: "invite-manager"; name: string; email: string; departmentId: string; jobTitle: string }
  | { action: "set-manager-active"; managerId: string; active: boolean };

const response = (status: number, body: unknown, origin = "") => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin",
} });
const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(value => value.trim()).includes(origin) ? origin : "";
};
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") return response(204, {}, origin);
  if (!origin) return response(403, { error: "Origem não autorizada." });
  if (request.method !== "POST") return response(405, { error: "Método não permitido." }, origin);
  const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceRoleKey || !authorization) return response(401, { error: "Sessão inválida." }, origin);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return response(401, { error: "Sessão inválida." }, origin);
  const { data: profile } = await caller.from("profiles").select("role, account_status").eq("id", userData.user.id).single();
  if (profile?.role !== "admin" || profile.account_status !== "active") return response(403, { error: "Acesso restrito a administradores ativos." }, origin);
  let input: Input;
  try { input = await request.json() as Input; } catch { return response(400, { error: "Corpo da requisição inválido." }, origin); }
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const audit = async (action: string, entityType: string, entityId: string | null, detail: Record<string, unknown>) =>
    await admin.from("admin_audit_log").insert({ actor_id: userData.user.id, action, entity_type: entityType, entity_id: entityId, detail });
  const parseDepartment = (department: DepartmentInput) => ({
    name: department.name.trim(), acronym: department.acronym.trim().toUpperCase(), description: department.description.trim(),
    institutional_email: department.email.trim().toLowerCase(), phone: department.phone.trim(), is_active: department.active ?? true,
  });
  const checkDepartment = (department: ReturnType<typeof parseDepartment>) =>
    department.name.length >= 3 && department.name.length <= 140 && /^[A-Z0-9.-]{2,16}$/.test(department.acronym) && department.description.length <= 700 && validEmail(department.institutional_email) && department.phone.length >= 8;

  if (input.action === "create-department" || input.action === "update-department") {
    const department = parseDepartment(input.department);
    if (!checkDepartment(department)) return response(400, { error: "Revise os dados da secretaria." }, origin);
    const query = input.action === "create-department"
      ? admin.from("departments").insert(department).select("id").single()
      : validId(input.departmentId) ? admin.from("departments").update(department).eq("id", input.departmentId).select("id").single() : null;
    if (!query) return response(400, { error: "Secretaria inválida." }, origin);
    const { data, error } = await query;
    if (error || !data) return response(400, { error: "Não foi possível salvar a secretaria. Verifique nome e sigla." }, origin);
    await audit(input.action === "create-department" ? "department_created" : "department_updated", "department", data.id, { name: department.name, acronym: department.acronym });
    return response(input.action === "create-department" ? 201 : 200, { id: data.id }, origin);
  }
  if (input.action === "set-department-active") {
    if (!validId(input.departmentId)) return response(400, { error: "Secretaria inválida." }, origin);
    const { data, error } = await admin.from("departments").update({ is_active: input.active }).eq("id", input.departmentId).select("id, name").single();
    if (error || !data) return response(404, { error: "Secretaria não encontrada." }, origin);
    await audit("department_status_changed", "department", data.id, { active: input.active, name: data.name });
    return response(200, { ok: true }, origin);
  }
  if (input.action === "invite-manager") {
    const email = input.email.trim().toLowerCase(), name = input.name.trim(), jobTitle = input.jobTitle.trim();
    if (!validEmail(email) || name.length < 3 || name.length > 120 || jobTitle.length < 2 || jobTitle.length > 120 || !validId(input.departmentId)) return response(400, { error: "Revise os dados do gestor." }, origin);
    const { data: department } = await admin.from("departments").select("id, is_active").eq("id", input.departmentId).single();
    if (!department?.is_active) return response(400, { error: "Selecione uma secretaria ativa." }, origin);
    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${origin}/?auth=invite#/acesso?tipo=gestor` });
    if (inviteError || !invitation.user) return response(400, { error: "Não foi possível enviar o convite. Talvez o e-mail já esteja em uso." }, origin);
    const userId = invitation.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({ id: userId, full_name: name, role: "manager", account_status: "active" });
    if (profileError) return response(500, { error: "Convite criado, mas o perfil não pôde ser preparado." }, origin);
    const { error: managerError } = await admin.from("manager_profiles").upsert({ profile_id: userId, department_id: input.departmentId, job_title: jobTitle, is_active: true });
    if (managerError) return response(500, { error: "Convite criado, mas o vínculo à secretaria não pôde ser preparado." }, origin);
    await audit("manager_invited", "manager", userId, { email, departmentId: input.departmentId, jobTitle });
    return response(201, { id: userId }, origin);
  }
  if (input.action === "set-manager-active") {
    if (!validId(input.managerId)) return response(400, { error: "Gestor inválido." }, origin);
    const { error } = await admin.from("manager_profiles").update({ is_active: input.active }).eq("profile_id", input.managerId);
    if (error) return response(404, { error: "Gestor não encontrado." }, origin);
    await admin.from("profiles").update({ account_status: input.active ? "active" : "suspended" }).eq("id", input.managerId);
    const { error: authError } = await admin.auth.admin.updateUserById(input.managerId, { ban_duration: input.active ? "none" : "876000h" });
    if (authError) return response(500, { error: "Situação atualizada, mas a sessão não pôde ser revogada." }, origin);
    await audit("manager_status_changed", "manager", input.managerId, { active: input.active });
    return response(200, { ok: true }, origin);
  }
  return response(400, { error: "Ação inválida." }, origin);
});
