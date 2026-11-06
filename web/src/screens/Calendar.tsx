import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { useSession } from '../session';
import { fmtTime, myDate } from '../format';
import { Async, Badge, Card, Empty, ErrorNote, PageHeader } from '../ui';

const CANDIDATE_SLOTS = ['12:00', '13:00', '17:00', '20:00'];

export function Calendar() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(myDate());
  const counters = useApi<any>(`/api/counters?date=${date}`);
  const posts = useApi<any>(`/api/posts?date=${date}`);
  const targets = useApi<any>('/api/targets');

  return (
    <>
      <PageHeader title={t('nav.calendar')} subtitle={t('calendar.subtitle')} />
      <div className="row gap wrap filters">
        <label className="field inline-field"><span className="field-label">{t('prs.date')}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <button className="btn btn-small" onClick={() => setDate(myDate())}>{t('prs.today')}</button>
      </div>
      <Card title={t('calendar.dayCounters', { date })}>
        <Async state={counters}>
          {(d) => (
            <div className="table-wrap"><table>
              <thead><tr><th>{t('calendar.platform')}</th><th>{t('calendar.target')}</th><th>{t('calendar.planned')}</th><th>{t('calendar.scheduled')}</th><th>{t('calendar.published')}</th><th>{t('calendar.failed')}</th><th>{t('calendar.manualPending')}</th><th>{t('calendar.shortfall')}</th><th>{t('calendar.stories')}</th></tr></thead>
              <tbody>{d.counters.map((c: any) => (
                <tr key={c.platform}><td>{t(`platform.${c.platform}`)}</td><td>{c.target}</td><td>{c.planned}</td><td>{c.scheduled}</td><td>{c.published}</td><td>{c.failed}</td><td>{c.manualPending}</td>
                  <td>{c.target ? (c.shortfall ? <Badge tone="warn">{c.shortfall}</Badge> : <Badge tone="ok">0</Badge>) : '—'}</td>
                  <td>{c.storiesPublished}/{c.storyTarget}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Async>
        <p className="muted small">{t('calendar.countRules')}</p>
      </Card>
      <Card title={t('calendar.posts')}>
        <Async state={posts}>
          {(d) => d.posts.length === 0 ? <Empty title={t('calendar.noPosts')}>{t('calendar.noPostsHint')}</Empty> : (
            <ul className="plain-list">{d.posts.map((p: any) => (
              <li key={p.id}><strong>{fmtTime(p.slot_at, i18n.language)}</strong> {t(`platform.${p.platform}`)} · {p.format}{p.is_story ? ` · ${t('calendar.story')}` : ''} · <a href={`#/work/${p.task_id}`}>{p.task_ref}</a> {p.title} <Badge>{t(`postStatus.${p.status}`, { defaultValue: p.status })}</Badge></li>
            ))}</ul>
          )}
        </Async>
      </Card>
      <Card title={t('calendar.targetsTitle')}>
        <p className="muted small">{t('calendar.targetsNote')}</p>
        <Async state={targets}>{(d) => <div className="targets">{d.targets.map((x: any) => <TargetRow key={x.platform} x={x} onSaved={targets.reload} />)}</div>}</Async>
      </Card>
    </>
  );
}

function TargetRow({ x, onSaved }: { x: any; onSaved: () => void }) {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const [feed, setFeed] = useState(x.feed_target);
  const [story, setStory] = useState(x.story_target);
  const [count, setCount] = useState(x.stories_count_toward_feed);
  const [slots, setSlots] = useState<string[]>(x.slots);
  const [custom, setCustom] = useState('');
  const a = useAction();
  useEffect(() => { setFeed(x.feed_target); setStory(x.story_target); setCount(x.stories_count_toward_feed); setSlots(x.slots); }, [x]);
  const all = [...new Set([...CANDIDATE_SLOTS, ...slots])].sort();
  const save = async () => {
    const r = await a.run(() => api(`/api/targets/${x.platform}`, { method: 'PUT', body: { feedTarget: Number(feed), storyTarget: Number(story), storiesCountTowardFeed: count, slots } }));
    if (r) onSaved();
  };
  return (
    <fieldset className="target-row" disabled={!isOwner}>
      <legend>{t(`platform.${x.platform}`)}</legend>
      <label className="field inline-field"><span className="field-label">{t('calendar.feedPerDay')}</span><input type="number" min={0} max={20} value={feed} onChange={(e) => setFeed(e.target.value)} /></label>
      <label className="field inline-field"><span className="field-label">{t('calendar.storiesPerDay')}</span><input type="number" min={0} max={20} value={story} onChange={(e) => setStory(e.target.value)} /></label>
      <label><input type="checkbox" checked={count} onChange={(e) => setCount(e.target.checked)} /> {t('calendar.storiesCount')}</label>
      <div className="row gap wrap">
        {all.map((s) => <label key={s} className="pill-check"><input type="checkbox" checked={slots.includes(s)} onChange={() => setSlots(slots.includes(s) ? slots.filter((y) => y !== s) : [...slots, s])} /> {s}</label>)}
        <input className="slot-input" placeholder="HH:MM" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={t('calendar.addSlot')} />
        <button className="btn btn-small" type="button" onClick={() => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(custom)) { setSlots([...new Set([...slots, custom])]); setCustom(''); } }}>{t('calendar.addSlot')}</button>
      </div>
      <ErrorNote error={a.error} />
      {isOwner && <button className="btn btn-small btn-primary" type="button" onClick={save} disabled={a.busy}>{t('common.save')}</button>}
    </fieldset>
  );
}
