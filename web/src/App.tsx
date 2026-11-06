import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useAction, useApi } from './api';
import { applyInterfaceLocale } from './i18n';
import { LiveProvider, useLive } from './live';
import { Session, useSession, type User } from './session';
import { Login } from './Login';
import { Onboarding } from './Onboarding';
import { BecomeMePanel, BriefingModal, DelegationBanner } from './delegation';
import { fmtLongDate, fmtTime } from './format';
import { Badge, ErrorNote, Loading } from './ui';
import { Overview } from './screens/Overview';
import { Team } from './screens/Team';
import { WorkBoard } from './screens/WorkBoard';
import { ApprovalInbox } from './screens/ApprovalInbox';
import { DailyPRs } from './screens/DailyPRs';
import { Calendar } from './screens/Calendar';
import { Assets } from './screens/Assets';
import { Community } from './screens/Community';
import { Performance } from './screens/Performance';
import { Integrations } from './screens/Integrations';
import { Activity } from './screens/Activity';
import { DesignerStudio } from './screens/DesignerStudio';
import { Settings } from './screens/Settings';
import { Chat } from './screens/Chat';
import { SidePanel } from './SidePanel';

const PANEL_KEY = 'candy.sidePanel';
const readPanel = () => { try { const v = localStorage.getItem(PANEL_KEY); return v === null ? window.innerWidth >= 1100 : v === 'open'; } catch { return true; } };

// ---------- Hash routing: #/route/param ----------
export function useRoute() {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => setParts(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // CANDY's head chat is the main entry point of the control room.
  return { route: parts[0] ?? 'chat', param: parts[1] ? decodeURIComponent(parts[1]) : undefined };
}
export const go = (route: string, param?: string) => { window.location.hash = `#/${route}${param ? `/${encodeURIComponent(param)}` : ''}`; };

const NAV = [
  { id: 'chat', icon: '✦', C: Chat },
  { id: 'overview', icon: '◎', C: Overview },
  { id: 'team', icon: '☺', C: Team },
  { id: 'work', icon: '▤', C: WorkBoard },
  { id: 'approvals', icon: '✓', C: ApprovalInbox },
  { id: 'prs', icon: '☰', C: DailyPRs },
  { id: 'calendar', icon: '▦', C: Calendar },
  { id: 'assets', icon: '▣', C: Assets },
  { id: 'community', icon: '✉', C: Community },
  { id: 'performance', icon: '↗', C: Performance },
  { id: 'integrations', icon: '⇄', C: Integrations },
  { id: 'activity', icon: '≡', C: Activity },
  { id: 'studio', icon: '✎', C: DesignerStudio },
  { id: 'settings', icon: '⚙', C: Settings },
] as const;

// ---------- Delegation context shared by header, banner and screens ----------
interface DelegationCtx {
  data: any | null;
  reload: () => void;
  openBecomeMe: (source?: 'button' | 'command_input') => void;
  imDone: () => Promise<void>;
  showBriefing: (id: string) => void;
}
const DelegationContext = createContext<DelegationCtx | null>(null);
export const useDelegation = () => useContext(DelegationContext)!;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api<{ user: User }>('/api/me'); setUser(r.user); applyInterfaceLocale(r.user.interface_locale); }
    catch { setUser(null); }
    finally { setChecked(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = () => setUser(null);
    window.addEventListener('candy:unauthenticated', on);
    return () => window.removeEventListener('candy:unauthenticated', on);
  }, []);

  const signOut = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
    setUser(null);
  }, []);
  const setAndApply = useCallback((u: User) => { setUser(u); applyInterfaceLocale(u.interface_locale); }, []);

  if (!checked) return <Loading />;
  if (!user) return <Login onSignedIn={setAndApply} />;
  return (
    <Session.Provider value={{ user, setUser: setAndApply, signOut, isOwner: user.role === 'owner' }}>
      {!user.onboarding_done ? <Onboarding /> : (
        <LiveProvider enabled onSessionEnded={() => setUser(null)}>
          <Shell />
        </LiveProvider>
      )}
    </Session.Provider>
  );
}

