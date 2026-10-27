import { useState, type ChangeEvent, type ReactNode } from 'react';
import { asset } from './ui';

type AuthLayoutProps = { children: ReactNode };

export function AuthLayout({ children }: AuthLayoutProps) {
  return <main className="auth-shell">
    <aside className="auth-aside" aria-label="Sobre o ObservaMarília">
      <a className="auth-brand" href="#/" aria-label="ObservaMarília, página inicial">
        <span className="auth-brand-mark"><img src={asset('23-2', 'imgLogoOficialObservaMarilia')} alt="" /></span>
        <span><strong>ObservaMarília</strong><small>Inteligência Urbana</small></span>
      </a>
      <div className="auth-aside-copy">
        <span className="auth-eyebrow">Participação que transforma</span>
        <h1>A cidade melhora quando cada ocorrência é vista.</h1>
        <p>Relate, acompanhe e participe de decisões mais claras para Marília.</p>
      </div>
      <div className="auth-city-signal" aria-hidden="true">
        <span /><span /><span /><span /><i /><i /><i />
      </div>
      <p className="auth-aside-foot"><span />Dados organizados para uma cidade mais atenta.</p>
    </aside>
    <section className="auth-main">{children}</section>
  </main>;
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="auth-card">{children}</div>;
}

type AuthInputProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function AuthInput({ id, label, error, hint, className = '', ...props }: AuthInputProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <div className={`auth-field ${error ? 'auth-field-invalid' : ''} ${className}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
    {error ? <p id={`${id}-error`} className="auth-field-error">{error}</p> : hint ? <p id={`${id}-hint`} className="auth-field-hint">{hint}</p> : null}
  </div>;
}

type PasswordInputProps = Omit<AuthInputProps, 'type'>;

export function PasswordInput({ id, label, error, hint, className = '', onChange, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => onChange?.(event);
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <div className={`auth-field ${error ? 'auth-field-invalid' : ''} ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="auth-password-control">
      <input id={id} type={visible ? 'text' : 'password'} aria-invalid={Boolean(error)} aria-describedby={descriptionId} onChange={onInputChange} {...props} />
      <button type="button" className="auth-password-toggle" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
    {error ? <p id={`${id}-error`} className="auth-field-error">{error}</p> : hint ? <p id={`${id}-hint`} className="auth-field-hint">{hint}</p> : null}
  </div>;
}

export function AuthFeedback({ tone, children }: { tone: 'error'|'success'|'info'; children: ReactNode }) {
  const role = tone === 'error' ? 'alert' : 'status';
  return <div className={`auth-feedback auth-feedback-${tone}`} role={role} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
    <span aria-hidden="true">{tone === 'error' ? '!' : tone === 'success' ? '✓' : 'i'}</span><p>{children}</p>
  </div>;
}
