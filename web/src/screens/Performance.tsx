import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useLive } from '../live';
import { myDate } from '../format';
import { Card, EvidenceBadge, Loading, PageHeader } from '../ui';

const CORE = ['facebook', 'instagram', 'tiktok', 'threads'];

/** Only provider-confirmed publication counts. No engagement numbers until analytics are connected. */
export function Performance() {
  const { t } = useTranslation();
  const { tick } = useLive();
  const [rows, setRows] = useState<{ date: string; counters: any[] }[] | null>(null);
  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => myDate(new Date(Date.now() - i * 86_400_000))).reverse();
    Promise.all(days.map((d) => api<any>(`/api/counters?date=${d}`))).then((r) => setRows(r.map((x) => ({ date: x.date, counters: x.counters })))).catch(() => setRows([]));
  }, [tick]);

  return (
    <>
      <PageHeader title={t('nav.performance')} subtitle={t('performance.subtitle')} />
      <Card title={t('performance.published7')}>
        {!rows ? <Loading /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('prs.date')}</th>{CORE.map((p) => <th key={p}>{t(`platform.${p}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.date}><td>{r.date}</td>{CORE.map((p) => {
                const c = r.counters.find((x) => x.platform === p);
                return <td key={p}>{c ? `${c.published}/${c.target}` : '—'}</td>;
              })}</tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="muted small">{t('performance.publishedNote')}</p>
      </Card>
      <Card title={t('performance.engagement')}>
        <p><EvidenceBadge kind="not_connected" /> {t('performance.noAnalytics')}</p>
        <p className="muted small">{t('performance.hakimRule')}</p>
      </Card>
    </>
  );
}
