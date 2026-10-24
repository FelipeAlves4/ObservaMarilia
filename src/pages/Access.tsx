import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { requireSupabaseConfig, supabase } from '../supabase';
import { ErrorBox } from '../components/ui';

type Mode = 'login'|'signup'|'recovery'|'reset';
export function Access({ requested = '' }: { requested?: string }) {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>(location.search.includes('auth=invite') ? 'reset' : 'login');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); setNotice('');
    try {
      requireSupabaseConfig(); const email = String(form.get('email') || '').trim(); const password = String(form.get('password') || '');
      if (mode === 'login') { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; await refreshProfile(); location.hash = requested || '/meus-relatos'; }
      if (mode === 'signup') { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get('name') || '').trim() }, emailRedirectTo: `${location.origin}/?auth=confirm` } }); if (error) throw error; setNotice('Cadastro criado. Confirme seu e-mail para entrar.'); }
      if (mode === 'recovery') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/?auth=recovery` }); if (error) throw error; setNotice('Enviamos as instruções de redefinição para o seu e-mail.'); }
      if (mode === 'reset') { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setNotice('Senha atualizada. Você já pode entrar.'); setMode('login'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o acesso.'); } finally { setBusy(false); }
  };
  if (session && profile) return <div className="access-page"><h1>Você já está conectado</h1><p>Conta: {profile.name} · {profile.role === 'manager' ? 'Gestor' : profile.role === 'collaborator' ? 'Colaborador' : 'Cidadão'}.</p><div className="header-actions"><a className="btn" href={profile.role === 'manager' ? '#/gestor' : profile.role === 'collaborator' ? '#/colaborador' : '#/meus-relatos'}>Ir para minha área</a><button className="btn btn-light" onClick={() => void signOut()}>Sair</button></div></div>;
  const title = mode === 'signup' ? 'Criar conta cidadã' : mode === 'recovery' ? 'Recuperar senha' : mode === 'reset' ? 'Definir nova senha' : 'Entrar no ObservaMarília';
  return <div className="access-page"><h1>{title}</h1><p>{mode === 'signup' ? 'Cadastre-se para registrar e acompanhar seus relatos.' : 'Use sua conta real do ObservaMarília.'}</p><form className="collaborator-form" onSubmit={submit}>{mode === 'signup' ? <label>Nome completo<input name="name" required minLength={2} maxLength={120}/></label> : null}{mode !== 'reset' ? <label>E-mail<input name="email" type="email" required autoComplete="email"/></label> : null}<label>Senha<input name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label><ErrorBox error={error}/>{notice ? <p className="success-message" role="status">{notice}</p> : null}<button className="btn" disabled={busy}>{busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : mode === 'recovery' ? 'Enviar instruções' : mode === 'reset' ? 'Atualizar senha' : 'Entrar'}</button></form><div className="access-options">{mode === 'login' ? <><button className="text-button" onClick={() => setMode('signup')}>Criar conta de cidadão</button><button className="text-button" onClick={() => setMode('recovery')}>Esqueci minha senha</button></> : <button className="text-button" onClick={() => setMode('login')}>Voltar para entrar</button>}</div><p className="form-info">Gestores e colaboradores usam contas provisionadas pela administração; não há cadastro público para esses papéis.</p></div>;
}
