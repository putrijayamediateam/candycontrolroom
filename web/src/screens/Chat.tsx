import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from '../api';
import { go } from '../App';
import { useSession } from '../session';
import { fmtDateTime, fmtTime } from '../format';
import { Async, Avatar, Badge, Card, Empty, ErrorNote, PageHeader } from '../ui';

const HEAD = 'candy';

export function WorkerBanner({ worker }: { worker?: { online: boolean; last_seen: string | null } }) {
  const { t, i18n } = useTranslation();
  if (!worker) return null;
  return worker.online
    ? <div className="worker-banner online" role="status"><span aria-hidden="true">●</span> {t('chat.workerOnline', { time: worker.last_seen ? fmtTime(worker.last_seen, i18n.language) : '—' })}</div>
    : <div className="worker-banner offline" role="status"><span aria-hidden="true">○</span> {t('chat.workerOffline')}{worker.last_seen ? ` ${t('chat.lastSeen', { time: fmtDateTime(worker.last_seen, i18n.language) })}` : ''}</div>;
}

export function Chat({ param }: { param?: string }) {
  const { t } = useTranslation();
  const thread = param ?? HEAD;
  const threads = useApi<any>('/api/chat/threads');
  const me = threads.data?.threads.find((x: any) => x.id === thread);
  const isHead = thread === HEAD;

  return (
    <>
      <PageHeader
        title={isHead ? t('chat.headTitle') : t('chat.subTitle', { name: me?.display_name ?? thread })}
        subtitle={isHead ? t('chat.headSubtitle') : <>{me?.role_title} · {t('chat.subSubtitle')} <a href={`#/team/${thread}`}>{t('chat.openProfile')}</a></>} />
      <WorkerBanner worker={threads.data?.worker} />
      <div className={`chat-layout ${isHead ? 'with-aside' : ''}`}>
        <Conversation thread={thread} staff={me} threads={threads.data?.threads ?? []} />
        {isHead && (
          <aside className="chat-aside">
            <DecisionsLog />
            <TeamMonitor />
          </aside>
        )}
      </div>
    </>
  );
}

