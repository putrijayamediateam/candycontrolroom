import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { fmtDateTime } from '../format';
import { Async, Badge, Card, EvidenceBadge, PageHeader } from '../ui';

const ORDER = ['anthropic', 'google_drive', 'canva', 'meta', 'tiktok', 'gbp', 'google_calendar', 'youtube', 'github'];

export function Integrations() {
  const { t, i18n } = useTranslation();
  const st = useApi<any>('/api/connections');
  return (
    <>
      <PageHeader title={t('nav.integrations')} subtitle={t('integrations.subtitle')} />
      <div className="callout">{t('integrations.chatVsApp')}</div>
      <Async state={st}>
        {(d) => (
          <div className="integration-grid">
            {[...d.connections].sort((a: any, b: any) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).map((c: any) => (
              <Card key={c.id} title={t(`integrations.${c.id}.name`, { defaultValue: c.id })}
                actions={c.status === 'connected' ? <EvidenceBadge kind="verified" /> : c.status === 'skipped' ? <Badge>{t('integrations.skipped')}</Badge> : <EvidenceBadge kind="not_connected" />}>
                <p>{t(`integrations.${c.id}.use`, { defaultValue: '' })}</p>
                <dl className="kv small">
                  <dt>{t('integrations.operations')}</dt><dd>{t(`integrations.${c.id}.ops`, { defaultValue: '—' })}</dd>
                  <dt>{t('integrations.needs')}</dt><dd>{t(`integrations.${c.id}.needs`, { defaultValue: '—' })}</dd>
                  <dt>{t('integrations.cost')}</dt><dd>{t(`integrations.${c.id}.cost`, { defaultValue: t('integrations.costUnknown') })}</dd>
                  <dt>{t('integrations.lastCheck')}</dt><dd>{c.last_check_at ? fmtDateTime(c.last_check_at, i18n.language) : t('integrations.never')}</dd>
                  {c.last_error && <><dt>{t('integrations.lastError')}</dt><dd>{c.last_error}</dd></>}
                </dl>
                <button className="btn btn-small" disabled title={t('integrations.connectLater')}>{t('integrations.connect')}</button>
                <p className="muted small">{t('integrations.connectLater')}</p>
              </Card>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
