import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { fmtDateTime } from '../format';
import { Badge, Card, EvidenceBadge, Loading, PageHeader, StageBadge } from '../ui';
import { DEPARTMENTS, OfficePreview } from './office';
import { deriveOffice, type PersonState, type StaffRecord, type TaskRecord, type ThreadRecord } from '../office3d/mapping';
import type { Office3DLabels } from '../office3d/Office3D';

// Three.js and React Three Fiber live in their own chunk, downloaded only when the 3D view is shown.
const Office3D = lazy(() => import('../office3d/Office3D'));

/** True when this browser can create a WebGL context. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const mq = (q: string) => { try { return window.matchMedia(q).matches; } catch { return false; } };
const isPhone = () => mq('(max-width: 767px)');
const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)');
const weakDevice = () => {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4;
};
const PREF_KEY = 'candy.office3d';
function readPrefs(): Partial<{ view: '3d' | '2d'; lowPower: boolean; reducedMotion: boolean }> {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}'); } catch { return {}; }
}
function savePrefs(p: object) { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* storage unavailable */ } }

/** If the 3D view crashes (lost GPU context, driver bug), show the 2D office instead. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('3D office failed, showing 2D office', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function useOfficeData() {
  const st = useApi<{ staff: StaffRecord[] }>('/api/staff');
  const tk = useApi<{ tasks: TaskRecord[] }>('/api/tasks?state=open');
  const th = useApi<{ threads: ThreadRecord[] }>('/api/chat/threads');
  const staff = st.data?.staff ?? null;
  const tasks = tk.data?.tasks ?? [];
  const threads = th.data?.threads ?? [];
  const office = useMemo(() => (staff ? deriveOffice(staff, tasks, threads) : {}), [staff, tasks, threads]);
  return { staff, tasks, office, error: st.error };
}

function useLabels(): Office3DLabels {
  const { t, i18n } = useTranslation();
  return useMemo(() => ({
    marker: { waiting: t('office3d.marker.waiting'), blocked: t('office3d.marker.blocked'), unread: t('office3d.marker.unread') },
    working: t('office3d.activity.working'), paused: t('office3d.activity.paused'), talking: t('office3d.gesture.talk'), done: t('office3d.gesture.complete'),
    zones: Object.fromEntries([...DEPARTMENTS.map((d) => [d, t(`department.${d}`)]), ['studio', t('office3d.studio')]]),
    canvas: t('office3d.canvasLabel'),
    zoneFilter: (zone: string) => t('office3d.zoneFilter', { name: zone }),
  }), [t, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
}

interface ViewState {
  selected: string | null; department: string | null; paused: boolean; reducedMotion: boolean; lowPower: boolean; resetToken: number;
}

function ThreeView({ data, v, set, compact }: { data: ReturnType<typeof useOfficeData>; v: ViewState; set: (p: Partial<ViewState>) => void; compact?: boolean }) {
  const labels = useLabels();
  const { t } = useTranslation();
  if (!data.staff) return <Loading />;
  return (
    <Fallback fallback={<><p className="callout">{t('office3d.failed')}</p><OfficePreview department={v.department ?? undefined} /></>}>
      <Suspense fallback={<div className={`o3d-canvas o3d-loading ${compact ? 'o3d-compact' : ''}`}><Loading /><span className="muted small">{t('office3d.loading')}</span></div>}>
        <Office3D
          staff={data.staff} tasks={data.tasks} office={data.office}
          selected={v.selected} onSelect={(id) => set({ selected: id })}
          department={v.department} onDepartment={(d) => set({ department: d })}
          paused={v.paused} reducedMotion={v.reducedMotion} lowPower={v.lowPower} compact={compact}
          resetToken={v.resetToken} labels={labels}
        />
      </Suspense>
    </Fallback>
  );
}

/** Full-screen office route: #/office (optionally #/office/<staffId> to select someone). */
export function Office({ param }: { param?: string }) {
  const { t } = useTranslation();
  const data = useOfficeData();
  const prefs = readPrefs();
  const [canGL] = useState(webglAvailable);
  const [view, setView] = useState<'3d' | '2d'>(() => (!canGL ? '2d' : prefs.view ?? (isPhone() ? '2d' : '3d')));
  const [v, setV] = useState<ViewState>(() => ({
    selected: param ?? null, department: null, paused: false,
    reducedMotion: prefs.reducedMotion ?? prefersReducedMotion(), lowPower: prefs.lowPower ?? weakDevice(), resetToken: 0,
  }));
  const set = (p: Partial<ViewState>) => setV((o) => ({ ...o, ...p }));
  useEffect(() => { if (param) set({ selected: param }); }, [param]);
  useEffect(() => {
    try {
      const m = window.matchMedia('(prefers-reduced-motion: reduce)');
      const on = () => { if (readPrefs().reducedMotion === undefined) set({ reducedMotion: m.matches }); };
      m.addEventListener('change', on);
      return () => m.removeEventListener('change', on);
    } catch { return undefined; }
  }, []);
  const chooseView = (x: '3d' | '2d') => { setView(x); savePrefs({ view: x }); };

  return (
    <>
      <PageHeader title={t('office3d.title')} subtitle={t('office3d.subtitle')} />
      <div className="o3d-toolbar" role="toolbar" aria-label={t('office3d.controls')}>
        <div className="o3d-seg" role="group" aria-label={t('office3d.viewLabel')}>
          <button type="button" className={`btn btn-small ${view === '3d' ? 'btn-dark' : 'btn-ghost'}`} aria-pressed={view === '3d'} disabled={!canGL} onClick={() => chooseView('3d')}>{t('office3d.view3d')}</button>
          <button type="button" className={`btn btn-small ${view === '2d' ? 'btn-dark' : 'btn-ghost'}`} aria-pressed={view === '2d'} onClick={() => chooseView('2d')}>{t('office3d.view2d')}</button>
        </div>
        <label className="o3d-select">
          <span>{t('office3d.department')}</span>
          <select value={v.department ?? ''} onChange={(e) => set({ department: e.target.value || null })}>
            <option value="">{t('office3d.allDepartments')}</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{t(`department.${d}`)}</option>)}
          </select>
        </label>
        {view === '3d' && (
          <>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => set({ resetToken: v.resetToken + 1 })}>{t('office3d.resetCamera')}</button>
            <button type="button" className="btn btn-small btn-ghost" aria-pressed={v.paused} onClick={() => set({ paused: !v.paused })}>{v.paused ? t('office3d.resume') : t('office3d.pause')}</button>
            <label className="o3d-check"><input type="checkbox" checked={v.reducedMotion} onChange={(e) => { set({ reducedMotion: e.target.checked }); savePrefs({ reducedMotion: e.target.checked }); }} /> {t('office3d.reducedMotion')}</label>
            <label className="o3d-check"><input type="checkbox" checked={v.lowPower} onChange={(e) => { set({ lowPower: e.target.checked }); savePrefs({ lowPower: e.target.checked }); }} /> {t('office3d.lowPower')}</label>
          </>
        )}
      </div>
      {!canGL && <p className="callout">{t('office3d.noWebgl')}</p>}
      {canGL && view === '2d' && isPhone() && <p className="muted small">{t('office3d.phoneHint')}</p>}

      <div className={`o3d-layout ${view === '3d' ? '' : 'o3d-flat'}`}>
        <div className="o3d-stage">
          {view === '3d' ? <ThreeView data={data} v={v} set={set} /> : <OfficePreview department={v.department ?? undefined} />}
          {view === '3d' && <p className="muted small o3d-honesty">{t('office3d.honesty')}</p>}
        </div>
        {view === '3d' && <PersonDetails id={v.selected} data={data} onClose={() => set({ selected: null })} />}
      </div>
    </>
  );
}

