/**
 * Grid A* pathfinding for the 3D office. Pure: furniture and other people are passed in
 * as blocked cell keys ("x,z"). 4-way moves, plus diagonals only when both sides are open
 * (no corner cutting through desks).
 */
export interface GridCell { x: number; z: number }
export interface PathGrid { cols: number; rows: number; blocked: Set<string> }

const k = (x: number, z: number) => `${x},${z}`;

export function findPath(grid: PathGrid, start: GridCell, goal: GridCell, occupied: Set<string> = new Set()): GridCell[] | null {
  if (start.x === goal.x && start.z === goal.z) return [start];
  const open = (x: number, z: number) =>
    x >= 0 && z >= 0 && x < grid.cols && z < grid.rows && !grid.blocked.has(k(x, z)) && (!occupied.has(k(x, z)) || (x === goal.x && z === goal.z));
  if (!open(goal.x, goal.z)) return null;
  const h = (x: number, z: number) => {
    const dx = Math.abs(x - goal.x), dz = Math.abs(z - goal.z);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const g = new Map<string, number>([[k(start.x, start.z), 0]]);
  const came = new Map<string, string>();
  const nodes = new Map<string, GridCell>([[k(start.x, start.z), start]]);
  const frontier: { key: string; f: number }[] = [{ key: k(start.x, start.z), f: h(start.x, start.z) }];
  const closed = new Set<string>();
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let guard = grid.cols * grid.rows * 8;
  while (frontier.length && guard-- > 0) {
    let best = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i].f < frontier[best].f) best = i;
    const cur = frontier.splice(best, 1)[0];
    if (closed.has(cur.key)) continue;
    closed.add(cur.key);
    const c = nodes.get(cur.key)!;
    if (c.x === goal.x && c.z === goal.z) {
      const path: GridCell[] = [c];
      let at = cur.key;
      while (came.has(at)) { at = came.get(at)!; path.unshift(nodes.get(at)!); }
      return path;
    }
    for (const [dx, dz] of steps) {
      const nx = c.x + dx, nz = c.z + dz;
      if (!open(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!open(c.x + dx, c.z) || !open(c.x, c.z + dz))) continue;
      const nk = k(nx, nz);
      if (closed.has(nk)) continue;
      const cost = (g.get(cur.key) ?? 0) + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, cur.key);
        nodes.set(nk, { x: nx, z: nz });
        frontier.push({ key: nk, f: cost + h(nx, nz) });
      }
    }
  }
  return null;
}
