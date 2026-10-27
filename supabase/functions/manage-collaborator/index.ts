import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type InviteInput = { action: "invite"; name: string; email: string; phone: string; employeeCode: string; team: string; role: string };
type StatusInput = { action: "set-active"; collaboratorId: string; active: boolean };
type Input = InviteInput | StatusInput;

const json = (status: number, body: unknown, origin = "") => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" },
});
const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : "";
};

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") return json(204, {}, origin);
  if (!origin) return json(403, { error: "Origem não autorizada." });
  if (request.method !== "POST") return json(405, { error: "Método não permitido." }, origin);
  const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceRoleKey || !authorization) return json(401, { error: "Sessão inválida." }, origin);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Sessão inválida." }, origin);
  const { data: profile, error: profileError } = await caller.from("profiles").select("role, account_status").eq("id", userData.user.id).single();
  if (profileError || profile?.role !== "manager" || profile.account_status !== "active") return json(403, { error: "Acesso restrito a gestores ativos." }, origin);
  let input: Input;
  try { input = await request.json() as Input; } catch { return json(400, { error: "Corpo da requisição inválido." }, origin); }
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (input.action === "invite") {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.name.trim().length < 3 || input.phone.trim().length < 8 || input.employeeCode.trim().length < 2 || input.role.trim().length < 2) return json(400, { error: "Revise os dados obrigatórios do colaborador." }, origin);
    const { data: team, error: teamError } = await admin.from("teams").select("id").eq("name", input.team).eq("is_active", true).single();
    if (teamError || !team) return json(400, { error: "Equipe indisponível." }, origin);
    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: input.name.trim() }, redirectTo: `${origin}/?auth=invite` });
    if (inviteError || !invitation.user) return json(400, { error: inviteError?.message ?? "Não foi possível enviar o convite." }, origin);
    const userId = invitation.user.id;
    const { error: profileUpdateError } = await admin.from("profiles").upsert({ id: userId, full_name: input.name.trim(), role: "collaborator", account_status: "active" });
    if (profileUpdateError) return json(500, { error: "Convite criado, mas não foi possível preparar o perfil." }, origin);
    const { data: collaborator, error: collaboratorError } = await admin.from("collaborators").insert({ profile_id: userId, full_name: input.name.trim(), email, phone: input.phone.trim(), employee_code: input.employeeCode.trim(), team_id: team.id, job_title: input.role.trim() }).select("id").single();
    if (collaboratorError) return json(400, { error: collaboratorError.message }, origin);
    return json(201, { collaboratorId: collaborator.id }, origin);
  }
  if (input.action === "set-active") {
    const { data: collaborator, error } = await admin.from("collaborators").select("id, profile_id").eq("id", input.collaboratorId).single();
    if (error || !collaborator) return json(404, { error: "Colaborador não encontrado." }, origin);
    const { error: updateError } = await admin.from("collaborators").update({ is_active: input.active }).eq("id", collaborator.id);
    if (updateError) return json(500, { error: updateError.message }, origin);
    await admin.from("profiles").update({ account_status: input.active ? "active" : "suspended" }).eq("id", collaborator.profile_id);
    const { error: authError } = await admin.auth.admin.updateUserById(collaborator.profile_id, { ban_duration: input.active ? "none" : "876000h" });
    if (authError) return json(500, { error: "Situação atualizada, mas a sessão não pôde ser revogada." }, origin);
    return json(200, { ok: true }, origin);
  }
  return json(400, { error: "Ação inválida." }, origin);
});