function PersonDetails({ id, data, onClose }: { id: string | null; data: ReturnType<typeof useOfficeData>; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const detail = useApi<any>(id ? `/api/staff/${encodeURIComponent(id)}` : null);
  const s = id ? data.staff?.find((x) => x.id === id) : null;
  const st: PersonState | undefined = id ? data.office[id] : undefined;
  if (!s) return <Card title={t('office3d.details')} className="o3d-details"><p className="muted">{t('office3d.selectHint')}</p></Card>;
  const jobs: any[] = detail.data?.tool_jobs ?? [];
  return (
    <Card title={s.display_name} className="o3d-details" actions={<button type="button" className="btn btn-small btn-ghost" onClick={onClose} aria-label={t('office3d.closeDetails')}>×</button>}>
      <div aria-live="polite">
        <p className="muted">{s.role_title}</p>
        <dl className="o3d-dl">
          <dt>{t('office3d.departmentLabel')}</dt><dd>{t(`department.${s.department}`)}</dd>
          <dt>{t('office3d.status')}</dt>
          <dd>
            {s.paused ? <Badge tone="warn">{t('staffStatus.paused')}</Badge> : <Badge>{t(`staffStatus.${s.status}`, { defaultValue: s.status })}</Badge>}
            {st?.markers.includes('waiting') && <> <Badge tone="pink">{t('office3d.marker.waiting')}</Badge></>}
            {st?.markers.includes('blocked') && <> <Badge tone="bad">{t('office3d.marker.blocked')}</Badge></>}
            {st?.markers.includes('unread') && <> <Badge tone="info">{t('office3d.marker.unread')}</Badge></>}
          </dd>
          <dt>{t('office3d.task')}</dt>
          <dd>{st?.task ? <><a href={`#/work/${st.task.id}`}>{st.task.ref}</a> {st.task.title} <StageBadge stage={st.task.stage} /></> : <span className="muted">{t('office3d.noTask')}</span>}</dd>
          {st?.blocker && <><dt>{t('office3d.blocker')}</dt><dd>{st.blocker}</dd></>}
        </dl>
        <h4>{t('office3d.tools')}</h4>
        {detail.loading && !detail.data ? <Loading /> : jobs.length ? (
          <ul className="plain-list compact">
            {jobs.slice(0, 4).map((j) => (
              <li key={j.id}><strong>{j.tool}</strong> <EvidenceBadge kind={j.evidence} /> <Badge>{j.status}</Badge> <span className="muted small">{fmtDateTime(j.created_at, i18n.language)}</span></li>
            ))}
          </ul>
        ) : <p className="muted small"><EvidenceBadge kind="not_connected" /> {t('office3d.noTools')}</p>}
        <p><a href={`#/team/${s.id}`}>{t('office3d.openProfile')}</a></p>
      </div>
    </Card>
  );
}

/** Compact office for the Overview card: 3D when the device can show it, otherwise the 2D list. */
export function OfficeCard() {
  const { t } = useTranslation();
  const data = useOfficeData();
  const [canGL] = useState(webglAvailable);
  const prefs = readPrefs();
  const show3d = canGL && !isPhone() && prefs.view !== '2d';
  const [v, setV] = useState<ViewState>(() => ({
    selected: null, department: null, paused: false,
    reducedMotion: prefs.reducedMotion ?? prefersReducedMotion(), lowPower: prefs.lowPower ?? weakDevice(), resetToken: 0,
  }));
  if (!show3d) return <OfficePreview />;
  const set = (p: Partial<ViewState>) => {
    if (p.selected) { window.location.hash = `#/office/${encodeURIComponent(p.selected)}`; return; }
    setV((o) => ({ ...o, ...p }));
  };
  return (
    <div>
      <ThreeView data={data} v={v} set={set} compact />
      <p className="muted small o3d-honesty">{t('office3d.honesty')}</p>
    </div>
  );
}
