import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { Card, Empty, EvidenceBadge, PageHeader } from '../ui';

export function Community() {
  const { t } = useTranslation();
  const conns = useApi<any>('/api/connections');
  const sources = ['meta', 'tiktok', 'gbp'];
  return (
    <>
      <PageHeader title={t('nav.community')} subtitle={t('community.subtitle')} />
      <Card title={t('community.sources')}>
        <ul className="plain-list">
          {sources.map((id) => {
            const c = conns.data?.connections.find((x: any) => x.id === id);
            return <li key={id}><strong>{t(`integrations.${id}.name`)}</strong> {c?.status === 'connected' ? <EvidenceBadge kind="verified" /> : <EvidenceBadge kind="not_connected" />}</li>;
          })}
        </ul>
        <Empty title={t('community.empty')}>{t('community.emptyHint')}</Empty>
      </Card>
      <Card title={t('community.rulesTitle')}>
        <ul>
          <li>{t('community.rule1')}</li><li>{t('community.rule2')}</li><li>{t('community.rule3')}</li><li>{t('community.rule4')}</li>
        </ul>
      </Card>
    </>
  );
}
