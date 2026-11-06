/**
 * Office floor plan on a walkable grid (1 cell = 1 metre). Pure data and functions:
 * no Three.js here, so the plan and seat assignment can be unit-tested.
 */
export interface Cell { x: number; z: number }
export interface Rect { x: number; z: number; w: number; h: number }

export type FurnitureKind =
  | 'desk' | 'candy_desk' | 'review_table' | 'storyboard_wall' | 'studio_backdrop' | 'studio_light' | 'studio_camera'
  | 'design_board' | 'preview_screen' | 'build_station' | 'server_rack' | 'plant';

export interface Furniture { id: string; kind: FurnitureKind; rect: Rect; zone: string }

export interface Zone { id: string; rect: Rect; kind: 'department' | 'feature' }

export const GRID = { cols: 32, rows: 24 } as const;

export const ZONES: Zone[] = [
  { id: 'strategy_content', rect: { x: 1, z: 1, w: 10, h: 6 }, kind: 'department' },
  { id: 'creative_production', rect: { x: 12, z: 1, w: 12, h: 6 }, kind: 'department' },
  { id: 'studio', rect: { x: 25, z: 1, w: 6, h: 6 }, kind: 'feature' },
  { id: 'publishing_community', rect: { x: 1, z: 9, w: 7, h: 6 }, kind: 'department' },
  { id: 'leadership', rect: { x: 10, z: 8, w: 12, h: 7 }, kind: 'department' },
  { id: 'quality_performance', rect: { x: 24, z: 9, w: 7, h: 6 }, kind: 'department' },
  { id: 'systems', rect: { x: 1, z: 17, w: 5, h: 6 }, kind: 'department' },
  { id: 'designer_team', rect: { x: 7, z: 16, w: 24, h: 7 }, kind: 'department' },
];

/** Desk slots per department: desk occupies (x,z) and (x+1,z); the seat is the cell in front (x, z+1). */
const DESK_SLOTS: Record<string, Cell[]> = {
  strategy_content: [{ x: 2, z: 2 }, { x: 5, z: 2 }, { x: 8, z: 2 }, { x: 2, z: 5 }, { x: 5, z: 5 }],
  creative_production: [{ x: 13, z: 2 }, { x: 16, z: 2 }, { x: 19, z: 2 }, { x: 13, z: 5 }, { x: 16, z: 5 }, { x: 19, z: 5 }],
  publishing_community: [{ x: 2, z: 10 }, { x: 5, z: 10 }, { x: 2, z: 13 }],
  quality_performance: [{ x: 25, z: 10 }, { x: 28, z: 10 }, { x: 25, z: 13 }],
  systems: [{ x: 2, z: 18 }, { x: 2, z: 21 }],
  designer_team: [
    { x: 8, z: 17 }, { x: 11, z: 17 }, { x: 14, z: 17 }, { x: 17, z: 17 },
    { x: 8, z: 20 }, { x: 11, z: 20 }, { x: 14, z: 20 }, { x: 17, z: 20 },
  ],
  leadership: [{ x: 15, z: 9 }],
};

const FIXED: Furniture[] = [
  { id: 'candy-desk', kind: 'candy_desk', rect: { x: 15, z: 9, w: 2, h: 1 }, zone: 'leadership' },
  { id: 'review-table', kind: 'review_table', rect: { x: 13, z: 12, w: 6, h: 2 }, zone: 'leadership' },
  { id: 'storyboard', kind: 'storyboard_wall', rect: { x: 13, z: 0, w: 8, h: 1 }, zone: 'creative_production' },
  { id: 'backdrop', kind: 'studio_backdrop', rect: { x: 26, z: 1, w: 4, h: 1 }, zone: 'studio' },
  { id: 'light-a', kind: 'studio_light', rect: { x: 25, z: 3, w: 1, h: 1 }, zone: 'studio' },
  { id: 'light-b', kind: 'studio_light', rect: { x: 30, z: 3, w: 1, h: 1 }, zone: 'studio' },
  { id: 'camera', kind: 'studio_camera', rect: { x: 28, z: 5, w: 1, h: 1 }, zone: 'studio' },
  { id: 'design-board', kind: 'design_board', rect: { x: 21, z: 16, w: 4, h: 1 }, zone: 'designer_team' },
  { id: 'preview-screen', kind: 'preview_screen', rect: { x: 26, z: 16, w: 4, h: 1 }, zone: 'designer_team' },
  { id: 'build-station', kind: 'build_station', rect: { x: 23, z: 20, w: 3, h: 1 }, zone: 'designer_team' },
  { id: 'rack', kind: 'server_rack', rect: { x: 28, z: 20, w: 1, h: 2 }, zone: 'designer_team' },
  { id: 'plant-1', kind: 'plant', rect: { x: 0, z: 0, w: 1, h: 1 }, zone: 'strategy_content' },
  { id: 'plant-2', kind: 'plant', rect: { x: 31, z: 23, w: 1, h: 1 }, zone: 'designer_team' },
  { id: 'plant-3', kind: 'plant', rect: { x: 9, z: 8, w: 1, h: 1 }, zone: 'leadership' },
  { id: 'plant-4', kind: 'plant', rect: { x: 22, z: 8, w: 1, h: 1 }, zone: 'leadership' },
];

