/**
 * The event-driven 3D office (React Three Fiber). Loaded lazily, so other screens never
 * download Three.js. Everything it shows comes from stored records (props) and committed
 * live events (useLive); it never invents activity.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, invalidate, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import { Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { useLive } from '../live';
import { buildLayout, toWorld, ZONES, type Furniture, type Layout } from './layout';
import { eventToActions, maxSeq, newEvents, type Marker, type PersonState, type StaffRecord, type TaskRecord } from './mapping';
import { appearanceFor, type Appearance } from './appearance';
import { Crowd } from './crowd';
import { placeZoneLabels, zoneEdgeCandidates, type Box, type Size, type ZoneLabelInput } from './labels';

export interface Office3DLabels {
  marker: Record<Marker, string>;
  working: string; paused: string; talking: string; done: string;
  zones: Record<string, string>;
  canvas: string;
  zoneFilter: (zone: string) => string;
}

export interface Office3DProps {
  staff: StaffRecord[];
  tasks: TaskRecord[];
  office: Record<string, PersonState>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  department: string | null;
  onDepartment: (id: string | null) => void;
  paused: boolean;
  reducedMotion: boolean;
  lowPower: boolean;
  compact?: boolean;
  resetToken: number;
  labels: Office3DLabels;
}

const ZONE_TINT: Record<string, string> = {
  leadership: '#fddbec', strategy_content: '#e6effa', creative_production: '#fdeee2', studio: '#fff6ea',
  publishing_community: '#e4f2f6', quality_performance: '#ece6f6', systems: '#eceef1', designer_team: '#efeafc',
};
const ZONE_DEPT: Record<string, string> = { studio: 'creative_production' };

export default function Office3D(p: Office3DProps) {
  const layout = useMemo(() => buildLayout(p.staff), [p.staff.map((s) => `${s.id}:${s.department}:${s.sort_order}`).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const crowd = useMemo(() => new Crowd(layout, p.reducedMotion), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [, force] = useState(0);

  useEffect(() => { crowd.setLayout(layout); crowd.sync(p.staff.map((s) => s.id)); invalidate(); force((n) => n + 1); }, [crowd, layout, p.staff]);
  useEffect(() => { crowd.reducedMotion = p.reducedMotion; }, [crowd, p.reducedMotion]);

  // Live events → actions. Events that arrived before the office opened are not replayed:
  // positions are rebuilt from stored state instead.
  const live = useLive();
  const lastSeq = useRef<string | null | undefined>(undefined);
  const tasksRef = useRef(p.tasks); tasksRef.current = p.tasks;
  const staffRef = useRef(p.staff); staffRef.current = p.staff;
  useEffect(() => {
    if (lastSeq.current === undefined) { lastSeq.current = maxSeq(live.recent); return; }
    const fresh = newEvents(live.recent, lastSeq.current);
    if (!fresh.length) return;
    lastSeq.current = maxSeq(fresh) ?? lastSeq.current;
    const ctx = {
      taskOwner: (id: string) => tasksRef.current.find((t) => t.id === id)?.owner_staff,
      staff: Object.fromEntries(staffRef.current.map((s) => [s.id, { paused: s.paused }])),
    };
    for (const e of fresh) for (const a of eventToActions(e, ctx)) crowd.apply(a);
    invalidate();
  }, [live.recent, crowd]);

  // With reduced motion or pause the canvas renders on demand; a slow tick still lets
  // visits end on time (reduced motion) without continuous animation.
  useEffect(() => {
    if (!p.reducedMotion || p.paused) return;
    const i = window.setInterval(() => invalidate(), 1000);
    return () => clearInterval(i);
  }, [p.reducedMotion, p.paused]);

  const anchors = useRef(new Map<string, Anchor>());

  return (
    <div className={`o3d-canvas ${p.compact ? 'o3d-compact' : ''}`} role="group" aria-label={p.labels.canvas}>
      <Canvas
        key={p.lowPower ? 'low' : 'high'}
        shadows={!p.lowPower}
        dpr={p.lowPower ? 1 : [1, 2]}
        gl={{ antialias: !p.lowPower, powerPreference: p.lowPower ? 'low-power' : 'default' }}
        frameloop={p.paused || p.reducedMotion ? 'demand' : 'always'}
        onPointerMissed={() => p.onSelect(null)}
      >
        <color attach="background" args={['#fbf7f9']} />
        <Scene {...p} layout={layout} crowd={crowd} />
        <Projector anchors={anchors.current} crowd={crowd} />
      </Canvas>
      <Labels {...p} layout={layout} anchors={anchors.current} />
    </div>
  );
}

// ---------- Labels (Aisha): plain DOM buttons over the canvas, so they stay keyboard reachable ----------
interface Anchor {
  el: HTMLElement; staffId?: string; height: number;
  /** Zone labels: candidate world points along the zone's edges, most preferred first. */
  zone?: [number, number, number][];
  size?: Size; sizedAt?: number;
}

