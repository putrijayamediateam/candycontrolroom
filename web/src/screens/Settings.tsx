import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { useSession, type User } from '../session';
import { Badge, Card, ErrorNote, Field, PageHeader } from '../ui';

export function Settings() {
  const { t } = useTranslation();
  const { user, setUser, isOwner } = useSession();
  const [ui, setUi] = useState(user.interface_locale);
  const [content, setContent] = useState(user.content_locale);
  const [saved, setSaved] = useState(false);
  const lang = useAction();
  const ov = useApi<any>('/api/overview');
  const pause = useAction();

  const saveLang = async () => {
    setSaved(false);
    const r = await lang.run(() => api<{ user: User }>('/api/me/preferences', { method: 'PATCH', body: { interfaceLocale: ui, contentLocale: content } }));
    if (r) { setUser(r.user); setSaved(true); }
  };
  const paused = ov.data?.publishing_paused === true;

  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className="grid-2">
        <Card title={t('settings.languageTitle')}>
          <fieldset className="choice">
            <legend>{t('settings.interfaceLanguage')}</legend>
            <p className="field-hint">{t('settings.interfaceLanguageHint')}</p>
            <label><input type="radio" checked={ui === 'en'} onChange={() => setUi('en')} /> English</label>
            <label><input type="radio" checked={ui === 'ms'} onChange={() => setUi('ms')} /> Bahasa Melayu</label>
          </fieldset>
          <fieldset className="choice">
            <legend>{t('settings.contentLanguage')}</legend>
            <p className="field-hint">{t('settings.contentLanguageHint')}</p>
            <label><input type="radio" checked={content === 'en'} onChange={() => setContent('en')} /> English</label>
            <label><input type="radio" checked={content === 'ms'} onChange={() => setContent('ms')} /> Bahasa Melayu</label>
          </fieldset>
          <p className="field-hint">{t('settings.languageSafety')}</p>
          <ErrorNote error={lang.error} />
          <div className="row gap">{saved && <Badge tone="ok">{t('common.saved')}</Badge>}<button className="btn btn-primary" onClick={saveLang} disabled={lang.busy}>{t('common.save')}</button></div>
        </Card>

        {isOwner && (
          <Card title={t('settings.publishingTitle')}>
            <p>{paused ? <Badge tone="bad">{t('publishing.pausedBadge')}</Badge> : <Badge tone="ok">{t('settings.publishingOn')}</Badge>}</p>
            <p className="muted small">{t('settings.publishingExplain')}</p>
            <ErrorNote error={pause.error} />
            <button className={`btn ${paused ? 'btn-primary' : 'btn-dark'}`} disabled={pause.busy || !ov.data}
              onClick={() => pause.run(() => api('/api/publishing/pause', { method: 'POST', body: { paused: !paused } }))}>
              {paused ? t('settings.resumePublishing') : t('settings.pausePublishing')}
            </button>
          </Card>
        )}

        <PasswordCard />

        <Card title={t('settings.accountTitle')}>
          <dl className="kv small">
            <dt>{t('settings.name')}</dt><dd>{user.display_name}</dd>
            <dt>{t('login.email')}</dt><dd>{user.email}</dd>
            <dt>{t('settings.role')}</dt><dd>{t(`role.${user.role}`)}</dd>
            <dt>{t('settings.timezone')}</dt><dd>Asia/Kuala_Lumpur (MYT, UTC+8)</dd>
            <dt>{t('settings.appMode')}</dt><dd>{ov.data ? t(`appMode.${ov.data.app_mode}`, { defaultValue: ov.data.app_mode }) : '—'}</dd>
          </dl>
          <p className="muted small">{t('settings.demoNote')}</p>
        </Card>
      </div>
    </>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [done, setDone] = useState(false);
  const a = useAction();
  const save = async () => {
    setDone(false);
    const r = await a.run(() => api('/api/me/password', { method: 'POST', body: { current, next } }));
    if (r) { setDone(true); setCurrent(''); setNext(''); }
  };
  return (
    <Card title={t('settings.passwordTitle')}>
      <Field label={t('settings.currentPassword')}><input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label={t('settings.newPassword')} hint={t('settings.newPasswordHint')}><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} /></Field>
      <ErrorNote error={a.error} />
      <div className="row gap">{done && <Badge tone="ok">{t('settings.passwordChanged')}</Badge>}<button className="btn btn-primary" onClick={save} disabled={a.busy || next.length < 12 || !current}>{t('settings.changePassword')}</button></div>
    </Card>
  );
}