function Shell() {
  const { t, i18n } = useTranslation();
  const { user, signOut, isOwner } = useSession();
  const { route, param } = useRoute();
  const live = useLive();
  const deleg = useApi<any>('/api/delegation');
  const overview = useApi<any>('/api/overview');
  const [panel, setPanel] = useState<null | 'button' | 'command_input'>(null);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpenState] = useState(readPanel);
  const setPanelOpen = (open: boolean) => { setPanelOpenState(open); try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed'); } catch { /* storage unavailable */ } };
  const threads = useApi<any>('/api/chat/threads');
  const unreadTotal = (threads.data?.threads ?? []).reduce((n: number, x: any) => n + x.unread, 0);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(i); }, []);
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [route]);

  const imDone = useCallback(async () => {
    const r = await api<any>('/api/delegation/end', { method: 'POST', body: { reason: 'im_done' } });
    deleg.reload();
    if (r.ended) setBriefingId(r.ended.id);
  }, [deleg]);

  const ctx: DelegationCtx = { data: deleg.data, reload: deleg.reload, openBecomeMe: (s = 'button') => setPanel(s), imDone, showBriefing: setBriefingId };
  const active = deleg.data?.active ?? null;
  const Screen = (NAV.find((n) => n.id === route) ?? NAV[0]).C;
  const awaiting = overview.data ? Object.values(overview.data.awaiting_ain as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

  return (
    <DelegationContext.Provider value={ctx}>
      <a className="skip-link" href="#main">{t('common.skipToContent')}</a>
      <div className={`shell ${menuOpen ? 'menu-open' : ''} ${panelOpen ? 'panel-open' : ''}`}>
        <aside className="sidebar" aria-label={t('nav.label')}>
          <div className="brand">
            <img src="/logo.png" alt="" />
            <div><strong>CANDY</strong><span className="script">Control Room</span></div>
          </div>
          <nav>
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={`nav-item ${route === n.id ? 'active' : ''}`} aria-current={route === n.id ? 'page' : undefined}>
                <span className="nav-icon" aria-hidden="true">{n.icon}</span>
                <span>{t(`nav.${n.id}`)}</span>
                {n.id === 'approvals' && awaiting > 0 && <span className="count" aria-label={t('nav.awaitingCount', { count: awaiting })}>{awaiting}</span>}
                {n.id === 'chat' && unreadTotal > 0 && <span className="count" aria-label={t('panel.unread', { count: unreadTotal })}>{unreadTotal}</span>}
              </a>
            ))}
          </nav>
          <div className="sidebar-foot muted">Klinik Putrijaya</div>
        </aside>

        <div className="main-col">
          <header className="topbar">
            <button className="btn btn-ghost menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={t('nav.menu')}>☰</button>
            <div className="topbar-time">
              <strong>{fmtTime(now, i18n.language)}</strong>
              <span className="muted">{fmtLongDate(now, i18n.language)} · MYT</span>
            </div>
            <Badge tone={active ? 'pink' : 'neutral'}>{active ? t('mode.delegated') : t('mode.manual')}</Badge>
            {overview.data?.publishing_paused && <Badge tone="bad">{t('publishing.pausedBadge')}</Badge>}
            {isOwner && <CommandInput onBecomeMe={() => setPanel('command_input')} onImDone={imDone} />}
            {isOwner && (active
              ? <button className="btn btn-dark" onClick={() => void imDone()}>{t('delegation.imDone')}</button>
              : <button className="btn btn-primary" onClick={() => setPanel('button')}>{t('delegation.becomeMe')}</button>)}
            <span className={`live-dot live-${live.status}`} title={t(`live.${live.status}`)}><span aria-hidden="true">●</span> <span className="sr-only-sm">{t(`live.${live.status}`)}</span></span>
            <button className="btn btn-ghost" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen} aria-controls="side-panel">
              {panelOpen ? t('panel.hide') : t('panel.show')}{!panelOpen && unreadTotal > 0 ? ` (${unreadTotal})` : ''}
            </button>
            <button className="btn btn-ghost" onClick={() => void signOut()} title={user.email}>{t('common.signOut')}</button>
          </header>
          <DelegationBanner active={active} onStop={() => void imDone()} />
          <main id="main" className="content" tabIndex={-1}>
            <Screen param={param} />
          </main>
        </div>
        {panelOpen && <div id="side-panel" className="side-panel-wrap"><SidePanel onClose={() => setPanelOpen(false)} /></div>}
      </div>
      <BecomeMePanel open={!!panel} source={panel ?? 'button'} onClose={() => setPanel(null)} onDone={() => { deleg.reload(); overview.reload(); }} />
      <BriefingModal delegationId={briefingId} onClose={() => { setBriefingId(null); deleg.reload(); }} />
    </DelegationContext.Provider>
  );
}

/** Authenticated command input: only the exact phrases BECOME ME and I'M DONE are recognised. */
function CommandInput({ onBecomeMe, onImDone }: { onBecomeMe: () => void; onImDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const a = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await a.run(() => api<any>('/api/commands', { method: 'POST', body: { text } }));
    if (!r) return;
    setText('');
    if (r.command === 'become_me') onBecomeMe();
    if (r.command === 'im_done') await onImDone();
  };
  return (
    <form className="command" onSubmit={submit} role="search">
      <input aria-label={t('command.label')} placeholder={t('command.placeholder')} value={text} onChange={(e) => { setText(e.target.value); a.clear(); }} maxLength={100} />
      {a.error && <div className="command-error"><ErrorNote error={a.error} /></div>}
    </form>
  );
}