/**
 * Projects every label's 3D anchor to screen space each frame (no React re-render).
 * Name tags go where their person is; zone labels then take the first free spot on
 * their zone's edge inside the canvas, or hide when every spot is covered.
 */
function Projector({ anchors, crowd }: { anchors: Map<string, Anchor>; crowd: Crowd }) {
  const v = useMemo(() => new Vector3(), []);
  const frame = useRef(0);
  useFrame(({ camera, size }) => {
    const detail = camera.zoom >= 30 ? '1' : '0';
    const n = ++frame.current;
    const measure = (a: Anchor): Size => {
      // Sizes change only with text, hover or zoom detail; re-measure a few times a second.
      if (!a.size || n - (a.sizedAt ?? 0) > 15) { a.size = { width: a.el.offsetWidth, height: a.el.offsetHeight }; a.sizedAt = n; }
      return a.size;
    };
    const toScreen = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, visible: v.z <= 1 && v.z >= -1 };
    };
    const people: Box[] = [];
    const zones: (ZoneLabelInput & { a: Anchor })[] = [];
    for (const [key, a] of anchors) {
      if (a.zone) { zones.push({ id: key, a, size: measure(a), candidates: a.zone.map(([x, y, z]) => toScreen(x, y, z)) }); continue; }
      const b = a.staffId ? crowd.bodies.get(a.staffId) : undefined;
      if (!b) continue;
      const g = b.gesture ?? '';
      if (a.el.dataset.gesture !== g) a.el.dataset.gesture = g;
      if (a.el.dataset.detail !== detail) a.el.dataset.detail = detail;
      const s = toScreen(b.x, (b.seated ? 2.0 : 2.3) * a.height, b.z);
      const box = measure(a);
      a.el.style.transform = `translate(${(s.x - box.width / 2).toFixed(1)}px, ${(s.y - box.height / 2).toFixed(1)}px)`;
      a.el.style.visibility = s.visible ? '' : 'hidden';
      if (s.visible) people.push({ left: s.x - box.width / 2, top: s.y - box.height / 2, width: box.width, height: box.height });
    }
    const placed = placeZoneLabels(zones, people, size);
    for (const z of zones) {
      const box = placed[z.id];
      if (box) z.a.el.style.transform = `translate(${box.left.toFixed(1)}px, ${box.top.toFixed(1)}px)`;
      z.a.el.style.visibility = box ? '' : 'hidden';
    }
  });
  return null;
}

