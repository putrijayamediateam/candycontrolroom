import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface LiveEvent {
  seq: string; at: string; actor_kind: string; actor_id: string; on_behalf_of: string | null; type: string;
  task_id: string | null; target: string | null; version_id: string | null; prev_state: string | null; new_state: string | null;
  reason: string | null; data: Record<string, any>; is_demo: boolean;
}

interface LiveState {
  /** Increments (debounced) whenever committed events arrive; screens reload on change. */
  tick: number;
  status: 'connecting' | 'live' | 'reconnecting' | 'off';
  recent: LiveEvent[];
}

const Ctx = createContext<LiveState>({ tick: 0, status: 'off', recent: [] });
export const useLive = () => useContext(Ctx);

/**
 * Opens the server event stream. The browser's EventSource reconnects by itself and sends
 * Last-Event-ID, so the server replays anything missed; duplicates are dropped by seq.
 */
export function LiveProvider({ enabled, children, onSessionEnded }: { enabled: boolean; children: ReactNode; onSessionEnded: () => void }) {
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<LiveState['status']>('off');
  const [recent, setRecent] = useState<LiveEvent[]>([]);
  const seen = useRef(new Set<string>());
  const timer = useRef<number | null>(null);
  const endRef = useRef(onSessionEnded);
  endRef.current = onSessionEnded;

  useEffect(() => {
    if (!enabled) { setStatus('off'); return; }
    setStatus('connecting');
    const es = new EventSource('/api/events/stream');
    const bump = () => {
      if (timer.current) return;
      timer.current = window.setTimeout(() => { timer.current = null; setTick((t) => t + 1); }, 250);
    };
    es.addEventListener('ready', () => setStatus('live'));
    es.addEventListener('replay_done', () => { setStatus('live'); bump(); });
    es.addEventListener('candy', (m) => {
      const e = JSON.parse((m as MessageEvent).data) as LiveEvent;
      if (seen.current.has(e.seq)) return;
      seen.current.add(e.seq);
      if (seen.current.size > 5000) seen.current = new Set([...seen.current].slice(-1000));
      setRecent((r) => [e, ...r].slice(0, 60));
      bump();
    });
    es.addEventListener('session_ended', () => { es.close(); endRef.current(); });
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'off' : 'reconnecting');
    es.onopen = () => setStatus('live');
    return () => { es.close(); if (timer.current) clearTimeout(timer.current); timer.current = null; };
  }, [enabled]);

  return <Ctx.Provider value={{ tick, status, recent }}>{children}</Ctx.Provider>;
}
