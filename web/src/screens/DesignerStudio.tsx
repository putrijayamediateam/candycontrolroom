import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { useSession } from '../session';
import { myDate } from '../format';
import { Async, Avatar, Badge, Card, Empty, EvidenceBadge, PageHeader, ReviewBadge, SideStateBadge, StageBadge } from '../ui';
import { NewTaskModal } from './WorkBoard';

const FLOW = ['request', 'ux_brief', 'design', 'candy_design_review', 'ain_design_approval', 'implementation', 'testing', 'candy_release_review', 'ain_release_approval', 'released_verified'];

export function DesignerStudio() {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const staff = useApi<any>('/api/staff');
  const tasks = useApi<any>('/api/tasks?kind=design_dev&state=all');
  const dprs = useApi<any>(`/api/reviews?date=${myDate()}&kind=DPR`);
  const conns = useApi<any>('/api/connections');
  const [creating, setCreating] = useState(false);
  const github = conns.data?.connections.find((c: any) => c.id === 'github');

  return (
    <>
      <PageHeader title={t('nav.studio')} subtitle={t('studio.subtitle')} actions={isOwner && <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('studio.newRequest')}</button>} />
      <Card title={t('studio.roster')}>
        <Async state={staff}>
          {(d) => (
            <div className="studio-roster">
              {d.staff.filter((s: any) => s.department === 'designer_team').map((s: any) => (
                <a key={s.id} href={`#/team/${s.id}`} className="studio-member">
                  <Avatar name={s.display_name} colour={s.colour} size={36} />
                  <span><strong>{s.display_name}</strong><span className="small muted block">{s.role_title}</span></span>
                  <span className="row gap wrap"><Badge>{t(`onboardingState.${s.onboarding}`)}</Badge><Badge>{t(`staffStatus.${s.status}`, { defaultValue: s.status })}</Badge>
                    {s.open_tasks > 0 && <Badge tone="info">{t('studio.openTasks', { count: s.open_tasks })}</Badge>}</span>
                </a>
              ))}
            </div>
          )}
        </Async>
        <p className="muted small">{t('studio.reporting')}</p>
      </Card>

      <Card title={t('studio.workflow')}>
        <ol className="steps">{FLOW.map((s) => <li key={s}>{t(`stage.${s}`)}</li>)}</ol>
        <p className="muted small">{t('studio.gatesNote')}</p>
      </Card>

      <div className="grid-2">
        <Card title={t('studio.backlog')}>
          <Async state={tasks}>
            {(d) => d.tasks.length === 0 ? <Empty title={t('studio.emptyBacklog')}>{t('studio.emptyBacklogHint')}</Empty> : (
              <ul className="plain-list">{d.tasks.map((x: any) => (
                <li key={x.id}><a href={`#/work/${x.id}`}>{x.ref}</a> {x.title} <StageBadge stage={x.stage} /> <SideStateBadge state={x.side_state} /></li>
              ))}</ul>
            )}
          </Async>
        </Card>
        <Card title={t('studio.todayDprs')}>
          <Async state={dprs}>
            {(d) => d.reviews.length === 0 ? <Empty title={t('studio.noDprs')} /> : (
              <ul className="plain-list">{d.reviews.map((r: any) => <li key={r.id}><strong>{r.ref}</strong> {r.title} <ReviewBadge status={r.status} /></li>)}</ul>
            )}
          </Async>
          <p className="small">{t('studio.repo')} {github?.status === 'connected' ? <EvidenceBadge kind="verified" /> : <EvidenceBadge kind="not_connected" />}</p>
          <p className="muted small">{t('studio.noFakePrs')}</p>
        </Card>
      </div>
      <Card title={t('studio.tools')}>
        <p className="muted small">{t('studio.toolsNote')}</p>
        <ul className="plain-list compact small">
          <li><EvidenceBadge kind="verified" /> {t('studio.toolClaudeCode')}</li>
          <li><EvidenceBadge kind="suggested" /> {t('studio.toolFigma')}</li>
          <li><EvidenceBadge kind="suggested" /> {t('studio.toolBlender')}</li>
          <li><EvidenceBadge kind="not_connected" /> {t('studio.toolGithub')}</li>
          <li><EvidenceBadge kind="not_connected" /> {t('studio.toolHosting')}</li>
        </ul>
      </Card>
      <NewTaskModal open={creating} onClose={() => setCreating(false)} designOnly />
    </>
  );
}