/** Seats around the review table, in the order people take them. */
export const REVIEW_SEATS: Cell[] = [
  { x: 13, z: 11 }, { x: 18, z: 11 }, { x: 13, z: 14 }, { x: 14, z: 14 }, { x: 15, z: 14 },
  { x: 16, z: 14 }, { x: 17, z: 14 }, { x: 18, z: 14 }, { x: 12, z: 12 }, { x: 12, z: 13 }, { x: 19, z: 12 }, { x: 19, z: 13 },
];

export interface StaffLike { id: string; department: string; sort_order?: number }

export interface Desk { staffId: string; desk: Cell; seat: Cell; zone: string }

export interface Layout {
  cols: number; rows: number;
  furniture: Furniture[];
  desks: Record<string, Desk>;
  blocked: Set<string>;
}

export const key = (c: Cell) => `${c.x},${c.z}`;
export const inside = (r: Rect, c: Cell) => c.x >= r.x && c.x < r.x + r.w && c.z >= r.z && c.z < r.z + r.h;

export function cellsOf(r: Rect): Cell[] {
  const out: Cell[] = [];
  for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, z });
  return out;
}

/** Builds the floor plan and gives each staff member a desk in their department (sorted by sort_order). */
export function buildLayout(staff: StaffLike[]): Layout {
  const furniture: Furniture[] = [...FIXED];
  const desks: Record<string, Desk> = {};
  const byDept = new Map<string, StaffLike[]>();
  for (const s of [...staff].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (!byDept.has(s.department)) byDept.set(s.department, []);
    byDept.get(s.department)!.push(s);
  }
  const overflow: StaffLike[] = [];
  for (const [dept, people] of byDept) {
    const slots = DESK_SLOTS[dept] ?? [];
    people.forEach((s, i) => {
      const slot = slots[i];
      if (!slot) { overflow.push(s); return; }
      const desk: Cell = { ...slot };
      if (dept !== 'leadership') furniture.push({ id: `desk-${s.id}`, kind: 'desk', rect: { x: desk.x, z: desk.z, w: 2, h: 1 }, zone: dept });
      desks[s.id] = { staffId: s.id, desk, seat: { x: desk.x, z: desk.z + 1 }, zone: dept };
    });
  }
  const blocked = new Set<string>();
  for (const f of furniture) for (const c of cellsOf(f.rect)) blocked.add(key(c));
  // Anyone without a slot (an unknown department or more staff than desks) stands on a free cell, honestly without a desk.
  const taken = new Set(Object.values(desks).map((d) => key(d.seat)));
  for (const s of overflow) {
    const zone = ZONES.find((z) => z.id === s.department)?.rect ?? ZONES.find((z) => z.id === 'leadership')!.rect;
    const free = cellsOf(zone).find((c) => !blocked.has(key(c)) && !taken.has(key(c)))
      ?? cellsOf({ x: 0, z: 0, w: GRID.cols, h: GRID.rows }).find((c) => !blocked.has(key(c)) && !taken.has(key(c)))!;
    taken.add(key(free));
    desks[s.id] = { staffId: s.id, desk: free, seat: free, zone: s.department };
  }
  return { cols: GRID.cols, rows: GRID.rows, furniture, desks, blocked };
}

/** Zone that contains a cell (department filter by clicking the floor). */
export function zoneAt(c: Cell): string | null {
  return ZONES.find((z) => inside(z.rect, c))?.id ?? null;
}

/** Grid cell centre to world coordinates (the floor is centred on the origin). */
export function toWorld(c: { x: number; z: number }, layout: { cols: number; rows: number }): [number, number] {
  return [c.x - layout.cols / 2 + 0.5, c.z - layout.rows / 2 + 0.5];
}

/** A free cell next to someone, for a handoff visit (prefers the side nearest the visitor). */
export function cellBeside(target: Cell, from: Cell, layout: Layout, occupied: Set<string>): Cell | null {
  const options = [
    { x: target.x + 1, z: target.z }, { x: target.x - 1, z: target.z }, { x: target.x, z: target.z + 1 }, { x: target.x, z: target.z - 1 },
    { x: target.x + 1, z: target.z + 1 }, { x: target.x - 1, z: target.z + 1 },
  ].filter((c) => c.x >= 0 && c.z >= 0 && c.x < layout.cols && c.z < layout.rows && !layout.blocked.has(key(c)) && !occupied.has(key(c)));
  options.sort((a, b) => (Math.abs(a.x - from.x) + Math.abs(a.z - from.z)) - (Math.abs(b.x - from.x) + Math.abs(b.z - from.z)));
  return options[0] ?? null;
}