function Labels(p: Office3DProps & { layout: Layout; anchors: Map<string, Anchor> }) {
  const reg = (key: string, extra: Omit<Anchor, 'el'>) => (el: HTMLElement | null) => {
    if (el) p.anchors.set(key, { el, ...extra }); else p.anchors.delete(key);
    invalidate();
  };
  return (
    <div className="o3d-overlay">
      {!p.compact && ZONES.map((z) => {
        const dept = ZONE_DEPT[z.id] ?? z.id;
        const spots = zoneEdgeCandidates(z.rect).map((c) => { const [x, wz] = toWorld(c, p.layout); return [x, 0.05, wz] as [number, number, number]; });
        const name = p.labels.zones[z.id] ?? z.id;
        return (
          <button key={z.id} ref={reg(`zone:${z.id}`, { zone: spots, height: 1 })} type="button"
            className={`o3d-anchor o3d-zone ${p.department === dept ? 'on' : ''}`} aria-pressed={p.department === dept}
            title={p.labels.zoneFilter(name)} onClick={() => p.onDepartment(p.department === dept ? null : dept)}>
            {name}
          </button>
        );
      })}
      {p.staff.map((s) => {
        if (p.department && p.department !== s.department) return null;
        const st = p.office[s.id];
        const badges: [string, string][] = [];
        if (st?.activity === 'paused') badges.push([p.labels.paused, '']);
        for (const m of st?.markers ?? []) badges.push([p.labels.marker[m], m === 'blocked' ? 'bad' : m === 'waiting' ? 'pink' : '']);
        if (st?.activity === 'working') badges.push([p.labels.working, '']);
        const selected = p.selected === s.id;
        const height = appearanceFor(s.id, s.colour, s.avatar as Record<string, unknown> | null).height;
        return (
          <button key={s.id} ref={reg(`person:${s.id}`, { staffId: s.id, height })} type="button"
            className={`o3d-anchor o3d-label ${selected ? 'on' : ''} ${p.compact ? 'compact' : ''}`} aria-pressed={selected}
            aria-label={[s.display_name, s.role_title, ...badges.map((b) => b[0])].join(', ')}
            data-talk={p.labels.talking} data-done={p.labels.done}
            onClick={() => p.onSelect(s.id)}>
            <span className="o3d-name"><span className="o3d-dot" style={{ background: s.colour }} aria-hidden="true" />{s.display_name}</span>
            {!p.compact && <span className="o3d-role">{s.role_title}</span>}
            <span className="o3d-badges">
              {badges.map(([b, tone]) => <span key={b} className={`o3d-badge ${tone}`}>{b}</span>)}
              <span className="o3d-badge o3d-gesture" aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Scene(p: Office3DProps & { layout: Layout; crowd: Crowd }) {
  const controls = useRef<any>(null);
  useEffect(() => { if (p.resetToken) { controls.current?.reset(); invalidate(); } }, [p.resetToken]);
  useFrame((_, dt) => {
    if (p.paused) return;
    p.crowd.update(p.reducedMotion ? Math.min(dt, 2) : Math.min(dt, 0.1));
  });
  const shadows = !p.lowPower;
  const W = p.layout.cols, D = p.layout.rows;
  // Fit the whole floor in the canvas at first; AIN can zoom in from there.
  const size = useThree((s) => s.size);
  const [fitZoom] = useState(() => Math.max(8, Math.min(size.width / 37, size.height / 27)));

  return (
    <>
      <OrthographicCamera makeDefault position={[26, 24, 26]} zoom={fitZoom} near={-200} far={400} />
      <OrbitControls
        ref={controls} makeDefault target={[0, 0, 0]} enableDamping={!p.reducedMotion}
        enableZoom={!p.compact} enablePan={!p.compact} minZoom={8} maxZoom={80}
        minPolarAngle={0.35} maxPolarAngle={1.25}
      />
      <hemisphereLight args={['#ffffff', '#f3dce7', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[14, 26, 10]} intensity={1.15} castShadow={shadows}
        shadow-mapSize-width={1536} shadow-mapSize-height={1536}
        shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} />

      {/* Floor and walls */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={shadows}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f6f1f3" />
      </mesh>
      <mesh position={[0, 1.2, -D / 2 - 0.05]} receiveShadow={shadows}><boxGeometry args={[W, 2.4, 0.1]} /><meshStandardMaterial color="#fdeaf3" /></mesh>
      <mesh position={[-W / 2 - 0.05, 1.2, 0]} receiveShadow={shadows}><boxGeometry args={[0.1, 2.4, D]} /><meshStandardMaterial color="#fbe1ee" /></mesh>

      {ZONES.map((z) => {
        const dept = ZONE_DEPT[z.id] ?? z.id;
        const [cx, cz] = toWorld({ x: z.rect.x + z.rect.w / 2 - 0.5, z: z.rect.z + z.rect.h / 2 - 0.5 }, p.layout);
        const active = !p.department || p.department === dept;
        return (
          <mesh key={z.id} rotation-x={-Math.PI / 2} position={[cx, 0.002, cz]} receiveShadow={shadows}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); p.onDepartment(p.department === dept ? null : dept); }}>
            <planeGeometry args={[z.rect.w - 0.1, z.rect.h - 0.1]} />
            <meshStandardMaterial color={ZONE_TINT[z.id] ?? '#eeeeee'} transparent opacity={active ? 1 : 0.45} />
          </mesh>
        );
      })}

      {p.layout.furniture.map((f) => (
        <FurniturePiece key={f.id} f={f} layout={p.layout} shadows={shadows}
          dim={!!p.department && p.department !== (ZONE_DEPT[f.zone] ?? f.zone)}
          screenOn={f.kind === 'desk' && (p.office[f.id.slice(5)]?.activity === 'working')} />
      ))}

      {p.staff.map((s) => (
        <Person key={s.id} s={s} state={p.office[s.id]} crowd={p.crowd}
          selected={p.selected === s.id} dim={!!p.department && p.department !== s.department}
          onSelect={p.onSelect} reducedMotion={p.reducedMotion} shadows={shadows} />
      ))}
    </>
  );
}

// ---------- Furniture (Zoe) ----------
const M = ({ c, dim, emissive }: { c: string; dim?: boolean; emissive?: string }) => (
  <meshStandardMaterial color={c} transparent={dim} opacity={dim ? 0.35 : 1} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.6 : 0} />
);

const FurniturePiece = memo(function FurniturePiece({ f, layout, shadows, dim, screenOn }: { f: Furniture; layout: Layout; shadows: boolean; dim: boolean; screenOn: boolean }) {
  const [cx, cz] = toWorld({ x: f.rect.x + f.rect.w / 2 - 0.5, z: f.rect.z + f.rect.h / 2 - 0.5 }, layout);
  const w = f.rect.w, d = f.rect.h;
  const cast = shadows;
  switch (f.kind) {
    case 'desk':
    case 'candy_desk': {
      const top = f.kind === 'candy_desk' ? '#f9a6d0' : '#e9dccf';
      const seat = toWorld({ x: f.rect.x, z: f.rect.z + 1 }, layout);
      return (
        <group>
          <group position={[cx, 0, cz]}>
            <mesh position={[0, 0.74, 0.05]} castShadow={cast} receiveShadow={shadows}><boxGeometry args={[w - 0.2, 0.05, 0.75]} /><M c={top} dim={dim} /></mesh>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
              <mesh key={i} position={[sx * (w / 2 - 0.18), 0.36, 0.05 + sz * 0.3]}><boxGeometry args={[0.05, 0.72, 0.05]} /><M c="#8a7f78" dim={dim} /></mesh>
            ))}
            {(f.kind === 'candy_desk' ? [-0.45, 0.45] : [-0.35]).map((mx, i) => (
              <group key={i} position={[mx, 0.77, -0.15]}>
                <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.05, 0.16, 0.05]} /><M c="#3b3b3b" dim={dim} /></mesh>
                <mesh position={[0, 0.34, 0]} castShadow={cast}><boxGeometry args={[0.6, 0.36, 0.03]} /><M c="#2a2a30" dim={dim} /></mesh>
                <mesh position={[0, 0.34, 0.017]}><planeGeometry args={[0.55, 0.31]} /><M c={screenOn ? '#cfe3ff' : '#40434c'} dim={dim} emissive={screenOn ? '#6fa6ff' : undefined} /></mesh>
                <mesh position={[0, 0.005, 0.32]}><boxGeometry args={[0.42, 0.015, 0.14]} /><M c="#d9d9de" dim={dim} /></mesh>
              </group>
            ))}
          </group>
          {/* chair */}
          <group position={[seat[0], 0, seat[1] + 0.05]}>
            <mesh position={[0, 0.44, 0]} castShadow={cast}><boxGeometry args={[0.46, 0.07, 0.46]} /><M c="#4b4f5c" dim={dim} /></mesh>
            <mesh position={[0, 0.75, 0.22]} castShadow={cast}><boxGeometry args={[0.46, 0.55, 0.06]} /><M c="#4b4f5c" dim={dim} /></mesh>
            <mesh position={[0, 0.21, 0]}><cylinderGeometry args={[0.03, 0.03, 0.42, 6]} /><M c="#777" dim={dim} /></mesh>
            <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.24, 0.24, 0.04, 8]} /><M c="#555" dim={dim} /></mesh>
          </group>
        </group>
      );
    }
    case 'review_table':
      return (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 0.74, 0]} castShadow={cast} receiveShadow={shadows}><boxGeometry args={[w - 0.4, 0.06, d - 0.3]} /><M c="#ffffff" dim={dim} /></mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * (w / 2 - 0.4), 0.36, sz * (d / 2 - 0.3)]}><cylinderGeometry args={[0.05, 0.05, 0.72, 8]} /><M c="#c2306f" dim={dim} /></mesh>
          ))}
          {[-1.6, -0.2, 1.3].map((x, i) => <mesh key={i} position={[x, 0.775, (i % 2 ? 0.25 : -0.2)]} rotation-y={i * 0.3}><boxGeometry args={[0.3, 0.01, 0.4]} /><M c="#fdcae3" dim={dim} /></mesh>)}
        </group>
      );
    case 'storyboard_wall':
      return (
        <group position={[cx, 0, cz - 0.35]}>
          <mesh position={[0, 1.25, 0]} castShadow={cast}><boxGeometry args={[w - 0.2, 1.5, 0.08]} /><M c="#f4ece2" dim={dim} /></mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.75 + (i % 6) * ((w - 1.2) / 5.5), 1.55 - Math.floor(i / 6) * 0.62, 0.05]}>
              <planeGeometry args={[0.85, 0.48]} /><M c={['#ffffff', '#fddbec', '#e6effa', '#fff1d6'][i % 4]} dim={dim} />
            </mesh>
          ))}
        </group>
      );
    case 'studio_backdrop':
      return (
        <group position={[cx, 0, cz - 0.2]}>
          <mesh position={[0, 1.2, 0]} castShadow={cast}><boxGeometry args={[w - 0.2, 2.3, 0.05]} /><M c="#fdcae3" dim={dim} /></mesh>
          <mesh position={[0, 0.01, 0.6]} rotation-x={-Math.PI / 2}><planeGeometry args={[w - 0.2, 1.2]} /><M c="#fde3ef" dim={dim} /></mesh>
        </group>
      );
    case 'studio_light':
      return (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.025, 0.025, 1.6, 6]} /><M c="#333" dim={dim} /></mesh>
          <mesh position={[0, 1.7, 0]} rotation-x={0.4}><boxGeometry args={[0.5, 0.5, 0.18]} /><M c="#fafafa" dim={dim} /></mesh>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.25, 0.25, 0.04, 3]} /><M c="#333" dim={dim} /></mesh>
        </group>
      );
    case 'studio_camera':
      return (
        <group position={[cx, 0, cz]}>
          {[0, 2.1, 4.2].map((r, i) => <mesh key={i} position={[Math.sin(r) * 0.15, 0.6, Math.cos(r) * 0.15]} rotation={[Math.cos(r) * 0.25, 0, -Math.sin(r) * 0.25]}><cylinderGeometry args={[0.02, 0.02, 1.2, 5]} /><M c="#333" dim={dim} /></mesh>)}
          <mesh position={[0, 1.28, 0]} castShadow={cast}><boxGeometry args={[0.3, 0.2, 0.22]} /><M c="#1e1e22" dim={dim} /></mesh>
          <mesh position={[0, 1.28, -0.16]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.12, 10]} /><M c="#111" dim={dim} /></mesh>
        </group>
      );
    case 'design_board':
      return (
        <group position={[cx, 0, cz - 0.3]}>
          <mesh position={[0, 1.3, 0]} castShadow={cast}><boxGeometry args={[w - 0.2, 1.4, 0.06]} /><M c="#ffffff" dim={dim} /></mesh>
          {[[-1.2, 1.5, 0.8, 0.5], [-0.2, 1.5, 0.9, 0.5], [0.9, 1.45, 0.9, 0.6], [-0.9, 0.95, 1.4, 0.3], [0.6, 0.95, 1.2, 0.3]].map(([x, y, bw, bh], i) => (
            <mesh key={i} position={[x, y, 0.035]}><planeGeometry args={[bw, bh]} /><M c={['#efeafc', '#fddbec', '#e6effa', '#f4f4f4', '#fff1d6'][i]} dim={dim} /></mesh>
          ))}
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.08, 0.6, 0.08]} /><M c="#888" dim={dim} /></mesh>
        </group>
      );
    case 'preview_screen':
      return (
        <group position={[cx, 0, cz - 0.3]}>
          <mesh position={[0, 1.4, 0]} castShadow={cast}><boxGeometry args={[w - 0.3, 1.7, 0.08]} /><M c="#1f2027" dim={dim} /></mesh>
          <mesh position={[0, 1.4, 0.045]}><planeGeometry args={[w - 0.5, 1.5]} /><M c="#3a3d48" dim={dim} /></mesh>
          <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.1, 0.56, 0.1]} /><M c="#555" dim={dim} /></mesh>
        </group>
      );
    case 'build_station':
      return (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 0.74, 0]} castShadow={cast} receiveShadow={shadows}><boxGeometry args={[w - 0.2, 0.05, 0.8]} /><M c="#d8dde6" dim={dim} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} position={[s * (w / 2 - 0.2), 0.36, 0]}><boxGeometry args={[0.06, 0.72, 0.7]} /><M c="#8a909c" dim={dim} /></mesh>)}
          {[-0.75, 0, 0.75].map((x, i) => (
            <group key={i} position={[x, 0.77, -0.15]}>
              <mesh position={[0, 0.3, 0]} castShadow={cast}><boxGeometry args={[0.6, 0.36, 0.03]} /><M c="#2a2a30" dim={dim} /></mesh>
              <mesh position={[0, 0.3, 0.017]}><planeGeometry args={[0.55, 0.31]} /><M c="#40434c" dim={dim} /></mesh>
            </group>
          ))}
        </group>
      );
    case 'server_rack':
      return (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 1, 0]} castShadow={cast}><boxGeometry args={[0.8, 2, d - 0.3]} /><M c="#2d3038" dim={dim} /></mesh>
          {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0.41, 0.4 + i * 0.28, 0]}><boxGeometry args={[0.01, 0.12, d - 0.5]} /><M c="#4a4e59" dim={dim} /></mesh>)}
        </group>
      );
    case 'plant':
      return (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 0.2, 0]} castShadow={cast}><cylinderGeometry args={[0.18, 0.14, 0.4, 8]} /><M c="#f9a6d0" dim={dim} /></mesh>
          <mesh position={[0, 0.65, 0]} castShadow={cast}><icosahedronGeometry args={[0.35, 0]} /><M c="#5d9a62" dim={dim} /></mesh>
        </group>
      );
  }
});

