import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { fmtDateTime, myDate } from '../format';
import { Async, Badge, DemoBadge, Empty, PageHeader, ReviewBadge, Tabs } from '../ui';

export function DailyPRs() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(myDate());
  const [kind, setKind] = useState<'all' | 'CPR' | 'DPR'>('all');
  const qs = `date=${date}${kind === 'all' ? '' : `&kind=${kind}`}`;
  const st = useApi<any>(`/api/reviews?${qs}`);

  return (
    <>
      <PageHeader title={t('nav.prs')} subtitle={t('prs.subtitle')} actions={<>
        <a className="btn" href={`/api/reviews/export?${qs}&format=csv`} download>{t('prs.exportCsv')}</a>
        <a className="btn" href={`/api/reviews/export?${qs}&format=json`} download>{t('prs.exportJson')}</a>
      </>} />
      <div className="row gap wrap filters">
        <label className="field inline-field"><span className="field-label">{t('prs.date')}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="btn btn-small" onClick={() => setDate(myDate())}>{t('prs.today')}</button>
        <Tabs value={kind} onChange={setKind} items={[{ id: 'all', label: t('prs.all') }, { id: 'CPR', label: t('prs.creative') }, { id: 'DPR', label: t('prs.design') }]} />
      </div>
      <Async state={st}>
        {(d) => d.reviews.length === 0 ? <Empty title={t('prs.empty', { date: d.date })}>{t('prs.emptyHint')}</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>{t('prs.id')}</th><th>{t('prs.item')}</th><th>{t('prs.submittedBy')}</th><th>{t('prs.platform')}</th><th>{t('prs.version')}</th>
                <th>{t('prs.submitted')}</th><th>{t('prs.candy')}</th><th>{t('prs.status')}</th><th>{t('prs.decision')}</th>
              </tr></thead>
              <tbody>
                {d.reviews.map((r: any) => (
                  <tr key={r.id}>
                    <td className="nowrap"><strong>{r.ref}</strong></td>
                    <td><a href={`#/work/${r.task_id}`}>{r.title}</a> <DemoBadge show={r.is_demo} />{r.repo_pr_url && <> · <a href={r.repo_pr_url} target="_blank" rel="noreferrer">{t('prs.repoPr')}</a></>}</td>
                    <td>{r.submitted_by}</td>
                    <td>{r.platform ? t(`platform.${r.platform}`) : t('prs.master')}</td>
                    <td>v{r.version}</td>
                    <td className="nowrap">{fmtDateTime(r.submitted_at, i18n.language)}</td>
                    <td className="small">{r.candy_review ?? <span className="muted">{t('prs.notYet')}</span>}</td>
                    <td><ReviewBadge status={r.status} /></td>
                    <td className="small">{r.decision ? <><Badge tone={r.decision === 'approved' ? 'ok' : 'warn'}>{t(`decision.${r.decision}`)}</Badge> {r.decided_by === 'AIN' ? 'AIN' : t('approvals.byCandyDelegated')}{r.decision_reason ? ` — ${r.decision_reason}` : ''}</> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      <p className="muted small">{t('prs.note')}</p>
    </>
  );
}
