import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from './api';
import { go, useRoute } from './App';
import { useSession } from './session';
import { Avatar, Badge, ErrorNote } from './ui';
import { DEPARTMENTS } from './screens/office';

/**
 * AIN's management side panel, beside every screen: CANDY (head) and every staff sub-chat,
 * with status, unread replies, waiting messages, and a quick order box.
 */
export function SidePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const { route, param } = useRoute();
  const st = useApi<any>('/api/chat/threads');
  const threads: any[] = st.data?.threads ?? [];
  const worker = st.data?.worker;
  const active = route === 'chat' ? (param ?? 'candy') : null;
  const head = threads.find((x) => x.id === 'candy');

  const row = (s: any, isHead = false) => (
    <li key={s.id}>
      <a href={`#/chat/${s.id}`} className={`panel-row ${active === s.id ? 'active' : ''} ${isHead ? 'head' : ''}`} aria-current={active === s.id ? 'true' : undefined}>
        <Avatar name={s.display_name} colour={s.colour} size={isHead ? 34 : 26} />
        <span className="panel-name">
          <strong>{s.display_name}</strong>
          <span className="small muted block">{isHead ? t('panel.headRole') : s.last ? (s.last.author_kind === 'human' ? `AIN: ${s.last.body}` : s.last.body) : t(`staffStatus.${s.status}`, { defaultValue: s.status })}</span>
        </span>
        <span className="panel-badges">
          {s.paused && <Badge tone="warn">{t('staffStatus.paused')}</Badge>}
          {s.waiting > 0 && <Badge tone="warn" title={t('panel.waitingTitle')}>{t('panel.waiting', { count: s.waiting })}</Badge>}
          {s.unread > 0 && <span className="unread" aria-label={t('panel.unread', { count: s.unread })}>{s.unread}</span>}
        </span>
      </a>
    </li>
  );

  return (
    <aside className="side-panel" aria-label={t('panel.title')}>
      <div className="panel-head">
        <strong>{t('panel.title')}</strong>
        <button className="btn btn-ghost btn-small" onClick={onClose} aria-label={t('panel.hide')}>✕</button>
      </div>
      <p className={`small worker-line ${worker?.online ? 'on' : 'off'}`}>
        <span aria-hidden="true">{worker?.online ? '●' : '○'}</span> {worker?.online ? t('panel.claudeOn') : t('panel.claudeOff')}
      </p>
      {isOwner && <QuickOrder threads={threads} onSent={st.reload} />}
      <nav className="panel-list">
        {head && <ul>{row(head, true)}</ul>}
        {DEPARTMENTS.filter((d) => d !== 'leadership').map((d) => {
          const people = threads.filter((s) => s.department === d);
          if (!people.length) return null;
          return (
            <div key={d}>
              <h3>{t(`department.${d}`)}</h3>
              <ul>{people.map((s) => row(s))}</ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function QuickOrder({ threads, onSent }: { threads: any[]; onSent: () => void }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState('candy');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const a = useAction();
  const staff = threads.filter((x) => x.id !== 'candy');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    // "via:<id>" = through CANDY; "<id>" = directly to that person.
    const [thread, routeTo] = target.startsWith('via:') ? ['candy', target.slice(4)] : [target, undefined];
    const r = await a.run(() => api(`/api/chat/${thread}`, { method: 'POST', body: { body: text, routeTo } }));
    if (r) { setText(''); setSent(true); onSent(); }
  };
  return (
    <form className="quick-order" onSubmit={send}>
      <select value={target} onChange={(e) => { setTarget(e.target.value); setSent(false); }} aria-label={t('panel.orderTo')}>
        <option value="candy">{t('panel.toCandy')}</option>
        <optgroup label={t('panel.viaCandy')}>{staff.map((s) => <option key={`v${s.id}`} value={`via:${s.id}`}>{t('chat.throughCandyTo', { name: s.display_name })}</option>)}</optgroup>
        <optgroup label={t('panel.direct')}>{staff.map((s) => <option key={s.id} value={s.id}>{t('panel.directTo', { name: s.display_name })}</option>)}</optgroup>
      </select>
      <textarea rows={2} value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} placeholder={t('panel.orderPlaceholder')} aria-label={t('chat.message')} maxLength={10000} />
      <ErrorNote error={a.error} />
      <div className="row gap end">
        {sent && <button type="button" className="btn btn-small btn-ghost" onClick={() => go('chat', target.startsWith('via:') ? 'candy' : target)}>{t('panel.openChat')}</button>}
        <button className="btn btn-small btn-primary" disabled={a.busy || !text.trim()}>{t('chat.send')}</button>
      </div>
    </form>
  );
}
