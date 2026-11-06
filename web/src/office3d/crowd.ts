/**
 * Moves people around the office in response to office actions. No Three.js here: the
 * scene reads positions from this object every frame. Everyone starts seated at their own
 * desk (the state rebuilt after a refresh) and always returns there after a visit.
 */
import { REVIEW_SEATS, cellBeside, key, toWorld, type Cell, type Layout } from './layout.js';
import { findPath } from './pathfinding.js';
import type { OfficeAction } from './mapping.js';

export type Gesture = 'talk' | 'complete' | 'waiting' | 'blocked';

export interface Body {
  id: string;
  cell: Cell;
  /** World position (x, z) and facing angle (radians, 0 = +z). */
  x: number; z: number; facing: number;
  path: Cell[];
  seated: boolean;
  gesture: Gesture | null; gestureUntil: number;
  workUntil: number;
  /** Seconds to stay after arriving somewhere other than home, then walk back. */
  stayOnArrival: number | null;
  returnAt: number | null;
  /** Where to look while standing at a visit (world x, z). */
  lookAt: [number, number] | null;
  onArrive: Gesture | null;
}

const SPEED = 1.7; // metres per second, an easy walking pace

export class Crowd {
  time = 0;
  bodies = new Map<string, Body>();
  constructor(public layout: Layout, public reducedMotion = false) {}

  /** Adds missing people at their desks and removes people who no longer exist. */
  sync(ids: string[]) {
    for (const id of ids) if (!this.bodies.has(id) && this.layout.desks[id]) this.bodies.set(id, this.atHome(id));
    for (const id of [...this.bodies.keys()]) if (!ids.includes(id)) this.bodies.delete(id);
  }

  setLayout(layout: Layout) {
    this.layout = layout;
    for (const id of [...this.bodies.keys()]) if (!layout.desks[id]) this.bodies.delete(id);
  }

  private atHome(id: string): Body {
    const seat = this.layout.desks[id].seat;
    const [x, z] = toWorld(seat, this.layout);
    return { id, cell: { ...seat }, x, z, facing: Math.PI, path: [], seated: true, gesture: null, gestureUntil: 0, workUntil: 0, stayOnArrival: null, returnAt: null, lookAt: null, onArrive: null };
  }

  /** Cells taken by other people (where they stand or are heading). */
  occupied(except: string): Set<string> {
    const s = new Set<string>();
    for (const b of this.bodies.values()) {
      if (b.id === except) continue;
      s.add(key(b.cell));
      const dest = b.path.at(-1);
      if (dest) s.add(key(dest));
    }
    return s;
  }

  isHome(b: Body) { const seat = this.layout.desks[b.id]?.seat; return !!seat && seat.x === b.cell.x && seat.z === b.cell.z; }

  /** Starts a walk. With reduced motion the person appears at the destination instantly. Returns false if unreachable. */
  moveTo(id: string, goal: Cell): boolean {
    const b = this.bodies.get(id);
    if (!b) return false;
    const midWalk = b.path.length > 0;
    const from = midWalk ? b.path[0] : b.cell;
    const path = findPath(this.layout, from, goal, this.occupied(id)) ?? findPath(this.layout, from, goal);
    if (!path) return false;
    if (midWalk && !this.reducedMotion) { b.seated = false; b.path = path; return true; }
    b.seated = false;
    if (this.reducedMotion) {
      b.path = [];
      b.cell = { ...goal };
      [b.x, b.z] = toWorld(goal, this.layout);
      this.arrive(b);
    } else {
      b.path = path.slice(1);
      if (!b.path.length) this.arrive(b);
    }
    return true;
  }

  private arrive(b: Body) {
    b.returnAt = null;
    if (this.isHome(b)) {
      b.seated = true; b.facing = Math.PI; b.lookAt = null; b.stayOnArrival = null;
    } else {
      if (b.lookAt) b.facing = Math.atan2(b.lookAt[0] - b.x, b.lookAt[1] - b.z);
      if (b.stayOnArrival !== null) { b.returnAt = this.time + b.stayOnArrival; b.stayOnArrival = null; }
    }
    if (b.onArrive) { this.gesture(b.id, b.onArrive, 3); b.onArrive = null; }
  }

  gesture(id: string, g: Gesture, seconds: number) {
    const b = this.bodies.get(id);
    if (!b) return;
    b.gesture = g; b.gestureUntil = this.time + seconds;
  }

  goHome(id: string) {
    const b = this.bodies.get(id);
    const seat = this.layout.desks[id]?.seat;
    if (!b || !seat) return;
    b.lookAt = null; b.stayOnArrival = null; b.returnAt = null;
    if (this.isHome(b) && !b.path.length) { b.seated = true; b.facing = Math.PI; return; }
    if (!this.moveTo(id, seat)) { // never leave someone stranded: put them back at their desk
      Object.assign(b, this.atHome(id), { gesture: b.gesture, gestureUntil: b.gestureUntil, workUntil: b.workUntil });
    }
  }

  apply(a: OfficeAction) {
    switch (a.kind) {
      case 'goto_desk': {
        this.goHome(a.staff);
        const b = this.bodies.get(a.staff);
        if (b && a.work) b.workUntil = this.time + 8;
        break;
      }
      case 'visit_review': {
        const b = this.bodies.get(a.staff);
        if (!b) break;
        const occ = this.occupied(a.staff);
        const seat = REVIEW_SEATS.find((c) => !occ.has(key(c)));
        if (!seat) break;
        const [tx, tz] = toWorld({ x: 15.5, z: 12.5 }, this.layout);
        b.lookAt = [tx, tz]; b.stayOnArrival = a.stay; b.onArrive = null;
        if (!this.moveTo(a.staff, seat)) { b.lookAt = null; b.stayOnArrival = null; }
        break;
      }
      case 'handoff': {
        const from = this.bodies.get(a.from), to = this.bodies.get(a.to);
        if (!from || !to) break;
        const spot = cellBeside(to.cell, from.cell, this.layout, this.occupied(a.from));
        if (!spot) break;
        from.lookAt = [to.x, to.z]; from.stayOnArrival = a.stay; from.onArrive = 'talk';
        if (!this.moveTo(a.from, spot)) { from.lookAt = null; from.stayOnArrival = null; from.onArrive = null; break; }
        break;
      }
      case 'gesture':
        this.gesture(a.staff, a.gesture, a.duration);
        break;
    }
  }

  /** Advances time by dt seconds (callers skip this while animation is paused). */
  update(dt: number) {
    this.time += dt;
    for (const b of this.bodies.values()) {
      if (b.gesture && this.time >= b.gestureUntil) b.gesture = null;
      if (b.path.length) {
        let left = SPEED * dt;
        while (left > 0 && b.path.length) {
          const next = b.path[0];
          const [nx, nz] = toWorld(next, this.layout);
          const dx = nx - b.x, dz = nz - b.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) b.facing = Math.atan2(dx, dz);
          if (d <= left) {
            b.x = nx; b.z = nz; b.cell = { ...next }; b.path.shift(); left -= d;
            if (!b.path.length) this.arrive(b);
          } else {
            b.x += (dx / d) * left; b.z += (dz / d) * left; left = 0;
          }
        }
      } else if (b.returnAt !== null && this.time >= b.returnAt) {
        this.goHome(b.id);
      }
    }
  }

  walking(b: Body) { return b.path.length > 0; }
}