// ---------- People (Zoe models, Marcus animates) ----------
interface PersonProps {
  s: StaffRecord; state: PersonState | undefined; crowd: Crowd;
  selected: boolean; dim: boolean; onSelect: (id: string | null) => void;
  reducedMotion: boolean; shadows: boolean;
}

function Person({ s, state, crowd, selected, dim, onSelect, reducedMotion, shadows }: PersonProps) {
  const look = useMemo<Appearance>(() => appearanceFor(s.id, s.colour, s.avatar as Record<string, unknown> | null), [s.id, s.colour, s.avatar]);
  const root = useRef<Group>(null), body = useRef<Group>(null);
  const legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null), head = useRef<Group>(null);
  const ring = useRef<Mesh>(null), done = useRef<Mesh>(null), bubble = useRef<Group>(null);

  useEffect(() => {
    root.current?.traverse((o: Object3D) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m && 'opacity' in m && !o.userData.keepOpacity) { m.transparent = dim; m.opacity = dim ? 0.25 : 1; m.needsUpdate = true; }
    });
    invalidate();
  }, [dim]);

  const working = state?.activity === 'working';
  useFrame(() => {
    const b = crowd.bodies.get(s.id);
    if (!b || !root.current || !body.current) return;
    const t = crowd.time;
    const walking = b.path.length > 0;
    const busy = working || b.workUntil > t;
    root.current.position.set(b.x, 0, b.z + (b.seated ? -0.12 : 0));
    root.current.rotation.y = b.facing;
    body.current.position.y = b.seated ? -0.3 : 0;
    const swing = walking && !reducedMotion ? Math.sin(t * 9) * 0.55 : 0;
    const legBase = b.seated ? -Math.PI / 2 : 0;
    legL.current!.rotation.x = legBase + swing;
    legR.current!.rotation.x = legBase - swing;
    let al = -swing * 0.8, ar = swing * 0.8;
    if (b.seated) { al = -0.95; ar = -0.95; }
    if (b.seated && busy && !reducedMotion) { al += Math.sin(t * 14) * 0.08; ar += Math.cos(t * 14) * 0.08; }
    const g = b.gesture;
    if (g === 'talk') ar = reducedMotion ? -1.3 : -1.1 + Math.sin(t * 6) * 0.35;
    if (g === 'complete') { ar = -2.6; }
    armL.current!.rotation.x = al;
    armR.current!.rotation.x = ar;
    head.current!.rotation.x = g === 'talk' && !reducedMotion ? Math.sin(t * 7) * 0.08 : 0;
    if (ring.current) ring.current.visible = selected;
    if (done.current) {
      done.current.visible = g === 'complete';
      const k = reducedMotion ? 1 : 1 + ((t * 0.8) % 1) * 0.6;
      done.current.scale.set(k, k, k);
    }
    if (bubble.current) bubble.current.position.y = (b.seated ? 1.72 : 2.0) * look.height + (reducedMotion ? 0 : Math.sin(t * 3) * 0.04);
  });

  const select = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(s.id); };
  const markers = state?.markers ?? [];
  const cast = shadows;
  const H = look.height;

  return (
    <group ref={root} onClick={select} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} visible={false} userData={{ keepOpacity: true }}>
        <ringGeometry args={[0.36, 0.46, 24]} /><meshBasicMaterial color="#c2306f" />
      </mesh>
      <mesh ref={done} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} visible={false} userData={{ keepOpacity: true }}>
        <ringGeometry args={[0.42, 0.5, 24]} /><meshBasicMaterial color="#1d6b3a" transparent opacity={0.7} />
      </mesh>
      <group ref={body} scale={[H, H, H]}>
        {/* legs pivot at the hip */}
        {[-0.1, 0.1].map((x, i) => (
          <group key={x} ref={i === 0 ? legL : legR} position={[x, 0.75, 0]}>
            <mesh position={[0, -0.36, 0]} castShadow={cast}><boxGeometry args={[0.15, 0.72, 0.17]} /><meshStandardMaterial color="#2f3340" /></mesh>
            <mesh position={[0, -0.71, 0.05]}><boxGeometry args={[0.16, 0.07, 0.26]} /><meshStandardMaterial color="#1c1c1f" /></mesh>
          </group>
        ))}
        {/* torso with a staff-colour badge so colour is visible but never the only cue */}
        <mesh position={[0, 1.03, 0]} castShadow={cast}><boxGeometry args={[0.44, 0.58, 0.25]} /><meshStandardMaterial color={look.outfit} /></mesh>
        <mesh position={[0.11, 1.15, 0.128]}><boxGeometry args={[0.09, 0.12, 0.01]} /><meshStandardMaterial color={look.accent} /></mesh>
        {[-1, 1].map((side, i) => (
          <group key={side} ref={i === 0 ? armL : armR} position={[side * 0.29, 1.28, 0]}>
            <mesh position={[0, -0.25, 0]} castShadow={cast}><boxGeometry args={[0.12, 0.5, 0.14]} /><meshStandardMaterial color={look.outfit} /></mesh>
            <mesh position={[0, -0.53, 0]}><sphereGeometry args={[0.06, 8, 6]} /><meshStandardMaterial color={look.skin} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.36, 0]}><cylinderGeometry args={[0.06, 0.07, 0.08, 8]} /><meshStandardMaterial color={look.skin} /></mesh>
        <group ref={head} position={[0, 1.5, 0]}>
          <Head look={look} cast={cast} />
        </group>
      </group>

      {/* waiting / blocked markers: shape plus a text badge in the label */}
      <group ref={bubble} position={[0, 2.0 * H, 0]}>
        {markers.includes('blocked') && (
          <mesh position={[markers.includes('waiting') ? -0.18 : 0, 0, 0]} rotation-x={Math.PI / 2} userData={{ keepOpacity: true }}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 8]} /><meshBasicMaterial color="#9b1c1c" />
          </mesh>
        )}
        {markers.includes('waiting') && (
          <mesh position={[markers.includes('blocked') ? 0.18 : 0, 0, 0]} userData={{ keepOpacity: true }}>
            <sphereGeometry args={[0.11, 12, 8]} /><meshBasicMaterial color="#c2306f" />
          </mesh>
        )}
      </group>

    </group>
  );
}

