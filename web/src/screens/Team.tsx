import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { go } from '../App';
import { useSession } from '../session';
import { fmtDateTime } from '../format';
import { Async, Avatar, Badge, Card, Empty, ErrorNote, EvidenceBadge, Field, PageHeader, SideStateBadge, StageBadge, Tabs } from '../ui';
import { DEPARTMENTS } from './office';
import { TrainingFiles } from './TrainingFiles';

export function Team({ param }: { param?: string }) {
  const { t } = useTranslation();
  const st = useApi<any>('/api/staff');
  const selected = param ?? 'candy';
  return (
    <>
      <PageHeader title={t('nav.team')} subtitle={t('team.subtitle')} />
      <div className="split">
        <Card className="roster">
          <Async state={st}>
            {(d) => (
              <>
                <p className="muted small">{t('team.count', { total: d.staff.length })}</p>
                {DEPARTMENTS.map((dep) => (
                  <div key={dep} className="roster-group">
                    <h3>{t(`department.${dep}`)}</h3>
                    <ul>
                      {d.staff.filter((s: any) => s.department === dep).map((s: any) => (
                        <li key={s.id}>
                          <a href={`#/team/${s.id}`} className={`roster-item ${selected === s.id ? 'active' : ''}`} aria-current={selected === s.id ? 'true' : undefined}>
                            <Avatar name={s.display_name} colour={s.colour} size={28} />
                            <span><strong>{s.display_name}</strong><span className="muted small block">{s.role_title}</span></span>
                            <Badge tone={s.onboarding === 'ready' ? 'ok' : s.onboarding === 'needs_clarification' ? 'warn' : 'neutral'}>{t(`onboardingState.${s.onboarding}`)}</Badge>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </Async>
        </Card>
        <StaffProfile id={selected} />
      </div>
    </>
  );
}

function StaffProfile({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>(`/api/staff/${id}`);
  const [tab, setTab] = useState<'brief' | 'history' | 'work' | 'tools' | 'edit'>('brief');
  useEffect(() => setTab('brief'), [id]);

  return (
    <Async state={st}>
      {(d) => {
        const s = d.staff;
        return (
          <Card className="profile">
            <div className="profile-head">
              <Avatar name={s.display_name} colour={s.colour} size={56} />
              <div>
                <h2>{s.display_name} {s.paused && <Badge tone="warn">{t('staffStatus.paused')}</Badge>}</h2>
                <p className="muted">{s.role_title} · {t(`department.${s.department}`)}</p>
                <p className="small">
                  <Badge>{t(`staffStatus.${s.status}`, { defaultValue: s.status })}</Badge>{' '}
                  <Badge tone={s.onboarding === 'ready' ? 'ok' : 'neutral'}>{t(`onboardingState.${s.onboarding}`)}</Badge>{' '}
                  {s.reports_to ? <span className="muted">{t('team.reportsTo')} <a href={`#/team/${s.reports_to}`}>{s.reports_to === 'candy' ? 'CANDY' : s.reports_to}</a></span> : <span className="muted">{t('team.reportsToAin')}</span>}
                </p>
              </div>
            </div>
            <p className="muted small">{t('team.fictional')}</p>
            <div className="grid-3 small">
              <div><h3>{t('team.deliverables')}</h3><ul>{s.deliverables.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3>{t('team.allowed')}</h3><ul>{s.allowed_actions.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3>{t('team.prohibited')}</h3><ul>{s.prohibited_actions.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            </div>
            {d.direct_reports.length > 0 && <p className="small"><strong>{t('team.directReports')}</strong> {d.direct_reports.map((r: any) => <a key={r.id} href={`#/team/${r.id}`} className="pill">{r.display_name}</a>)}</p>}

            <Tabs value={tab} onChange={setTab} items={[
              { id: 'brief', label: t('team.tabBrief') },
              { id: 'history', label: t('team.tabHistory', { count: d.instructions.length }) },
              { id: 'work', label: t('team.tabWork', { count: d.tasks.length }) },
              { id: 'tools', label: t('team.tabTools') },
              ...(isOwner ? [{ id: 'edit' as const, label: t('team.tabEdit') }] : []),
            ]} />

            {tab === 'brief' && (
              <>
                <BriefForm staff={s} current={d.instructions[0]} onSaved={() => { st.reload(); setTab('history'); }} />
                <TrainingFiles staffId={s.id} staffName={s.display_name} />
              </>
            )}
            {tab === 'history' && (d.instructions.length ? (
              <ol className="history">
                {d.instructions.map((i: any) => (
                  <li key={i.id}>
                    <div className="row gap"><Badge tone="pink">v{i.version}</Badge><span className="muted small">{fmtDateTime(i.created_at, i18n.language)}</span>{i.change_note && <span className="small">— {i.change_note}</span>}</div>
                    <pre className="instruction">{i.body}</pre>
                  </li>
                ))}
              </ol>
            ) : <Empty title={t('team.notBriefed')}>{t('team.notBriefedHint')}</Empty>)}
            {tab === 'work' && (
              <>
                {d.tasks.length ? (
                  <ul className="plain-list">
                    {d.tasks.map((x: any) => <li key={x.id}><a href={`#/work/${x.id}`}>{x.ref}</a> {x.title} <StageBadge stage={x.stage} /> <SideStateBadge state={x.side_state} /></li>)}
                  </ul>
                ) : <Empty title={t('team.noTasks')} />}
                <h3>{t('team.questions')}</h3>
                {d.questions.length ? (
                  <ul className="plain-list">
                    {d.questions.map((q: any) => <li key={q.id}><QuestionItem q={q} onAnswered={st.reload} /></li>)}
                  </ul>
                ) : <Empty title={t('team.noQuestions')} />}
              </>
            )}
            {tab === 'tools' && (
              <>
                <p className="muted small">{t('team.toolsExplain')}</p>
                <p className="row gap wrap small"><EvidenceBadge kind="verified" /><EvidenceBadge kind="user_reported" /><EvidenceBadge kind="suggested" /><EvidenceBadge kind="not_connected" /><EvidenceBadge kind="stale" /></p>
                {d.tool_jobs.length ? (
                  <div className="table-wrap"><table>
                    <thead><tr><th>{t('team.tool')}</th><th>{t('team.evidence')}</th><th>{t('team.jobStatus')}</th><th>{t('team.step')}</th><th>{t('team.lastUpdate')}</th></tr></thead>
                    <tbody>{d.tool_jobs.map((j: any) => (
                      <tr key={j.id}><td>{j.tool}</td><td><EvidenceBadge kind={j.evidence} /></td><td>{j.status}{j.blocker ? ` — ${j.blocker}` : ''}</td><td>{j.step ?? '—'}</td><td>{fmtDateTime(j.heartbeat_at ?? j.created_at, i18n.language)}</td></tr>
                    ))}</tbody>
                  </table></div>
                ) : <Empty title={t('team.noToolActivity')}>{t('team.noToolActivityHint')}</Empty>}
              </>
            )}
            {tab === 'edit' && <EditStaff staff={s} onSaved={st.reload} />}
          </Card>
        );
      }}
    </Async>
  );
}

function BriefForm({ staff, current, onSaved }: { staff: any; current?: any; onSaved: () => void }) {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const [target, setTarget] = useState<'one' | 'department' | 'all'>('one');
  const [body, setBody] = useState(current?.body ?? '');
  const [note, setNote] = useState('');
  const a = useAction();
  useEffect(() => { setBody(current?.body ?? ''); setNote(''); setTarget('one'); }, [staff.id, current?.id]);
  if (!isOwner) return <p className="muted">{t('common.ownerOnly')}</p>;
  const save = async () => {
    const tgt = target === 'one' ? { staffId: staff.id } : target === 'department' ? { department: staff.department } : { all: true };
    const r = await a.run(() => api('/api/staff/brief', { method: 'POST', body: { ...tgt, body, changeNote: note || undefined } }));
    if (r) onSaved();
  };
  return (
    <div className="stack">
      <p className="muted small">{t('team.briefExplain')}</p>
      <fieldset className="choice inline">
        <legend>{t('team.briefWho')}</legend>
        <label><input type="radio" checked={target === 'one'} onChange={() => setTarget('one')} /> {staff.display_name}</label>
        {/* Group briefs start empty so one person's instructions are never copied to everyone by accident. */}
        <label><input type="radio" checked={target === 'department'} onChange={() => { setTarget('department'); setBody(''); }} /> {t('team.wholeDepartment', { dept: t(`department.${staff.department}`) })}</label>
        <label><input type="radio" checked={target === 'all'} onChange={() => { setTarget('all'); setBody(''); }} /> {t('team.wholeTeam')}</label>
      </fieldset>
      <Field label={t('team.instructions')}><textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} /></Field>
      <Field label={t('team.changeNote')} hint={t('team.changeNoteHint')}><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      <ErrorNote error={a.error} />
      <div className="row gap end"><button className="btn btn-primary" onClick={save} disabled={a.busy || !body.trim()}>{t('team.saveBrief')}</button></div>
      <p className="muted small">{t('team.ackPending')}</p>
    </div>
  );
}

function QuestionItem({ q, onAnswered }: { q: any; onAnswered: () => void }) {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const [answer, setAnswer] = useState(q.recommended_assumption ?? '');
  const a = useAction();
  const send = async () => { const r = await a.run(() => api(`/api/questions/${q.id}/answer`, { method: 'POST', body: { answer } })); if (r) onAnswered(); };
  return (
    <div className="question">
      <p><strong>{q.question}</strong></p>
      <p className="muted small">{t('team.whyItMatters')} {q.why_it_matters}</p>
      {q.answer ? <p><Badge tone="ok">{t('team.answered')}</Badge> {q.answer}</p> : isOwner ? (
        <>
          {q.recommended_assumption && <p className="small">{t('team.recommended')} {q.recommended_assumption}</p>}
          <div className="row gap"><input value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={t('team.yourAnswer')} /><button className="btn btn-primary btn-small" onClick={send} disabled={a.busy || !answer.trim()}>{t('team.sendAnswer')}</button></div>
          <ErrorNote error={a.error} />
        </>
      ) : <Badge tone="pink">{t('team.awaitingAnswer')}</Badge>}
      {q.task_id && <a className="small" href={`#/work/${q.task_id}`} onClick={() => go('work', q.task_id)}>{t('team.openTask')}</a>}
    </div>
  );
}

function EditStaff({ staff, onSaved }: { staff: any; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(staff.display_name);
  const [role, setRole] = useState(staff.role_title);
  const [look, setLook] = useState(JSON.stringify(staff.avatar, null, 2));
  const a = useAction();
  const save = async (extra: Record<string, unknown> = {}) => {
    let avatar: unknown;
    try { avatar = JSON.parse(look); } catch { avatar = undefined; }
    const r = await a.run(() => api(`/api/staff/${staff.id}`, { method: 'PATCH', body: { displayName: name, roleTitle: role, ...(avatar ? { avatar } : {}), ...extra } }));
    if (r) onSaved();
  };
  return (
    <div className="stack">
      <Field label={t('team.name')}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
      <Field label={t('team.role')}><input value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} /></Field>
      <Field label={t('team.appearance')} hint={t('team.appearanceHint')}><textarea rows={6} value={look} onChange={(e) => setLook(e.target.value)} className="mono" /></Field>
      <ErrorNote error={a.error} />
      <div className="row gap end">
        <button className="btn" onClick={() => save({ paused: !staff.paused })} disabled={a.busy}>{staff.paused ? t('team.resume') : t('team.pause')}</button>
        <button className="btn btn-primary" onClick={() => save()} disabled={a.busy || !name.trim()}>{t('common.save')}</button>
      </div>
    </div>
  );
}
