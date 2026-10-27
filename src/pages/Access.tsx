import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { AppRole } from '../auth';
import { canAccessProfile, profileAccessIssue, useAuth } from '../auth';
import { hasAreaAccess, safeDestination, type AccessArea } from '../accessPolicy';
import { AuthCard, AuthFeedback, AuthInput, AuthLayout, PasswordInput } from '../components/AuthUi';
import { requireSupabaseConfig, supabase } from '../supabase';

type Mode = 'login' | 'signup' | 'recovery' | 'reset';
type AccessType = AccessArea;
type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

const ACCESS: Record<AccessType, { query: string; role: AppRole; title: string; subtitle: string; action: string; chooserTitle: string; chooserDescription: string }> = {
  citizen: { query: 'cidadao', role: 'citizen', title: 'Acesse sua conta de cidadão', subtitle: 'Acompanhe suas solicitações e participe das melhorias de Marília.', action: 'Entrar', chooserTitle: 'Cidadão', chooserDescription: 'Registre problemas da cidade, acompanhe suas solicitações e participe das melhorias de Marília.' },
  manager: { query: 'gestor', role: 'manager', title: 'Acesso à gestão municipal', subtitle: 'Entre com suas credenciais administrativas.', action: 'Entrar no painel', chooserTitle: 'Gestor', chooserDescription: 'Gerencie ocorrências, acompanhe indicadores e coordene as equipes responsáveis pelos atendimentos.' },
  collaborator: { query: 'colaborador', role: 'collaborator', title: 'Portal do colaborador', subtitle: 'Acompanhe suas atividades e registre os atendimentos realizados.', action: 'Entrar no portal', chooserTitle: 'Colaborador', chooserDescription: 'Consulte serviços atribuídos, atualize o andamento e registre as atividades executadas.' },
};

function getExternalParams() { return new URLSearchParams(window.location.search); }
function parseAccessType(value: string | null) {
  if (value === 'cidadao' || value === 'citizen') return 'citizen';
  if (value === 'gestor' || value === 'manager') return 'manager';
  if (value === 'colaborador' || value === 'collaborator') return 'collaborator';
  return null;
}
function getUrlMode(): Mode {
  const params = getExternalParams();
  const auth = params.get('auth'); const type = params.get('type');
  if (auth === 'recovery' || auth === 'invite' || type === 'recovery' || type === 'invite') return 'reset';
  return 'login';
}
function passwordIssue(password: string) { return password.length < 8 ? 'Use pelo menos 8 caracteres.' : ''; }
function friendlyAuthError(reason: unknown, action: Mode) {
  const message = reason instanceof Error ? reason.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'E-mail ou senha não conferem. Revise os dados e tente novamente.';
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar na plataforma.';
  if (message.includes('user already registered') || message.includes('already been registered')) return 'Já existe uma conta com este e-mail. Entre ou recupere sua senha.';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.';
  if (message.includes('password should be')) return 'A senha não atende aos requisitos de segurança.';
  if (message.includes('session') || message.includes('jwt')) return action === 'reset' ? 'Este link não é mais válido. Solicite uma nova recuperação de senha.' : 'Sua sessão expirou. Entre novamente para continuar.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Não foi possível conectar agora. Verifique sua internet e tente novamente.';
  if (message.includes('vite_supabase')) return 'A conexão de autenticação ainda não foi configurada neste ambiente.';
  return 'Não foi possível concluir esta ação agora. Tente novamente em instantes.';
}
function displayRole(role: AppRole) { return role === 'manager' ? 'Gestor' : role === 'collaborator' ? 'Colaborador' : 'Cidadão'; }
function PasswordRequirements() { return <p className="auth-password-requirement"><span aria-hidden="true">•</span> Use pelo menos 8 caracteres. Evite dados fáceis de adivinhar.</p>; }

