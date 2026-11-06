import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction } from './api';
import { ErrorNote, Field } from './ui';
import type { User } from './session';

export function Login({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const a = useAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await a.run(() => api<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password } }));
    if (r) onSignedIn(r.user);
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="Klinik Putrijaya" className="login-logo" />
        <h1>CANDY <span className="script">Control Room</span></h1>
        <p className="muted">{t('login.subtitle')}</p>
        <Field label={t('login.email')}>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('login.password')}>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorNote error={a.error} />
        <button className="btn btn-primary btn-block" disabled={a.busy}>{a.busy ? t('common.working') : t('login.signIn')}</button>
        <p className="field-hint">{t('login.passwordHint')}</p>
      </form>
    </main>
  );
}
