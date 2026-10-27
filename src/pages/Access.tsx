import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { AppRole, Profile } from '../auth';
import { useAuth } from '../auth';
import { AuthCard, AuthFeedback, AuthInput, AuthLayout, PasswordInput } from '../components/AuthUi';
import { requireSupabaseConfig, supabase } from '../supabase';

type Mode = 'login' | 'signup' | 'recovery' | 'reset';
type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

const COPY: Record<Mode, { eyebrow: string; title: string; description: string; action: string }> = {
  login: { eyebrow: 'Acessar conta', title: 'Bem-vindo de volta', description: 'Entre na sua conta para acompanhar ocorrências e participar da transformação da cidade.', action: 'Entrar na plataforma' },
  signup: { eyebrow: 'Conta cidadã', title: 'Faça parte da mudança', description: 'Crie sua conta para relatar problemas e acompanhar melhorias na cidade.', action: 'Criar minha conta' },
  recovery: { eyebrow: 'Recuperar acesso', title: 'Recuperar acesso', description: 'Informe seu e-mail e enviaremos instruções para redefinir sua senha.', action: 'Enviar instruções' },
  reset: { eyebrow: 'Nova senha', title: 'Crie uma nova senha', description: 'Escolha uma senha segura para voltar a acessar sua conta.', action: 'Salvar nova senha' },
};

function getUrlMode(): Mode {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const type = params.get('type');
  if (auth === 'recovery' || auth === 'invite' || type === 'recovery' || type === 'invite') return 'reset';
  return 'login';
}

function passwordIssue(password: string) {
  return password.length < 8 ? 'Use pelo menos 8 caracteres.' : '';
}

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

function roleHome(role: AppRole) {
  if (role === 'manager') return '/gestor';
  if (role === 'collaborator') return '/colaborador';
  return '/meus-relatos';
}

function allowedDestination(role: AppRole, requested: string) {
  const route = requested.split('?')[0];
  if (role === 'citizen') return route === '/relatar' || route === '/meus-relatos';
  if (role === 'manager') return route === '/gestor' || route.startsWith('/gestor/');
  return route === '/colaborador';
}

function destination(profile: Profile | null, requested: string) {
  if (!profile) return '/meus-relatos';
  return requested && allowedDestination(profile.role, requested) ? requested : roleHome(profile.role);
}

function displayRole(role: AppRole) {
  return role === 'manager' ? 'Gestor' : role === 'collaborator' ? 'Colaborador' : 'Cidadão';
}

function PasswordRequirements() {
  return <p className="auth-password-requirement"><span aria-hidden="true">•</span> Use pelo menos 8 caracteres. Evite dados fáceis de adivinhar.</p>;
}

