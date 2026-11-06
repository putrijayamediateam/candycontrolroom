import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useApi } from '../api';
import { useDelegation } from '../App';
import { useLive } from '../live';
import { fmtDateTime, shortTarget } from '../format';
import { Async, Badge, Card, DemoBadge, Empty, ErrorNote, Loading, PageHeader, Tabs } from '../ui';

const FILTERS = ['', 'task.', 'review.', 'approval.', 'delegation.', 'post.', 'staff.', 'question.', 'settings.', 'auth.'];

export function Activity() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'log' | 'delegation'>('log');
  return (
    <>
      <PageHeader title={t('nav.activity')} subtitle={t('activity.subtitle')} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'log', label: t('activity.log') }, { id: 'delegation', label: t('activity.delegations') }]} />
      {tab === 'log' ? <EventLog /> : <DelegationHistory />}
    </>
  );
}

function EventLog() {
  const { t, i18n } = useTranslation();
  const { tick } = useLive();
  const [type, setType] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [err, setErr] = useState<any>(null);
  const load = async (before?: string) => {
    try {
      const r = await api<any>(`/api/events?limit=100${type ? `&type=${encodeURIComponent(type)}` : ''}${before ? `&before=${before}` : ''}`);
      setRows((old) => before ? [...(old ?? []), ...r.events] : r.events); setNext(r.next_before); setErr(null);
    } catch (e) { setErr(e); }
  };
  useEffect(() => { void load(); }, [type, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <label className="field inline-field"><span className="field-label">{t('activity.filter')}</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {FILTERS.map((f) => <option key={f} value={f}>{f ? t(`activity.type_${f.replace('.', '')}`) : t('activity.allTypes')}</option>)}
        </select>
      </label>
      <ErrorNote error={err} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title={t('activity.empty')} /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>{t('activity.when')}</th><th>{t('activity.who')}</th><th>{t('activity.what')}</th><th>{t('activity.target')}</th><th>{t('activity.detail')}</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.seq}>
              <td className="muted small">{e.seq}</td>
              <td className="nowrap small">{fmtDateTime(e.at, i18n.language)}</td>
              <td className="small">{e.actor_kind === 'candy_delegated' ? <Badge tone="pink">{t('approvals.byCandyDelegated')}</Badge> : e.actor_kind === 'human' ? 'AIN' : e.actor_kind === 'system' ? t('activity.system') : e.actor_id}</td>
              <td>{t(`eventType.${e.type}`, { defaultValue: e.type })} <DemoBadge show={e.is_demo} /></td>
              <td className="small">{e.task_id ? <a href={`#/work/${e.task_id}`}>{shortTarget(e.target) || t('activity.task')}</a> : shortTarget(e.target)}</td>
              <td className="small">{[e.prev_state && `${e.prev_state} →`, e.new_state, e.reason].filter(Boolean).join(' ')}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {next && <button className="btn" onClick={() => load(next)}>{t('activity.loadMore')}</button>}
    </Card>
  );
}

function DelegationHistory() {
  const { t, i18n } = useTranslation();
  const st = useApi<any>('/api/delegation');
  const { showBriefing } = useDelegation();
  return (
    <Card>
      <Async state={st}>
        {(d) => d.recent.length === 0 ? <Empty title={t('activity.noDelegations')}>{t('activity.noDelegationsHint')}</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('activity.started')}</th><th>{t('activity.ended')}</th><th>{t('activity.scope')}</th><th>{t('activity.endReason')}</th><th></th></tr></thead>
            <tbody>{d.recent.map((s: any) => (
              <tr key={s.id}>
                <td className="small nowrap">{fmtDateTime(s.starts_at, i18n.language)}</td>
                <td className="small nowrap">{s.revoked_at ? fmtDateTime(s.revoked_at, i18n.language) : <Badge tone="pink">{t('activity.activeNow')}</Badge>}</td>
                <td className="small">{s.scope.actions.map((a: string) => t(`action.${a}`)).join(', ')} · {s.scope.platforms.map((p: string) => t(`platform.${p}`)).join(', ')}</td>
                <td className="small">{s.revoked_reason ? t(`briefing.reason_${s.revoked_reason}`) : '—'}</td>
                <td><button className="btn btn-small" onClick={() => showBriefing(s.id)}>{t('activity.viewBriefing')}</button>{s.revoked_at && !s.briefing_acknowledged_at && <Badge tone="warn">{t('activity.unread')}</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Async>
    </Card>
  );
}
