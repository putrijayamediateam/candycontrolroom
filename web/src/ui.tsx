import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiError } from './api';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && <div className="card-head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

type Tone = 'neutral' | 'pink' | 'ok' | 'warn' | 'bad' | 'info' | 'demo';
/** Badges always carry text, so status never depends on colour alone. */
export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

const STAGE_TONE: Record<string, Tone> = {
  approved: 'ok', published: 'ok', released_verified: 'ok', performance_review: 'ok', scheduled: 'info', publishing: 'info',
  awaiting_ain: 'pink', ain_design_approval: 'pink', ain_release_approval: 'pink', candy_review: 'pink', candy_design_review: 'pink', candy_release_review: 'pink',
};
export function StageBadge({ stage }: { stage: string }) {
  const { t } = useTranslation();
  return <Badge tone={STAGE_TONE[stage] ?? 'neutral'}>{t(`stage.${stage}`, { defaultValue: stage.replaceAll('_', ' ') })}</Badge>;
}
export function SideStateBadge({ state }: { state: string | null }) {
  const { t } = useTranslation();
  if (!state) return null;
  return <Badge tone={state === 'blocked' ? 'bad' : 'warn'}>{t(`sideState.${state}`, { defaultValue: state.replaceAll('_', ' ') })}</Badge>;
}
const REVIEW_TONE: Record<string, Tone> = { approved: 'ok', awaiting_ain: 'pink', awaiting_candy: 'info', changes_requested: 'warn', rejected: 'bad', superseded: 'neutral' };
export function ReviewBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge tone={REVIEW_TONE[status] ?? 'neutral'}>{t(`reviewStatus.${status}`, { defaultValue: status })}</Badge>;
}
/** Honest evidence labels: verified execution, user-reported, suggested, not connected, demo. */
export function EvidenceBadge({ kind }: { kind: 'verified' | 'user_reported' | 'suggested' | 'not_connected' | 'demo' | 'stale' }) {
  const { t } = useTranslation();
  const tone: Record<string, Tone> = { verified: 'ok', user_reported: 'info', suggested: 'neutral', not_connected: 'warn', demo: 'demo', stale: 'warn' };
  return <Badge tone={tone[kind]}>{t(`evidence.${kind}`)}</Badge>;
}
export function DemoBadge({ show }: { show?: boolean }) {
  const { t } = useTranslation();
  return show ? <Badge tone="demo">{t('evidence.demo')}</Badge> : null;
}

export function Avatar({ name, colour, size = 32 }: { name: string; colour: string; size?: number }) {
  const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return <span className="avatar" aria-hidden="true" style={{ background: colour, width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><p className="empty-title">{title}</p>{children && <div className="muted">{children}</div>}</div>;
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{t('common.loading')}</div>;
}

const DETAIL_CODES = new Set(['gates_unmet', 'dependency_open', 'task_paused', 'skip_not_allowed', 'out_of_scope', 'not_authorized', 'invalid_stage', 'wrong_state', 'stale_version', 'too_many_attempts', 'file_too_large', 'unsupported_file']);

export function ErrorNote({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  const known = t(`errors.${error.code}`, { defaultValue: '' });
  // Policy refusals carry specifics from the server (which gate, which task); keep them visible.
  const detail = known && DETAIL_CODES.has(error.code) && error.message ? ` (${error.message})` : '';
  const msg = known ? known + detail : error.message || t('errors.generic');
  return (
    <div className="error-note" role="alert">
      <strong>{t('common.error')}</strong> {msg}
      {error.issues?.length ? <ul>{error.issues.map((i, n) => <li key={n}>{i.path.join('.')}: {i.message}</li>)}</ul> : null}
      {onRetry && <button className="btn btn-small" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

/** Data loader wrapper: loading, error with retry, then content. */
export function Async<T>({ state, children }: { state: { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }; children: (d: T) => ReactNode }) {
  if (state.error && !state.data) return <ErrorNote error={state.error} onRetry={state.reload} />;
  if (!state.data) return <Loading />;
  return <>{children(state.data)}</>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onClose={onClose} onCancel={onClose} aria-label={title}>
      {open && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="btn btn-ghost" onClick={onClose} aria-label={t('common.close')}>✕</button>
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={`tab ${value === i.id ? 'active' : ''}`} onClick={() => onChange(i.id)}>{i.label}</button>
      ))}
    </div>
  );
}
