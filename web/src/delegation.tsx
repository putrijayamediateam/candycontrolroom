import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from './api';
import { fmtDateTime, remaining, shortTarget } from './format';
import { Badge, ErrorNote, Loading, Modal } from './ui';

export const ACTIONS = ['internal_approval', 'schedule', 'publish', 'reply'] as const;
export const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'threads', 'gbp', 'youtube'] as const;
export const CONTENT_TEMPLATES = ['poster', 'carousel', 'short_video', 'text_psa', 'campaign_announcement', 'review_reply'] as const;
const DURATIONS = [30, 60, 120, 240, 480, 1440];
const EXTERNAL = new Set(['schedule', 'publish', 'reply']);

function toggle<T>(list: T[], v: T) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

/**
 * BECOME ME: AIN reviews the full scope and activates it explicitly. Suggested start:
 * internal approval only; external publishing and replies stay off unless she turns them on.
 */
export function BecomeMePanel({ open, onClose, source, onDone }: { open: boolean; onClose: () => void; source: 'button' | 'command_input'; onDone: () => void }) {
  const { t } = useTranslation();
  const [actions, setActions] = useState<string[]>(['internal_approval']);
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram', 'tiktok', 'threads']);
  const [templates, setTemplates] = useState<string[]>(['poster', 'carousel']);
  const [minutes, setMinutes] = useState(120);
  const [includePending, setIncludePending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const a = useAction();

  useEffect(() => { if (open) { setConfirmed(false); a.clear(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async () => {
    const r = await a.run(() => api('/api/delegation/activate', { method: 'POST', body: { scope: { actions, platforms, templates }, minutes, includePending, confirmed: true, source } }));
    if (r) { onDone(); onClose(); }
  };
  const valid = actions.length > 0 && platforms.length > 0 && templates.length > 0;

  return (
    <Modal open={open} onClose={onClose} title={t('delegation.panelTitle')} wide>
      <p>{t('delegation.panelIntro')}</p>
      <div className="grid-2">
        <fieldset className="choice">
          <legend>{t('delegation.allowedActions')}</legend>
          {ACTIONS.map((x) => (
            <label key={x}>
              <input type="checkbox" checked={actions.includes(x)} onChange={() => setActions(toggle(actions, x))} />
              {t(`action.${x}`)} {EXTERNAL.has(x) && <Badge tone="warn">{t('delegation.externalEffect')}</Badge>}
            </label>
          ))}
        </fieldset>
        <fieldset className="choice">
          <legend>{t('delegation.platforms')}</legend>
          {PLATFORMS.map((x) => (
            <label key={x}><input type="checkbox" checked={platforms.includes(x)} onChange={() => setPlatforms(toggle(platforms, x))} /> {t(`platform.${x}`)}</label>
          ))}
        </fieldset>
        <fieldset className="choice">
          <legend>{t('delegation.contentTypes')}</legend>
          {CONTENT_TEMPLATES.map((x) => (
            <label key={x}><input type="checkbox" checked={templates.includes(x)} onChange={() => setTemplates(toggle(templates, x))} /> {t(`template.${x}`)}</label>
          ))}
        </fieldset>
        <fieldset className="choice">
          <legend>{t('delegation.durationAndItems')}</legend>
          <label className="field">
            <span className="field-label">{t('delegation.duration')}</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {DURATIONS.map((m) => <option key={m} value={m}>{m < 60 ? t('delegation.minutes', { n: m }) : t('delegation.hours', { n: m / 60 })}</option>)}
            </select>
          </label>
          <label><input type="radio" checked={!includePending} onChange={() => setIncludePending(false)} /> {t('delegation.newOnly')}</label>
          <label><input type="radio" checked={includePending} onChange={() => setIncludePending(true)} /> {t('delegation.includePending')}</label>
        </fieldset>
      </div>

      <div className="callout">
        <h3>{t('delegation.summaryTitle')}</h3>
        <p>{t('delegation.summary', {
          actions: actions.map((x) => t(`action.${x}`)).join(', ') || '—',
          platforms: platforms.map((x) => t(`platform.${x}`)).join(', ') || '—',
          templates: templates.map((x) => t(`template.${x}`)).join(', ') || '—',
          duration: minutes < 60 ? t('delegation.minutes', { n: minutes }) : t('delegation.hours', { n: minutes / 60 }),
        })}</p>
        <p className="muted">{t('delegation.gatesStillApply')}</p>
        <p><strong>{t('delegation.neverTitle')}</strong> {t('delegation.neverList')}</p>
      </div>

      <label className="confirm-row">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {t('delegation.confirm')}
      </label>
      <ErrorNote error={a.error} />
      <div className="row gap end">
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={!confirmed || !valid || a.busy} onClick={activate}>{t('delegation.activate')}</button>
      </div>
    </Modal>
  );
}

export function DelegationBanner({ active, onStop }: { active: any; onStop: () => void }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!active) return null;
  return (
    <div className="delegation-banner" role="status">
      <strong>{t('delegation.bannerTitle')}</strong>
      <span>{t('delegation.bannerScope', { actions: active.scope.actions.map((x: string) => t(`action.${x}`)).join(', ') })}</span>
      <span>{t('delegation.timeLeft', { time: remaining(active.expires_at, now) })} · {t('delegation.until', { time: fmtDateTime(active.expires_at, i18n.language) })}</span>
      <span>{t('delegation.approvedCount', { count: active.approved_count })}</span>
      <button className="btn btn-small btn-dark" onClick={onStop}>{t('delegation.stop')}</button>
    </div>
  );
}

/** Return briefing after I'M DONE / stop / expiry: everything done under the delegation, from stored events. */
export function BriefingModal({ delegationId, onClose }: { delegationId: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const st = useApi<{ briefing: any }>(delegationId ? `/api/delegation/${delegationId}/briefing` : null);
  const a = useAction();
  const b = st.data?.briefing;
  const ack = async () => {
    const r = await a.run(() => api(`/api/delegation/${delegationId}/acknowledge`, { method: 'POST' }));
    if (r) onClose();
  };
  const row = (e: any) => (
    <li key={e.seq}>
      <span className="muted">{fmtDateTime(e.at, i18n.language)}</span> · <strong>{t(`eventType.${e.type}`, { defaultValue: e.type })}</strong>
      {e.target ? ` · ${shortTarget(e.target)}` : ''}{e.reason ? ` — ${e.reason}` : ''}
    </li>
  );
  return (
    <Modal open={!!delegationId} onClose={onClose} title={t('briefing.title')} wide>
      {!b ? (st.error ? <ErrorNote error={st.error} /> : <Loading />) : (
        <>
          <p>{t('briefing.window', { from: fmtDateTime(b.session.starts_at, i18n.language), to: fmtDateTime(b.session.revoked_at ?? b.session.expires_at, i18n.language), reason: t(`briefing.reason_${b.session.revoked_reason ?? 'active'}`) })}</p>
          <h3>{t('briefing.approvals', { count: b.approvals.length })}</h3>
          {b.approvals.length ? <ul className="plain-list">{b.approvals.map(row)}</ul> : <p className="muted">{t('briefing.none')}</p>}
          <h3>{t('briefing.blocked', { count: b.blocked.length })}</h3>
          {b.blocked.length ? <ul className="plain-list">{b.blocked.map(row)}</ul> : <p className="muted">{t('briefing.none')}</p>}
          <h3>{t('briefing.publishing', { count: b.publishing.length })}</h3>
          {b.publishing.length ? <ul className="plain-list">{b.publishing.map(row)}</ul> : <p className="muted">{t('briefing.none')}</p>}
          <h3>{t('briefing.inFlight', { count: b.inFlight.length })}</h3>
          {b.inFlight.length ? <ul className="plain-list">{b.inFlight.map((p: any) => <li key={p.id}>{t(`platform.${p.platform}`)} · {p.status}</li>)}</ul> : <p className="muted">{t('briefing.none')}</p>}
          <h3>{t('briefing.pending', { count: b.pendingDecisions.length })}</h3>
          {b.pendingDecisions.length ? <p>{b.pendingDecisions.map((p: any) => p.ref).join(', ')}</p> : <p className="muted">{t('briefing.none')}</p>}
          <p className="muted">{t('briefing.cannotUndo')}</p>
          <ErrorNote error={a.error} />
          <div className="row gap end">
            {b.session.briefing_acknowledged_at
              ? <Badge tone="ok">{t('briefing.acknowledged')}</Badge>
              : <button className="btn btn-primary" onClick={ack} disabled={a.busy || !b.session.revoked_at}>{t('briefing.acknowledge')}</button>}
          </div>
        </>
      )}
    </Modal>
  );
}