function AccessIcon({ type }: { type: AccessType }) {
  const paths: Record<AccessType, ReactNode> = {
    citizen: <><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 20c.7-4 3-6 5.5-6s4.8 2 5.5 6M14 20c.4-2.5 1.8-4.1 4.3-4.1 1.2 0 2.2.4 3.2 1.4" /></>,
    manager: <><path d="M4 20h16M6 20V9l6-4 6 4v11M9 20v-5h6v5M9 11h.01M15 11h.01" /></>,
    collaborator: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2.5c0-3 3.1-5 7-5s7 2 7 5V21M8 4.5 12 3l4 1.5" /></>,
  };
  return <svg className="auth-choice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

function AccessChooser() {
  return <AuthLayout><section className="auth-choice-panel" aria-labelledby="auth-choice-title">
    <a className="auth-back-home" href="#/">← Voltar à página inicial</a>
    <span className="auth-eyebrow">Escolha sua área</span>
    <h2 id="auth-choice-title" className="auth-title">Bem-vindo ao ObservaMarília</h2>
    <p className="auth-description">Selecione como deseja acessar a plataforma.</p>
    <div className="auth-choice-grid">
      {(Object.keys(ACCESS) as AccessType[]).map(type => <article className="auth-choice-card" key={type}>
        <AccessIcon type={type} />
        <h3>{ACCESS[type].chooserTitle}</h3>
        <p>{ACCESS[type].chooserDescription}</p>
        <a href={`#/acesso?tipo=${ACCESS[type].query}`}>Acessar como {ACCESS[type].chooserTitle.toLowerCase()}</a>
      </article>)}
    </div>
  </section></AuthLayout>;
}

export function Access({ requested = '', accessType: accessTypeValue }: { requested?: string; accessType?: string | null }) {
  const { session, profile, authEvent, signOut, refreshProfile } = useAuth();
  const initialMode = useMemo(getUrlMode, []);
  const externalAccessType = parseAccessType(getExternalParams().get('tipo'));
  const accessType = parseAccessType(accessTypeValue ?? null) || externalAccessType;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => getExternalParams().get('auth') === 'confirm' ? 'E-mail confirmado. Agora você já pode entrar.' : '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') { setMode('reset'); setError(''); setNotice('Defina uma nova senha para concluir a recuperação da sua conta.'); }
  }, [authEvent]);
  useEffect(() => { if (accessType && mode !== 'reset') { setMode('login'); setError(''); setFieldErrors({}); } }, [accessType]);

  const changeMode = (nextMode: Mode) => { setMode(nextMode); setError(''); setNotice(''); setFieldErrors({}); };
  const clearFieldError = (field: FieldName) => (_event: ChangeEvent<HTMLInputElement>) => setFieldErrors(current => current[field] ? { ...current, [field]: undefined } : current);
  const context = accessType ? ACCESS[accessType] : null;
  const redirectQuery = accessType ? `&tipo=${context!.query}` : '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const email = String(form.get('email') || '').trim(); const password = String(form.get('password') || ''); const confirmPassword = String(form.get('confirmPassword') || ''); const name = String(form.get('name') || '').trim();
    const validation: FieldErrors = {};
    if (mode === 'signup' && name.length < 2) validation.name = 'Informe seu nome completo.';
    if (mode !== 'reset' && !email) validation.email = 'Informe um e-mail válido.';
    if (mode === 'signup' || mode === 'reset') { const issue = passwordIssue(password); if (issue) validation.password = issue; if (password !== confirmPassword) validation.confirmPassword = 'As senhas precisam ser iguais.'; }
    if (mode === 'login' && !password) validation.password = 'Informe sua senha.';
    if (Object.keys(validation).length) { setFieldErrors(validation); setError('Revise os campos destacados para continuar.'); return; }
    setBusy(true); setError(''); setNotice(''); setFieldErrors({});
    try {
      requireSupabaseConfig();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const nextProfile = await refreshProfile();
        if (!nextProfile) throw new Error('profile-unavailable');
        const issue = profileAccessIssue(nextProfile);
        if (issue) { setError(issue); return; }
        if (accessType && !hasAreaAccess(nextProfile, accessType)) { setError(`Esta conta é de ${displayRole(nextProfile.role).toLowerCase()} e não pode acessar a área de ${context!.chooserTitle.toLowerCase()}.`); return; }
        window.location.hash = safeDestination(nextProfile, requested); return;
      }
      if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/?auth=confirm&tipo=cidadao#/acesso` } });
        if (authError) throw authError;
        setNotice('Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.'); return;
      }
      if (mode === 'recovery') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?auth=recovery${redirectQuery}#/acesso` });
        if (authError) throw authError;
        setNotice('Se houver uma conta para este e-mail, enviaremos as instruções de redefinição em instantes.'); return;
      }
      if (!session) { setError('Abra novamente o link de recuperação enviado por e-mail para criar uma nova senha.'); return; }
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setNotice('Senha atualizada com sucesso. Sua conta já está pronta para continuar.'); setMode('login');
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'profile-unavailable') setError('A conta foi autenticada, mas não possui acesso ativo ao ObservaMarília. Fale com a administração.');
      else setError(friendlyAuthError(reason, mode));
    } finally { setBusy(false); }
  };

  const isResetLinkWithoutSession = mode === 'reset' && !session;
  const accountIssue = profileAccessIssue(profile);
  const roleMismatch = Boolean(profile && accessType && !hasAreaAccess(profile, accessType));
  if (!accessType && mode === 'login' && !getExternalParams().has('auth')) return <AccessChooser />;

  if (session && !profile && mode !== 'reset') return <AuthLayout><AuthCard><AuthFeedback tone="error">Não encontramos um perfil de acesso para esta conta. Fale com a administração.</AuthFeedback><div className="auth-actions"><button type="button" className="auth-secondary-action" onClick={() => void signOut()}>Sair e usar outra conta</button></div></AuthCard></AuthLayout>;
  if (session && profile && mode !== 'reset') {
    const destinationPath = safeDestination(profile, requested);
    const title = accountIssue ? 'Acesso indisponível' : roleMismatch ? 'Área não autorizada' : `Olá, ${profile.name.split(' ')[0]}.`;
    const message = accountIssue || (roleMismatch ? `Sua conta é de ${displayRole(profile.role).toLowerCase()} e não tem acesso à área de ${context!.chooserTitle.toLowerCase()}.` : `Você está conectado como ${displayRole(profile.role)}.`);
    return <AuthLayout><AuthCard>
      <span className="auth-eyebrow">{accountIssue || roleMismatch ? 'Verificação de acesso' : 'Conta conectada'}</span><h2 className="auth-title">{title}</h2><p className="auth-description">{message}</p>
      {(accountIssue || roleMismatch) ? <AuthFeedback tone="error">{message}</AuthFeedback> : notice ? <AuthFeedback tone="success">{notice}</AuthFeedback> : null}
      <div className="auth-actions">{canAccessProfile(profile) ? <a className="auth-primary-action" href={`#${destinationPath}`}>Abrir minha área</a> : null}<button type="button" className="auth-secondary-action" onClick={() => void signOut()}>Sair e usar outra conta</button></div>
    </AuthCard></AuthLayout>;
  }

  const loginTitle = context?.title || 'Bem-vindo de volta';
  const loginDescription = context?.subtitle || 'Entre na sua conta para acompanhar ocorrências e participar da transformação da cidade.';
  const action = mode === 'signup' ? 'Criar minha conta' : mode === 'recovery' ? 'Enviar instruções' : mode === 'reset' ? 'Salvar nova senha' : context?.action || 'Entrar na plataforma';
  const eyebrow = mode === 'signup' ? 'Conta cidadã' : mode === 'recovery' ? 'Recuperar acesso' : mode === 'reset' ? 'Nova senha' : context ? `Área do ${context.chooserTitle.toLowerCase()}` : 'Acessar conta';
  const title = mode === 'signup' ? 'Faça parte da mudança' : mode === 'recovery' ? 'Recuperar acesso' : mode === 'reset' ? 'Crie uma nova senha' : loginTitle;
  const description = mode === 'signup' ? 'Crie sua conta para relatar problemas e acompanhar melhorias na cidade.' : mode === 'recovery' ? 'Informe seu e-mail e enviaremos instruções para redefinir sua senha.' : mode === 'reset' ? 'Escolha uma senha segura para voltar a acessar sua conta.' : loginDescription;

  return <AuthLayout><AuthCard>
    {accessType ? <a className="auth-back-choice" href="#/acesso">← Voltar para escolher acesso</a> : <a className="auth-back-home" href="#/">← Voltar à página inicial</a>}
    <span className="auth-eyebrow">{eyebrow}</span><h2 className="auth-title">{title}</h2><p className="auth-description">{description}</p>
    {isResetLinkWithoutSession ? <><AuthFeedback tone="info">Para criar uma nova senha, abra o link mais recente enviado para seu e-mail.</AuthFeedback><button type="button" className="auth-link-button" onClick={() => changeMode('recovery')}>Solicitar novas instruções</button></> : <form className="auth-form" noValidate onSubmit={submit}>
      {mode === 'signup' ? <AuthInput id="auth-name" name="name" label="Nome completo" autoComplete="name" required minLength={2} maxLength={120} error={fieldErrors.name} onChange={clearFieldError('name')} /> : null}
      {mode !== 'reset' ? <AuthInput id="auth-email" name="email" label="E-mail" type="email" inputMode="email" autoComplete="email" required error={fieldErrors.email} onChange={clearFieldError('email')} /> : null}
      {mode !== 'recovery' ? <><PasswordInput id="auth-password" name="password" label={mode === 'login' ? 'Senha' : 'Nova senha'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? undefined : 8} error={fieldErrors.password} onChange={clearFieldError('password')} />
        {(mode === 'signup' || mode === 'reset') ? <><PasswordRequirements /><PasswordInput id="auth-confirm-password" name="confirmPassword" label="Confirmar nova senha" autoComplete="new-password" required minLength={8} error={fieldErrors.confirmPassword} onChange={clearFieldError('confirmPassword')} /></> : null}</> : null}
      {error ? <AuthFeedback tone="error">{error}</AuthFeedback> : null}{notice ? <AuthFeedback tone="success">{notice}</AuthFeedback> : null}<button className="auth-primary-action" disabled={busy} aria-busy={busy}>{busy ? 'Aguarde…' : action}</button>
    </form>}
    {mode === 'login' ? <div className="auth-login-options"><button type="button" className="auth-link-button" onClick={() => changeMode('recovery')}>Esqueceu sua senha?</button>{accessType === 'citizen' || !accessType ? <p>Ainda não tem uma conta? <button type="button" className="auth-inline-link" onClick={() => changeMode('signup')}>Cadastre-se</button></p> : null}</div> : mode !== 'reset' ? <p className="auth-switch-copy">Já tem uma conta? <button type="button" className="auth-inline-link" onClick={() => changeMode('login')}>Entrar</button></p> : null}
    {mode === 'signup' ? <p className="auth-role-note">O cadastro público é exclusivo para cidadãos. Gestores e colaboradores recebem acesso pela administração.</p> : null}
  </AuthCard></AuthLayout>;
}
