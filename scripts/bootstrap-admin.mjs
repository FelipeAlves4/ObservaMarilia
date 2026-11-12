import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BOOTSTRAP_ADMIN_EMAIL', 'APP_URL'];
for (const key of required) if (!process.env[key]) throw new Error(`Defina ${key} no ambiente seguro antes de executar o bootstrap.`);
const email = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL deve ser um e-mail válido.');
const appUrl = process.env.APP_URL.replace(/\/$/, '');
let appOrigin;
try { appOrigin = new URL(appUrl).origin; } catch { throw new Error('APP_URL deve ser uma URL completa, como https://observa-marilia.vercel.app.'); }
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: existingAdmins, error: adminsError } = await admin.from('profiles').select('id, full_name').eq('role', 'admin').eq('account_status', 'active');
if (adminsError) throw adminsError;
let user;
for (let page = 1; !user; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find(candidate => candidate.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (existingAdmins.length && !existingAdmins.some(candidate => candidate.id === user?.id)) {
  throw new Error('Já existe um administrador ativo. Este bootstrap não promove outra conta. Use o procedimento administrativo aprovado.');
}
if (!user) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${appOrigin}/?auth=invite#/admin/login` });
  if (error || !data.user) throw error ?? new Error('Não foi possível criar o convite do administrador.');
  user = data.user;
  console.log('Convite do administrador enviado. A pessoa deve definir a própria senha pelo e-mail.');
} else if (process.env.BOOTSTRAP_RESEND_PASSWORD === 'true') {
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin}/?auth=recovery#/admin/login` });
  if (error) throw error;
  console.log('Novo link de definição de senha enviado para o administrador existente.');
}
const fullName = String(user.user_metadata?.full_name || process.env.BOOTSTRAP_ADMIN_NAME || email.split('@')[0]).trim().slice(0, 120);
const { error: profileError } = await admin.from('profiles').upsert({ id: user.id, full_name: fullName, role: 'admin', account_status: 'active' });
if (profileError) throw profileError;
console.log(existingAdmins.length ? 'Administrador já configurado; nenhuma nova promoção foi feita.' : 'Primeiro administrador configurado com sucesso.');
