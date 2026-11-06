import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { useSession } from '../session';
import { fmtDateTime } from '../format';
import { Async, Badge, Card, DemoBadge, Empty, ErrorNote, Field, Modal, PageHeader } from '../ui';
import { Preview } from './WorkBoard';

/** Which approval action a review needs, from its task kind and stage. */
export function actionFor(r: any): string {
  if (r.task_kind === 'design_dev') return r.task_stage === 'ain_release_approval' ? 'release' : 'design_approval';
  return r.template === 'review_reply' ? 'reply' : 'internal_approval';
}

export function ApprovalInbox() {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>('/api/reviews/awaiting');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <>
      <PageHeader title={t('nav.approvals')} subtitle={t('approvals.subtitle')}
        actions={isOwner && selected.length > 0 && <button className="btn btn-primary" onClick={() => setBulkOpen(true)}>{t('approvals.reviewSelected', { count: selected.length })}</button>} />
      <Async state={st}>
        {(d) => d.reviews.length === 0 ? <Empty title={t('approvals.empty')}>{t('approvals.emptyHint')}</Empty> : (
          <div className="stack">
            {d.reviews.map((r: any) => (
              <ReviewCard key={r.id} r={r} selected={selected.includes(r.id)}
                onSelect={(on) => setSelected(on ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
            ))}
            <BulkApprove open={bulkOpen} onClose={() => setBulkOpen(false)} items={d.reviews.filter((r: any) => selected.includes(r.id))} onDone={() => setSelected([])} />
          </div>
        )}
      </Async>
    </>
  );
}

function ReviewCard({ r, selected, onSelect }: { r: any; selected: boolean; onSelect: (on: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { isOwner } = useSession();
  const [mode, setMode] = useState<null | 'changes_requested' | 'rejected'>(null);
  const [reason, setReason] = useState('');
  const a = useAction();
  const action = actionFor(r);
  const decide = async (decision: 'approved' | 'changes_requested' | 'rejected') => {
    const res = await a.run(() => api(`/api/reviews/${r.id}/decision`, { method: 'POST', body: { action, decision, reason: reason || undefined } }));
    if (res) { setMode(null); setReason(''); }
  };
  return (
    <Card className="review-card">
      <div className="review-grid">
        <div className="previews">{r.asset_keys.length ? r.asset_keys.map((k: string) => <Preview key={k} k={k} />) : <p className="muted small">{t('approvals.noAssets')}</p>}</div>
        <div className="stack">
          <div className="row gap wrap">
            {isOwner && <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={t('approvals.select', { ref: r.ref })} />}
            <strong>{r.ref}</strong><Badge tone="pink">v{r.version}</Badge>
            {r.platform ? <Badge>{t(`platform.${r.platform}`)}</Badge> : r.platforms.map((p: string) => <Badge key={p}>{t(`platform.${p}`)}</Badge>)}
            <Badge>{r.content_locale.toUpperCase()}</Badge><DemoBadge show={r.is_demo} />
          </div>
          <h2 className="review-title"><a href={`#/work/${r.task_id}`}>{r.title}</a></h2>
          <p className="muted small">{t('approvals.submittedBy', { name: r.submitted_by_name, time: fmtDateTime(r.submitted_at, i18n.language) })} · {r.task_ref}</p>
          {r.copy_text && <><h4>{t('approvals.exactCopy')}</h4><pre className="copy">{r.copy_text}</pre></>}
          <p className="small">{t('approvals.destination')}: {r.destination ?? t('approvals.notSet')}</p>
          <div className="callout"><strong>{t('approvals.candyReview')}</strong> {r.candy_review}</div>
          <p className="muted small mono" title={r.content_hash}>{t('approvals.boundTo', { action: t(`action.${action}`), hash: r.content_hash.slice(0, 12) })}</p>
          {isOwner ? (
            <>
              {mode && (
                <Field label={mode === 'rejected' ? t('approvals.rejectReason') : t('approvals.changesReason')}>
                  <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                </Field>
              )}
              <ErrorNote error={a.error} />
              <div className="row gap wrap">
                {!mode && <>
                  <button className="btn btn-primary" onClick={() => decide('approved')} disabled={a.busy}>{t('approvals.approve')}</button>
                  <button className="btn" onClick={() => setMode('changes_requested')}>{t('approvals.requestChanges')}</button>
                  <button className="btn btn-danger-ghost" onClick={() => setMode('rejected')}>{t('approvals.reject')}</button>
                  <a className="btn btn-ghost" href={`#/work/${r.task_id}`}>{t('approvals.openTask')}</a>
                </>}
                {mode && <>
                  <button className="btn btn-primary" onClick={() => decide(mode)} disabled={a.busy || !reason.trim()}>{mode === 'rejected' ? t('approvals.confirmReject') : t('approvals.sendChanges')}</button>
                  <button className="btn" onClick={() => { setMode(null); setReason(''); }}>{t('common.cancel')}</button>
                </>}
              </div>
            </>
          ) : <p className="muted small">{t('common.ownerOnly')}</p>}
        </div>
      </div>
    </Card>
  );
}

/** Bulk approval lists every exact item and version before anything is approved. */
function BulkApprove({ open, onClose, items, onDone }: { open: boolean; onClose: () => void; items: any[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const out: Record<string, string> = {};
    for (const r of items) {
      try { await api(`/api/reviews/${r.id}/decision`, { method: 'POST', body: { action: actionFor(r), decision: 'approved', reason: 'Bulk approval' } }); out[r.id] = 'ok'; }
      catch (e: any) { out[r.id] = e.message; }
      setResults({ ...out });
    }
    setBusy(false); onDone();
  };
  const done = Object.keys(results).length > 0 && !busy;
  return (
    <Modal open={open} onClose={() => { setResults({}); onClose(); }} title={t('approvals.bulkTitle')}>
      <p>{t('approvals.bulkIntro')}</p>
      <ul className="plain-list compact">
        {items.map((r) => (
          <li key={r.id}><strong>{r.ref}</strong> v{r.version} · {r.title} · <span className="mono small">#{r.content_hash.slice(0, 10)}</span>
            {results[r.id] && (results[r.id] === 'ok' ? <Badge tone="ok">{t('decision.approved')}</Badge> : <Badge tone="bad">{results[r.id]}</Badge>)}</li>
        ))}
      </ul>
      <div className="row gap end">
        <button className="btn" onClick={() => { setResults({}); onClose(); }}>{done ? t('common.close') : t('common.cancel')}</button>
        {!done && <button className="btn btn-primary" onClick={run} disabled={busy || !items.length}>{t('approvals.approveAll', { count: items.length })}</button>}
      </div>
    </Modal>
  );
}