export function Access({ requested = '' }: { requested?: string }) {
  const { session, profile, authEvent, signOut, refreshProfile } = useAuth();
  const initialMode = useMemo(getUrlMode, []);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get('auth') === 'confirm' ? 'E-mail confirmado. Agora você já pode entrar.' : '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') {
      setMode('reset');
      setError('');
      setNotice('Defina uma nova senha para concluir a recuperação da sua conta.');
    }
  }, [authEvent]);

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setFieldErrors({});
  };

  const clearFieldError = (field: FieldName) => (_event: ChangeEvent<HTMLInputElement>) => {
    setFieldErrors(current => current[field] ? { ...current, [field]: undefined } : current);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const name = String(form.get('name') || '').trim();
    const validation: FieldErrors = {};
    if (mode === 'signup' && name.length < 2) validation.name = 'Informe seu nome completo.';
    if (mode !== 'reset' && !email) validation.email = 'Informe um e-mail válido.';
    if (mode === 'signup' || mode === 'reset') {
      const issue = passwordIssue(password);
      if (issue) validation.password = issue;
      if (password !== confirmPassword) validation.confirmPassword = 'As senhas precisam ser iguais.';
    }
    if (mode === 'login' && !password) validation.password = 'Informe sua senha.';
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      setError('Revise os campos destacados para continuar.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      requireSupabaseConfig();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const nextProfile = await refreshProfile();
        if (!nextProfile) throw new Error('profile-unavailable');
        window.location.hash = destination(nextProfile, requested);
        return;
      }
      if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/?auth=confirm#/acesso` },
        });
        if (authError) throw authError;
        setNotice('Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.');
        return;
      }
      if (mode === 'recovery') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?auth=recovery#/acesso` });
        if (authError) throw authError;
        setNotice('Se houver uma conta para este e-mail, enviaremos as instruções de redefinição em instantes.');
        return;
      }
      if (!session) {
        setError('Abra novamente o link de recuperação enviado por e-mail para criar uma nova senha.');
        return;
      }
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setNotice('Senha atualizada com sucesso. Sua conta já está pronta para continuar.');
      setMode('login');
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'profile-unavailable') setError('A conta foi autenticada, mas não possui acesso ativo ao ObservaMarília. Fale com a administração.');
      else setError(friendlyAuthError(reason, mode));
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];
  const isResetLinkWithoutSession = mode === 'reset' && !session;

  if (session && profile && mode !== 'reset') {
    return <AuthLayout><AuthCard>
      {notice ? <AuthFeedback tone="success">{notice}</AuthFeedback> : null}
      <span className="auth-eyebrow">Conta conectada</span>
      <h2 className="auth-title">Olá, {profile.name.split(' ')[0]}.</h2>
      <p className="auth-description">Você está conectado como {displayRole(profile.role)}.</p>
      <div className="auth-actions">
        <a className="auth-primary-action" href={`#${destination(profile, requested)}`}>Ir para minha área</a>
        <button type="button" className="auth-secondary-action" onClick={() => void signOut()}>Sair da conta</button>
      </div>
    </AuthCard></AuthLayout>;
  }

  return <AuthLayout><AuthCard>
    <a className="auth-back-home" href="#/">← Voltar à página inicial</a>
    <span className="auth-eyebrow">{copy.eyebrow}</span>
    <h2 className="auth-title">{copy.title}</h2>
    <p className="auth-description">{copy.description}</p>
    {isResetLinkWithoutSession ? <>
      <AuthFeedback tone="info">Para criar uma nova senha, abra o link mais recente enviado para seu e-mail.</AuthFeedback>
      <button type="button" className="auth-link-button" onClick={() => changeMode('recovery')}>Solicitar novas instruções</button>
    </> : <form className="auth-form" noValidate onSubmit={submit}>
      {mode === 'signup' ? <AuthInput id="auth-name" name="name" label="Nome completo" autoComplete="name" required minLength={2} maxLength={120} error={fieldErrors.name} onChange={clearFieldError('name')} /> : null}
      {mode !== 'reset' ? <AuthInput id="auth-email" name="email" label="E-mail" type="email" inputMode="email" autoComplete="email" required error={fieldErrors.email} onChange={clearFieldError('email')} /> : null}
      {mode !== 'recovery' ? <>
        <PasswordInput id="auth-password" name="password" label={mode === 'login' ? 'Senha' : 'Nova senha'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? undefined : 8} error={fieldErrors.password} onChange={clearFieldError('password')} />
        {(mode === 'signup' || mode === 'reset') ? <>
          <PasswordRequirements />
          <PasswordInput id="auth-confirm-password" name="confirmPassword" label="Confirmar nova senha" autoComplete="new-password" required minLength={8} error={fieldErrors.confirmPassword} onChange={clearFieldError('confirmPassword')} />
        </> : null}
      </> : null}
      {error ? <AuthFeedback tone="error">{error}</AuthFeedback> : null}
      {notice ? <AuthFeedback tone="success">{notice}</AuthFeedback> : null}
      <button className="auth-primary-action" disabled={busy} aria-busy={busy}>{busy ? 'Aguarde…' : copy.action}</button>
    </form>}
    {mode === 'login' ? <div className="auth-login-options">
      <button type="button" className="auth-link-button" onClick={() => changeMode('recovery')}>Esqueceu sua senha?</button>
      <p>Ainda não tem uma conta? <button type="button" className="auth-inline-link" onClick={() => changeMode('signup')}>Cadastre-se</button></p>
    </div> : mode !== 'reset' ? <p className="auth-switch-copy">Já tem uma conta? <button type="button" className="auth-inline-link" onClick={() => changeMode('login')}>Entrar</button></p> : null}
    {mode === 'signup' ? <p className="auth-role-note">O cadastro público é exclusivo para cidadãos. Gestores e colaboradores recebem acesso pela administração.</p> : null}
  </AuthCard></AuthLayout>;
}
