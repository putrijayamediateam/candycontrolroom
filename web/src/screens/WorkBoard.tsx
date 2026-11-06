import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { go } from '../App';
import { useSession } from '../session';
import { assetUrl, fmtDateTime, isImage, isVideo } from '../format';
import { Async, Badge, Card, DemoBadge, Empty, ErrorNote, Field, Modal, PageHeader, ReviewBadge, SideStateBadge, StageBadge, Tabs } from '../ui';
import { PLATFORMS } from '../delegation';

const COLUMNS: { id: string; stages: string[] }[] = [
  { id: 'planning', stages: ['brief', 'research', 'request', 'ux_brief'] },
  { id: 'making', stages: ['copy', 'sketch', 'production', 'editing', 'design', 'implementation', 'testing'] },
  { id: 'review', stages: ['qa', 'candy_review', 'awaiting_ain', 'candy_design_review', 'ain_design_approval', 'candy_release_review', 'ain_release_approval'] },
  { id: 'done', stages: ['approved', 'scheduled', 'publishing', 'published', 'performance_review', 'released_verified'] },
];
const APPROVAL_STAGES = new Set(['awaiting_ain', 'approved', 'ain_design_approval', 'ain_release_approval']);

export function WorkBoard({ param }: { param?: string }) {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const [kind, setKind] = useState<'all' | 'content' | 'design_dev'>('all');
  const [state, setState] = useState<'all' | 'open' | 'blocked'>('open');
  const [creating, setCreating] = useState(false);
  const st = useApi<any>(`/api/tasks?state=${state}${kind === 'all' ? '' : `&kind=${kind}`}`);

  if (param) return <TaskDetail id={param} />;
  return (
    <>
      <PageHeader title={t('nav.work')} subtitle={t('work.subtitle')} actions={isOwner && <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('work.newTask')}</button>} />
      <div className="row gap wrap filters">
        <Tabs value={kind} onChange={setKind} items={[{ id: 'all', label: t('work.allWork') }, { id: 'content', label: t('work.content') }, { id: 'design_dev', label: t('work.designDev') }]} />
        <Tabs value={state} onChange={setState} items={[{ id: 'open', label: t('work.open') }, { id: 'blocked', label: t('work.blocked') }, { id: 'all', label: t('work.everything') }]} />
      </div>
      <Async state={st}>
        {(d) => d.tasks.length === 0 ? <Empty title={t('work.empty')}>{t('work.emptyHint')}</Empty> : (
          <div className="board">
            {COLUMNS.map((c) => {
              const items = d.tasks.filter((x: any) => c.stages.includes(x.stage));
              return (
                <section key={c.id} className="column" aria-label={t(`work.col_${c.id}`)}>
                  <h2>{t(`work.col_${c.id}`)} <span className="muted">{items.length}</span></h2>
                  {items.map((x: any) => (
                    <a key={x.id} href={`#/work/${x.id}`} className="task-card">
                      <span className="muted small">{x.ref} · {t(`template.${x.template}`, { defaultValue: x.template })}</span>
                      <strong>{x.title}</strong>
                      <span className="row gap wrap"><StageBadge stage={x.stage} /><SideStateBadge state={x.side_state} /><DemoBadge show={x.is_demo} />
                        {x.content_locale && <Badge>{x.content_locale.toUpperCase()}</Badge>}</span>
                      {x.owner_name && <span className="small muted">{t('work.owner')}: {x.owner_name}</span>}
                    </a>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </Async>
      <NewTaskModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

export function NewTaskModal({ open, onClose, designOnly }: { open: boolean; onClose: () => void; designOnly?: boolean }) {
  const { t } = useTranslation();
  const tpl = useApi<any>(open ? '/api/templates' : null);
  const staff = useApi<any>(open ? '/api/staff' : null);
  const [f, setF] = useState<any>({ template: designOnly ? 'system_improvement' : 'poster', title: '', objective: '', owner: designOnly ? 'alex' : 'mei', platforms: ['facebook', 'instagram', 'tiktok', 'threads'], contentLocale: '', audience: '', requiresConsent: false });
  const a = useAction();
  const isDesign = tpl.data?.templates.find((x: any) => x.id === f.template)?.kind === 'design_dev';
  const create = async () => {
    const body: any = { template: f.template, title: f.title, owner: f.owner || undefined, objective: f.objective || undefined };
    if (!isDesign) Object.assign(body, { platforms: f.platforms, audience: f.audience || undefined, contentLocale: f.contentLocale || null, requiresConsent: f.requiresConsent });
    const r = await a.run(() => api<any>('/api/tasks', { method: 'POST', body }));
    if (r) { onClose(); go('work', r.task.id); }
  };
  return (
    <Modal open={open} onClose={onClose} title={designOnly ? t('studio.newRequest') : t('work.newTask')} wide>
      <div className="grid-2">
        <Field label={t('work.template')}>
          <select value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>
            {tpl.data?.templates.filter((x: any) => !designOnly || x.kind === 'design_dev').map((x: any) => <option key={x.id} value={x.id}>{t(`template.${x.id}`, { defaultValue: x.id })}</option>)}
          </select>
        </Field>
        <Field label={t('work.owner')}>
          <select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            {staff.data?.staff.map((s: any) => <option key={s.id} value={s.id}>{s.display_name} — {s.role_title}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('work.title')}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} /></Field>
      <Field label={isDesign ? t('studio.requestDetail') : t('work.objective')} hint={isDesign ? undefined : t('work.objectiveHint')}><textarea rows={4} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></Field>
      {!isDesign && (
        <>
          <fieldset className="choice inline">
            <legend>{t('work.platforms')}</legend>
            {PLATFORMS.map((p) => (
              <label key={p}><input type="checkbox" checked={f.platforms.includes(p)} onChange={() => setF({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x: string) => x !== p) : [...f.platforms, p] })} /> {t(`platform.${p}`)}</label>
            ))}
          </fieldset>
          <div className="grid-2">
            <Field label={t('work.audience')}><input value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} /></Field>
            <Field label={t('work.contentLanguage')} hint={t('work.contentLanguageHint')}>
              <select value={f.contentLocale} onChange={(e) => setF({ ...f, contentLocale: e.target.value })}>
                <option value="">{t('work.inheritLanguage')}</option><option value="en">English</option><option value="ms">Bahasa Melayu</option>
              </select>
            </Field>
          </div>
          <label className="confirm-row"><input type="checkbox" checked={f.requiresConsent} onChange={(e) => setF({ ...f, requiresConsent: e.target.checked })} /> {t('work.requiresConsent')}</label>
          <p className="muted small">{t('work.healthClaimNote')}</p>
        </>
      )}
      <ErrorNote error={a.error} />
      <div className="row gap end"><button className="btn" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={create} disabled={a.busy || !f.title.trim()}>{t('work.create')}</button></div>
    </Modal>
  );
}

function TaskDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>(`/api/tasks/${id}`);
  const adv = useAction();
  const [editing, setEditing] = useState<any>(null);

  return (
    <Async state={st}>
      {(d) => {
        const task = d.task; const steps: string[] = d.steps;
        const idx = steps.indexOf(task.stage); const next = steps[idx + 1];
        const advance = async () => { await adv.run(() => api(`/api/tasks/${id}/advance`, { method: 'POST', body: { toStage: next } })); };
        return (
          <>
            <PageHeader title={task.title} subtitle={<>{task.ref} · {t(`template.${task.template}`, { defaultValue: task.template })} · {t('work.owner')}: {task.owner_name ?? '—'}</>}
              actions={<a className="btn" href="#/work">{t('common.back')}</a>} />
            <div className="row gap wrap"><StageBadge stage={task.stage} /><SideStateBadge state={task.side_state} /><DemoBadge show={task.is_demo} />
              {task.platforms.map((p: string) => <Badge key={p}>{t(`platform.${p}`)}</Badge>)}
              {task.requires_clinical && <Badge tone="warn">{t('work.sourceCheckRequired')}</Badge>}
              {task.requires_consent && <Badge tone="warn">{t('work.consentRequired')}</Badge>}</div>
            {task.blocker && <div className="callout callout-warn">{task.blocker}</div>}
            {task.objective && <p className="pre">{task.objective}</p>}

            <Card title={t('work.workflow')}>
              <ol className="steps">
                {steps.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>{t(`stage.${s}`, { defaultValue: s })}</li>)}
              </ol>
              {isOwner && next && (APPROVAL_STAGES.has(next)
                ? <p className="muted small">{t('work.nextIsGate', { stage: t(`stage.${next}`, { defaultValue: next }) })}</p>
                : <div className="row gap"><button className="btn" onClick={advance} disabled={adv.busy}>{t('work.moveTo', { stage: t(`stage.${next}`, { defaultValue: next }) })}</button>
                    <span className="muted small">{t('work.moveExplain')}</span></div>)}
              <ErrorNote error={adv.error} />
            </Card>

            <Card title={t('work.versions')} actions={isOwner && <button className="btn btn-small" onClick={() => setEditing(d.versions[0] ?? {})}>{t('work.newVersion')}</button>}>
              {d.versions.length === 0 ? <Empty title={t('work.noVersions')}>{t('work.noVersionsHint')}</Empty> : d.versions.map((v: any) => (
                <article key={v.id} className="version">
                  <div className="row gap wrap"><Badge tone="pink">v{v.version}</Badge>{v.platform && <Badge>{t(`platform.${v.platform}`)}</Badge>}<Badge>{v.content_locale.toUpperCase()}</Badge>
                    {v.translated_from && <Badge tone="info">{t('work.translation')}</Badge>}<span className="muted small">{fmtDateTime(v.created_at, i18n.language)} · {v.submitted_by ?? 'AIN'}</span>
                    <span className="muted small mono" title={v.content_hash}>#{v.content_hash.slice(0, 10)}</span></div>
                  <div className="version-body">
                    <div className="previews">{v.asset_keys.map((k: string) => <Preview key={k} k={k} />)}</div>
                    <div>
                      {v.copy_text && <pre className="copy">{v.copy_text}</pre>}
                      {v.destination && <p className="small">{t('work.destination')}: {v.destination}</p>}
                      <h4>{t('work.checks')}</h4>
                      {v.checks.length ? <ul className="plain-list compact small">{v.checks.map((c: any) => (
                        <li key={c.id}><Badge tone={c.result === 'passed' ? 'ok' : c.result === 'failed' ? 'bad' : 'warn'}>{t(`checkResult.${c.result}`)}</Badge> <strong>{t(`checkType.${c.check_type}`, { defaultValue: c.check_type })}</strong> · {c.actor_kind === 'human' ? 'AIN' : c.actor_id}{c.evidence ? ` — ${c.evidence}` : ''}</li>
                      ))}</ul> : <p className="muted small">{t('work.noChecks')}</p>}
                      {v.missing_gates.length > 0 && <p className="small"><Badge tone="warn">{t('work.missing')}</Badge> {v.missing_gates.join(', ')}</p>}
                      {isOwner && <CheckForm versionId={v.id} />}
                    </div>
                  </div>
                </article>
              ))}
            </Card>

            <div className="grid-2">
              <Card title={t('work.reviews')}>
                {d.reviews.length ? <ul className="plain-list compact">{d.reviews.map((r: any) => (
                  <li key={r.id}><strong>{r.ref}</strong> <ReviewBadge status={r.status} /> <span className="muted small">{fmtDateTime(r.submitted_at, i18n.language)}</span>{r.candy_review && <p className="small">CANDY: {r.candy_review}</p>}</li>
                ))}</ul> : <Empty title={t('work.noReviews')} />}
                {d.approvals.length > 0 && <>
                  <h4>{t('work.approvals')}</h4>
                  <ul className="plain-list compact small">{d.approvals.map((a: any) => (
                    <li key={a.id}><Badge tone={a.invalidated_at ? 'neutral' : a.decision === 'approved' ? 'ok' : 'warn'}>{t(`decision.${a.decision}`)}</Badge> {t(`action.${a.action}`)} · {a.decided_by_kind === 'human' ? 'AIN' : t('approvals.byCandyDelegated')}
                      {a.invalidated_at && <> · <em>{t('work.invalidated')}: {a.invalidated_reason}</em></>}</li>
                  ))}</ul>
                </>}
              </Card>
              <Card title={t('work.timeline')}>
                <ul className="plain-list compact small timeline">{d.events.map((e: any) => (
                  <li key={e.seq}><span className="muted">{fmtDateTime(e.at, i18n.language)}</span> {t(`eventType.${e.type}`, { defaultValue: e.type })}{e.new_state ? ` → ${e.new_state}` : ''} <span className="muted">· {e.actor_kind === 'candy_delegated' ? t('approvals.byCandyDelegated') : e.actor_kind === 'human' ? 'AIN' : e.actor_id}</span>{e.reason ? ` — ${e.reason}` : ''}</li>
                ))}</ul>
              </Card>
            </div>
            <VersionModal taskId={id} base={editing} onClose={() => setEditing(null)} />
          </>
        );
      }}
    </Async>
  );
}

export function Preview({ k }: { k: string }) {
  const { t } = useTranslation();
  if (isImage(k)) return <a href={assetUrl(k)} target="_blank" rel="noreferrer"><img src={assetUrl(k)} alt={k.split('/').pop()} loading="lazy" className="preview-img" /></a>;
  if (isVideo(k)) return <video src={assetUrl(k)} controls className="preview-img" />;
  return <a href={assetUrl(k)} className="pill">{t('work.openFile')} {k.split('/').pop()}</a>;
}

function CheckForm({ versionId }: { versionId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('sources');
  const [result, setResult] = useState<'passed' | 'failed' | 'not_verified'>('passed');
  const [evidence, setEvidence] = useState('');
  const a = useAction();
  if (!open) return <button className="btn btn-small btn-ghost" onClick={() => setOpen(true)}>{t('work.addCheck')}</button>;
  const save = async () => { const r = await a.run(() => api(`/api/versions/${versionId}/checks`, { method: 'POST', body: { checkType: type, result, evidence: evidence || undefined } })); if (r) { setOpen(false); setEvidence(''); } };
  return (
    <div className="inline-form">
      <div className="grid-2">
        <Field label={t('work.checkType')}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['sources', 'clinical_signoff', 'consent', 'qa_complete', 'prices_confirmed', 'brand_name'].map((c) => <option key={c} value={c}>{t(`checkType.${c}`, { defaultValue: c })}</option>)}
          </select>
        </Field>
        <Field label={t('work.result')}>
          <select value={result} onChange={(e) => setResult(e.target.value as any)}>
            {(['passed', 'failed', 'not_verified'] as const).map((r) => <option key={r} value={r}>{t(`checkResult.${r}`)}</option>)}
          </select>
        </Field>
      </div>
      {type === 'clinical_signoff' && <p className="small callout">{t('work.clinicalMeaning')}</p>}
      <Field label={t('work.evidence')} hint={t('work.evidenceHint')}><textarea rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field>
      <ErrorNote error={a.error} />
      <div className="row gap end"><button className="btn btn-small" onClick={() => setOpen(false)}>{t('common.cancel')}</button><button className="btn btn-small btn-primary" onClick={save} disabled={a.busy}>{t('work.recordCheck')}</button></div>
    </div>
  );
}

function VersionModal({ taskId, base, onClose }: { taskId: string; base: any; onClose: () => void }) {
  const { t } = useTranslation();
  const [copy, setCopy] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const a = useAction();
  if (base && key !== (base.id ?? 'new')) { setKey(base.id ?? 'new'); setCopy(base.copy_text ?? ''); }
  const save = async () => {
    const r = await a.run(() => api(`/api/tasks/${taskId}/versions`, { method: 'POST', body: { platform: base.platform ?? null, copy, assets: base.asset_keys ?? [], destination: base.destination ?? undefined, locale: base.content_locale ?? undefined } }));
    if (r) { setKey(null); onClose(); }
  };
  return (
    <Modal open={!!base} onClose={() => { setKey(null); onClose(); }} title={t('work.newVersion')}>
      <p className="callout callout-warn small">{t('work.newVersionWarning')}</p>
      <Field label={t('work.copy')}><textarea rows={8} value={copy} onChange={(e) => setCopy(e.target.value)} /></Field>
      <ErrorNote error={a.error} />
      <div className="row gap end"><button className="btn" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save} disabled={a.busy}>{t('work.saveVersion')}</button></div>
    </Modal>
  );
}