function Head({ look, cast }: { look: Appearance; cast: boolean }) {
  const hair = <meshStandardMaterial color={look.hairColour} />;
  const cap = (r: number) => <mesh position={[0, 0.01, -0.005]} castShadow={cast}><sphereGeometry args={[r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{hair}</mesh>;
  const eyes = (z: number) => (
    <>
      {[-0.05, 0.05].map((x) => <mesh key={x} position={[x, 0.01, z]}><sphereGeometry args={[0.016, 6, 4]} /><meshStandardMaterial color="#1b1410" /></mesh>)}
      {look.glasses && (
        <>
          {[-0.05, 0.05].map((x) => <mesh key={`g${x}`} position={[x, 0.01, z + 0.012]}><torusGeometry args={[0.032, 0.006, 4, 12]} /><meshStandardMaterial color="#222" /></mesh>)}
          <mesh position={[0, 0.01, z + 0.012]}><boxGeometry args={[0.04, 0.008, 0.008]} /><meshStandardMaterial color="#222" /></mesh>
        </>
      )}
    </>
  );
  if (look.hairStyle === 'hijab') {
    const c = look.hijabColour ?? '#7a6a8a';
    return (
      <>
        <mesh position={[0, 0.005, -0.02]} castShadow={cast}><sphereGeometry args={[0.175, 16, 12]} /><meshStandardMaterial color={c} /></mesh>
        <mesh position={[0, -0.005, 0.05]}><sphereGeometry args={[0.13, 14, 10]} /><meshStandardMaterial color={look.skin} /></mesh>
        <mesh position={[0, -0.17, -0.01]} castShadow={cast}><cylinderGeometry args={[0.14, 0.27, 0.22, 14]} /><meshStandardMaterial color={c} /></mesh>
        {eyes(0.175)}
      </>
    );
  }
  return (
    <>
      <mesh castShadow={cast}><sphereGeometry args={[0.15, 16, 12]} /><meshStandardMaterial color={look.skin} /></mesh>
      {eyes(0.142)}
      {look.beard && <mesh position={[0, -0.05, 0.03]}><sphereGeometry args={[0.135, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />{hair}</mesh>}
      {look.hairStyle === 'buzz' && cap(0.153)}
      {look.hairStyle === 'short' && cap(0.16)}
      {look.hairStyle === 'pixie' && <>{cap(0.162)}<mesh position={[0.05, 0.1, 0.09]}><boxGeometry args={[0.16, 0.05, 0.06]} />{hair}</mesh></>}
      {look.hairStyle === 'undercut' && <>{cap(0.154)}<mesh position={[0, 0.13, 0.02]}><boxGeometry args={[0.2, 0.07, 0.24]} />{hair}</mesh></>}
      {look.hairStyle === 'curly' && <>{cap(0.165)}{[[-0.08, 0.12, 0.02], [0.08, 0.12, 0.02], [0, 0.15, -0.04], [0, 0.12, 0.08]].map(([x, y, z], i) => <mesh key={i} position={[x, y, z]}><sphereGeometry args={[0.06, 8, 6]} />{hair}</mesh>)}</>}
      {look.hairStyle === 'long' && <>{cap(0.162)}<mesh position={[0, -0.12, -0.09]} castShadow={cast}><boxGeometry args={[0.3, 0.38, 0.08]} />{hair}</mesh></>}
      {look.hairStyle === 'bob' && <>{cap(0.164)}<mesh position={[0, -0.04, -0.06]}><boxGeometry args={[0.33, 0.2, 0.16]} />{hair}</mesh></>}
      {look.hairStyle === 'ponytail' && <>{cap(0.162)}<mesh position={[0, 0.02, -0.17]}><sphereGeometry args={[0.05, 8, 6]} />{hair}</mesh><mesh position={[0, -0.1, -0.19]}><cylinderGeometry args={[0.035, 0.02, 0.22, 6]} />{hair}</mesh></>}
      {look.hairStyle === 'braid' && <>{cap(0.162)}<mesh position={[0, -0.2, -0.16]}><cylinderGeometry args={[0.03, 0.02, 0.45, 6]} />{hair}</mesh></>}
      {look.hairStyle === 'locs' && <>{cap(0.165)}<mesh position={[0, 0.06, -0.17]}><sphereGeometry args={[0.07, 8, 6]} />{hair}</mesh>{[-0.05, 0, 0.05].map((x) => <mesh key={x} position={[x, -0.06, -0.19]}><cylinderGeometry args={[0.018, 0.018, 0.2, 5]} />{hair}</mesh>)}</>}
    </>
  );
}
