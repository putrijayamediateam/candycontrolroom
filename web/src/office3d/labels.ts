/**
 * Screen-space placement for zone labels. Pure, so it can be unit-tested.
 * People's name tags win: a zone label moves to another spot on its zone's edge,
 * stays inside the canvas, and is hidden only when no free spot exists.
 */
export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }

const GAP = 2;

export function overlaps(a: Box, b: Box, gap = GAP): boolean {
  return a.left < b.left + b.width + gap && b.left < a.left + a.width + gap && a.top < b.top + b.height + gap && b.top < a.top + a.height + gap;
}

/** A box of `size` centred on `p`, pushed inside the canvas with a margin. */
export function clampedBox(p: Point, size: Size, canvas: Size, margin = 4): Box {
  const left = Math.min(Math.max(p.x - size.width / 2, margin), Math.max(margin, canvas.width - margin - size.width));
  const top = Math.min(Math.max(p.y - size.height / 2, margin), Math.max(margin, canvas.height - margin - size.height));
  return { left, top, width: size.width, height: size.height };
}

export interface ZoneLabelInput { id: string; size: Size; candidates: Point[] }

/**
 * Places each zone label at its first candidate (already projected to screen) that does
 * not collide with a person label or an earlier zone label. Returns null for hidden labels.
 */
export function placeZoneLabels(zones: ZoneLabelInput[], people: Box[], canvas: Size): Record<string, Box | null> {
  const taken = [...people];
  const out: Record<string, Box | null> = {};
  for (const z of zones) {
    let placed: Box | null = null;
    for (const c of z.candidates) {
      const box = clampedBox(c, z.size, canvas);
      if (!taken.some((t) => overlaps(box, t))) { placed = box; break; }
    }
    out[z.id] = placed;
    if (placed) taken.push(placed);
  }
  return out;
}

/** Candidate anchor cells along a zone rectangle's edges (grid units), most preferred first. */
export function zoneEdgeCandidates(r: { x: number; z: number; w: number; h: number }): { x: number; z: number }[] {
  const x0 = r.x - 0.3, x1 = r.x + r.w - 0.7, z0 = r.z - 0.3, z1 = r.z + r.h - 0.7;
  const mx = r.x + r.w / 2 - 0.5, mz = r.z + r.h / 2 - 0.5;
  return [
    { x: x0, z: z1 }, { x: mx, z: z1 }, { x: x1, z: z1 }, // front edge (nearest the camera)
    { x: x0, z: mz }, { x: x1, z: mz },                   // side edges
    { x: x0, z: z0 }, { x: mx, z: z0 }, { x: x1, z: z0 }, // back edge
    { x: mx, z: mz }, { x: mx, z: (mz + z1) / 2 }, { x: (x0 + mx) / 2, z: mz }, { x: (mx + x1) / 2, z: mz }, // inside, last resort
  ];
}
