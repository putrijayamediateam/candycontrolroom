import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { fmtDateTime } from '../format';
import { Async, Badge, DemoBadge, Empty, PageHeader, ReviewBadge } from '../ui';

export function Assets() {
  const { t, i18n } = useTranslation();
  const st = useApi<any>('/api/library');
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader title={t('nav.assets')} subtitle={t('assets.subtitle')} />
      <div className="row gap filters"><input type="search" placeholder={t('assets.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('assets.search')} /></div>
      <Async state={st}>
        {(d) => {
          const items = d.assets.filter((a: any) => !q || `${a.key} ${a.title} ${a.task_ref}`.toLowerCase().includes(q.toLowerCase()));
          return items.length === 0 ? <Empty title={t('assets.empty')}>{t('assets.emptyHint')}</Empty> : (
            <div className="asset-grid">
              {items.map((a: any) => (
                <figure key={`${a.version_id}-${a.key}`} className="asset">
                  {a.available && a.mime?.startsWith('image/') ? <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.title} loading="lazy" /></a>
                    : a.available && a.mime?.startsWith('video/') ? <video src={a.url} controls />
                    : <div className="asset-missing">{a.available ? <a href={a.url}>{t('work.openFile')}</a> : t('assets.fileMissing')}</div>}
                  <figcaption>
                    <a href={`#/work/${a.task_id}`}><strong>{a.title}</strong></a>
                    <span className="muted small block">{a.task_ref} · v{a.version} · {a.content_locale.toUpperCase()} · {fmtDateTime(a.created_at, i18n.language)}</span>
                    <span className="row gap wrap">{a.review_status && <ReviewBadge status={a.review_status} />}<DemoBadge show={a.is_demo} />{!a.available && <Badge tone="warn">{t('assets.fileMissing')}</Badge>}</span>
                    <span className="muted small mono block">{a.key}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          );
        }}
      </Async>
      <p className="muted small">{t('assets.uploadNote')}</p>
    </>
  );
}
