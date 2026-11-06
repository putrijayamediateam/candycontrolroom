import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { useDelegation } from '../App';
import { useLive } from '../live';
import { useSession } from '../session';
import { fmtDateTime, myHour, shortTarget } from '../format';
import { Async, Avatar, Badge, Card, Empty, EvidenceBadge, PageHeader, SideStateBadge } from '../ui';
import { OfficePreview } from './office';

export function Overview() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const ov = useApi<any>('/api/overview');
  const targets = useApi<any>('/api/targets');
  const digest = useApi<any>('/api/questions/digest');
  const { data: deleg, showBriefing } = useDelegation();
  const live = useLive();
  const h = myHour();
  const greet = h < 12 ? t('overview.morning') : h < 18 ? t('overview.afternoon') : t('overview.evening');

  return (
    <>
      <PageHeader title={`${greet}, ${user.display_name}`} subtitle={t('overview.subtitle')} />
      {deleg?.unacknowledged_briefings?.length > 0 && (
        <div className="callout callout-pink row gap wrap">
          <span>{t('overview.briefingReady')}</span>
          <button className="btn btn-small btn-primary" onClick={() => showBriefing(deleg.unacknowledged_briefings[0])}>{t('overview.openBriefing')}</button>
        </div>
      )}
      <Async state={ov}>
        {(d) => {
          const awaitingTotal = Object.values(d.awaiting_ain as Record<string, number>).reduce((a, b) => a + b, 0);
          return (
            <div className="overview-grid">
              <Card title={t('overview.candyBriefing')} className="span-2" actions={<span className="muted small">{t('overview.briefingSource')}</span>}>
                <ul className="briefing">
                  <li>{awaitingTotal
                    ? <><strong>{t('overview.needsDecision', { count: awaitingTotal })}</strong> <a href="#/approvals">{t('overview.openInbox')}</a></>
                    : t('overview.nothingToDecide')}</li>
                  <li>{d.open_questions ? <><strong>{t('overview.openQuestions', { count: d.open_questions })}</strong> <a href="#/team">{t('overview.answer')}</a></> : t('overview.noQuestions')}</li>
                  <li>{d.blocked_tasks.length ? <strong>{t('overview.blockedCount', { count: d.blocked_tasks.length })}</strong> : t('overview.noBlocked')}</li>
                  <li>{d.staff_execution.state === 'active'
                    ? t('overview.executionActive', { count: d.staff_execution.running_jobs })
                    : <><EvidenceBadge kind="not_connected" /> {t('overview.executionOffline')}</>}</li>
                  {d.publishing_paused && <li><Badge tone="bad">{t('publishing.pausedBadge')}</Badge> {t('overview.publishingPaused')}</li>}
                </ul>
                {d.blocked_tasks.length > 0 && (
                  <ul className="plain-list compact">
                    {d.blocked_tasks.slice(0, 5).map((b: any) => (
                      <li key={b.id}><a href={`#/work/${b.id}`}>{b.ref}</a> {b.title} <SideStateBadge state={b.side_state} /> <span className="muted">{b.blocker}</span></li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title={t('overview.mode')}>
                <p><Badge tone={d.approval_mode === 'delegated' ? 'pink' : 'neutral'}>{d.approval_mode === 'delegated' ? t('mode.delegated') : t('mode.manual')}</Badge></p>
                <p className="muted">{d.approval_mode === 'delegated' ? t('overview.delegatedExplain') : t('overview.manualExplain')}</p>
              </Card>

              <Card title={t('overview.todayCounters', { date: d.my_date })} className="span-2">
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>{t('calendar.platform')}</th><th>{t('calendar.target')}</th><th>{t('calendar.planned')}</th><th>{t('calendar.scheduled')}</th>
                      <th>{t('calendar.published')}</th><th>{t('calendar.failed')}</th><th>{t('calendar.manualPending')}</th><th>{t('calendar.shortfall')}</th>
                    </tr></thead>
                    <tbody>
                      {d.counters.filter((c: any) => c.target > 0 || ['facebook', 'instagram', 'tiktok', 'threads'].includes(c.platform)).map((c: any) => (
                        <tr key={c.platform}>
                          <td>{t(`platform.${c.platform}`)}</td><td>{c.target}</td><td>{c.planned}</td><td>{c.scheduled}</td>
                          <td>{c.published}</td><td>{c.failed}</td><td>{c.manualPending}</td>
                          <td>{c.shortfall ? <Badge tone="warn">{c.shortfall}</Badge> : <Badge tone="ok">0</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small">{t('overview.countersNote')}</p>
              </Card>

              <Card title={t('overview.slots')}>
                {targets.data ? (
                  <ul className="plain-list compact">
                    {targets.data.targets.filter((x: any) => x.feed_target > 0).map((x: any) => (
                      <li key={x.platform}><strong>{t(`platform.${x.platform}`)}</strong> {x.slots.join(' · ')}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="muted small">{t('overview.slotsNote')}</p>
              </Card>

              <Card title={t('overview.questions')}>
                {digest.data?.digest.length ? (
                  <ul className="plain-list compact">
                    {digest.data.digest.map((g: any) => (
                      <li key={g.taskRef}><strong>{g.taskRef}</strong> {g.title} — {t('overview.questionCount', { count: g.count })}</li>
                    ))}
                  </ul>
                ) : <Empty title={t('overview.noQuestions')} />}
              </Card>

              <Card title={t('overview.activity')}>
                {live.recent.length ? (
                  <ul className="plain-list compact">
                    {live.recent.slice(0, 8).map((e) => (
                      <li key={e.seq}><span className="muted">{fmtDateTime(e.at, i18n.language)}</span> {t(`eventType.${e.type}`, { defaultValue: e.type })} {e.target ? <span className="muted">· {shortTarget(e.target)}</span> : null}</li>
                    ))}
                  </ul>
                ) : <Empty title={t('overview.noLiveActivity')}><a href="#/activity">{t('overview.openLog')}</a></Empty>}
              </Card>

              <Card title={t('overview.office')} className="span-3" actions={<a href="#/team" className="small">{t('overview.openTeam')}</a>}>
                <OfficePreview />
              </Card>
            </div>
          );
        }}
      </Async>
    </>
  );
}

export function StaffChip({ s }: { s: any }) {
  return <span className="staff-chip"><Avatar name={s.display_name} colour={s.colour} size={22} /> {s.display_name}</span>;
}
