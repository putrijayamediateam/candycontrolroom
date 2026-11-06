import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction } from './api';
import { applyInterfaceLocale } from './i18n';
import { useSession, type User } from './session';
import { ErrorNote, EvidenceBadge } from './ui';

/** First-run setup. English is preselected for both settings; Malay only if AIN picks it. */
export function Onboarding() {
  const { t } = useTranslation();
  const { user, setUser } = useSession();
  const [step, setStep] = useState(1);
  const [ui, setUi] = useState<'en' | 'ms'>('en');
  const [content, setContent] = useState<'en' | 'ms'>('en');
  const a = useAction();

  const saveLanguage = async () => {
    const r = await a.run(() => api<{ user: User }>('/api/me/preferences', { method: 'PATCH', body: { interfaceLocale: ui, contentLocale: content } }));
    if (r) { applyInterfaceLocale(r.user.interface_locale); setUser(r.user); setStep(2); }
  };
  const finish = async () => {
    const r = await a.run(() => api<{ user: User }>('/api/me/preferences', { method: 'PATCH', body: { onboardingDone: true } }));
    if (r) setUser(r.user);
  };

  return (
    <main className="login">
      <div className="login-card onboarding">
        <img src="/logo.png" alt="Klinik Putrijaya" className="login-logo" />
        <p className="muted">{t('onboarding.step', { n: step, total: 2 })}</p>
        {step === 1 && (
          <>
            <h1>{t('onboarding.welcome', { name: user.display_name })}</h1>
            <p>{t('onboarding.languageIntro')}</p>
            <fieldset className="choice">
              <legend>{t('settings.interfaceLanguage')}</legend>
              <p className="field-hint">{t('settings.interfaceLanguageHint')}</p>
              <label><input type="radio" name="ui" checked={ui === 'en'} onChange={() => setUi('en')} /> English</label>
              <label><input type="radio" name="ui" checked={ui === 'ms'} onChange={() => setUi('ms')} /> Bahasa Melayu</label>
            </fieldset>
            <fieldset className="choice">
              <legend>{t('settings.contentLanguage')}</legend>
              <p className="field-hint">{t('settings.contentLanguageHint')}</p>
              <label><input type="radio" name="content" checked={content === 'en'} onChange={() => setContent('en')} /> English</label>
              <label><input type="radio" name="content" checked={content === 'ms'} onChange={() => setContent('ms')} /> Bahasa Melayu</label>
            </fieldset>
            <p className="field-hint">{t('settings.languageSafety')}</p>
            <ErrorNote error={a.error} />
            <button className="btn btn-primary btn-block" onClick={saveLanguage} disabled={a.busy}>{t('common.continue')}</button>
          </>
        )}
        {step === 2 && (
          <>
            <h1>{t('onboarding.honestTitle')}</h1>
            <ul className="plain-list">
              <li><EvidenceBadge kind="not_connected" /> {t('onboarding.honestIntegrations')}</li>
              <li><EvidenceBadge kind="not_connected" /> {t('onboarding.honestExecution')}</li>
              <li><EvidenceBadge kind="verified" /> {t('onboarding.honestWorks')}</li>
            </ul>
            <p>{t('onboarding.nextSteps')}</p>
            <ErrorNote error={a.error} />
            <button className="btn btn-primary btn-block" onClick={finish} disabled={a.busy}>{t('onboarding.openControlRoom')}</button>
          </>
        )}
      </div>
    </main>
  );
}