function Conversation({ thread, staff, threads }: { thread: string; staff: any; threads: any[] }) {
  const { t, i18n } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>(`/api/chat/${thread}`);
  const [body, setBody] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const a = useAction();
  const bottom = useRef<HTMLDivElement>(null);
  const isHead = thread === HEAD;
  const names = Object.fromEntries(threads.map((x) => [x.id, x]));
  const msgs: any[] = st.data?.messages ?? [];

  useEffect(() => { setBody(''); setRouteTo(''); }, [thread]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, thread]);
  // Opening a chat marks its replies as read.
  useEffect(() => {
    if (isOwner && msgs.some((m) => m.author_kind !== 'human' && !m.read_by_owner_at)) void api(`/api/chat/${thread}/read`, { method: 'POST' }).catch(() => {});
  }, [msgs, thread, isOwner]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!body.trim()) return;
    const r = await a.run(() => api(`/api/chat/${thread}`, { method: 'POST', body: { body, routeTo: isHead && routeTo ? routeTo : undefined } }));
    if (r) { setBody(''); st.reload(); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); };
  const logDecision = async (m: any) => {
    const text = window.prompt(t('chat.decisionPrompt'), m.body);
    if (text?.trim()) await api('/api/decisions', { method: 'POST', body: { body: text.trim(), messageId: m.id } }).catch(() => {});
  };

  return (
    <Card className="conversation">
      {staff?.paused && <div className="callout callout-warn small">{t('chat.paused', { name: staff.display_name })}</div>}
      <div className="messages" aria-live="polite" aria-label={t('chat.messagesLabel')}>
        <Async state={st}>
          {() => msgs.length === 0
            ? <Empty title={isHead ? t('chat.emptyHead') : t('chat.emptySub', { name: staff?.display_name ?? thread })}>{isHead ? t('chat.emptyHeadHint') : t('chat.emptySubHint')}</Empty>
            : <>{msgs.map((m) => {
                const mine = m.author_kind === 'human';
                const author = mine ? null : names[m.author_id];
                return (
                  <div key={m.id} className={`msg ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && <Avatar name={author?.display_name ?? m.author_id} colour={author?.colour ?? '#777'} size={30} />}
                    <div className="bubble">
                      <div className="msg-meta">
                        <strong>{mine ? 'AIN' : author?.display_name ?? m.author_id}</strong>
                        <span className="muted">{fmtDateTime(m.created_at, i18n.language)}</span>
                        {m.kind === 'order' && m.route_to && <Badge tone="pink">{t('chat.orderFor', { name: names[m.route_to]?.display_name ?? m.route_to })}</Badge>}
                        {m.kind === 'relay' && <Badge tone="info">{t('chat.relayed')}</Badge>}
                        {m.kind === 'note' && <Badge>{t('chat.note')}</Badge>}
                        {m.is_demo && <Badge tone="demo">{t('evidence.demo')}</Badge>}
                      </div>
                      <div className="msg-body">{m.body}</div>
                      {mine && (
                        <div className="msg-foot">
                          {m.delivery === 'waiting' && <Badge tone="warn">{t('chat.waiting')}</Badge>}
                          {m.delivery === 'picked_up' && <Badge tone="info">{t('chat.pickedUp')}</Badge>}
                          {m.delivery === 'answered' && <Badge tone="ok">{t('chat.answered')}</Badge>}
                          {isHead && isOwner && <button className="btn btn-small btn-ghost" onClick={() => logDecision(m)}>{t('chat.logDecision')}</button>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}<div ref={bottom} /></>}
        </Async>
      </div>
      {isOwner ? (
        <form className="composer" onSubmit={send}>
          {isHead && (
            <label className="field inline-field">
              <span className="field-label">{t('chat.sendTo')}</span>
              <select value={routeTo} onChange={(e) => setRouteTo(e.target.value)}>
                <option value="">{t('chat.toCandy')}</option>
                {threads.filter((x) => x.id !== HEAD).map((x) => <option key={x.id} value={x.id}>{t('chat.throughCandyTo', { name: x.display_name })}</option>)}
              </select>
            </label>
          )}
          {!isHead && <p className="muted small">{t('chat.directNote', { name: staff?.display_name ?? thread })}</p>}
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} maxLength={10000}
            placeholder={isHead ? (routeTo ? t('chat.placeholderOrder', { name: names[routeTo]?.display_name }) : t('chat.placeholderHead')) : t('chat.placeholderSub', { name: staff?.display_name ?? thread })}
            aria-label={t('chat.message')} />
          <ErrorNote error={a.error} />
          <div className="row gap end"><span className="muted small">{t('chat.ctrlEnter')}</span><button className="btn btn-primary" disabled={a.busy || !body.trim()}>{t('chat.send')}</button></div>
        </form>
      ) : <p className="muted small">{t('common.ownerOnly')}</p>}
    </Card>
  );
}

function DecisionsLog() {
  const { t } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>('/api/decisions');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const a = useAction();
  const add = async () => {
    const r = await a.run(() => api('/api/decisions', { method: 'POST', body: { body: text } }));
    if (r) { setText(''); setOpen(false); st.reload(); }
  };
  return (
    <Card title={t('chat.decisionsTitle')} actions={isOwner && <button className="btn btn-small" onClick={() => setOpen((o) => !o)}>{t('chat.addDecision')}</button>}>
      <p className="muted small">{t('chat.decisionsNote')}</p>
      {open && (
        <div className="stack">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={t('chat.addDecision')} />
          <ErrorNote error={a.error} />
          <div className="row gap end"><button className="btn btn-small btn-primary" onClick={add} disabled={a.busy || !text.trim()}>{t('common.save')}</button></div>
        </div>
      )}
      <Async state={st}>
        {(d) => d.decisions.length === 0 ? <Empty title={t('chat.noDecisions')} /> : (
          <ol className="decisions">
            {d.decisions.map((x: any) => (
              <li key={x.id}><span className="muted small">{String(x.decided_on).slice(0, 10)}{x.source ? ` · ${x.source}` : ''}</span><div className="small">{x.body}</div></li>
            ))}
          </ol>
        )}
      </Async>
    </Card>
  );
}

function TeamMonitor() {
  const { t, i18n } = useTranslation();
  const st = useApi<any>('/api/chat-monitor');
  return (
    <Card title={t('chat.monitorTitle')}>
      <p className="muted small">{t('chat.monitorNote')}</p>
      <Async state={st}>
        {(d) => d.messages.length === 0 ? <Empty title={t('chat.monitorEmpty')} /> : (
          <ul className="plain-list compact small">
            {d.messages.slice(0, 30).map((m: any) => (
              <li key={m.id}>
                <a href={`#/chat/${m.thread}`} onClick={() => go('chat', m.thread)}><strong>{m.thread_name}</strong></a>{' '}
                <span className="muted">{fmtDateTime(m.created_at, i18n.language)} · {m.author_kind === 'human' ? 'AIN' : m.author_id === HEAD ? 'CANDY' : m.author_id}</span>
                <div className="clamp">{m.body}</div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Card>
  );
}
