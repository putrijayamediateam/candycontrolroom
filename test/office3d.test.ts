import { describe, it, expect } from 'vitest';
import { STAFF } from '../src/shared/staff.js';
import { buildLayout, key, REVIEW_SEATS, cellBeside, ZONES, zoneAt } from '../web/src/office3d/layout.js';
import { findPath } from '../web/src/office3d/pathfinding.js';
import { deriveOffice, eventToActions, newEvents, maxSeq, type EventRecord, type MapContext, type StaffRecord, type TaskRecord } from '../web/src/office3d/mapping.js';
import { appearanceFor } from '../web/src/office3d/appearance.js';
import { Crowd } from '../web/src/office3d/crowd.js';
import { overlaps, placeZoneLabels, zoneEdgeCandidates } from '../web/src/office3d/labels.js';

const staff: StaffRecord[] = STAFF.map((s, i) => ({
  id: s.id, display_name: s.name, role_title: s.role, department: s.department, colour: s.colour,
  status: 'idle', paused: false, open_questions: 0, sort_order: i, avatar: s.avatar,
}));
const layout = buildLayout(staff);

describe('3D office floor plan', () => {
  it('gives all 21 staff their own desk in their department, seats on walkable cells', () => {
    expect(Object.keys(layout.desks)).toHaveLength(21);
    const seats = new Set<string>();
    for (const s of staff) {
      const d = layout.desks[s.id];
      expect(d.zone, s.id).toBe(s.department);
      expect(layout.blocked.has(key(d.seat)), `${s.id} seat blocked`).toBe(false);
      expect(seats.has(key(d.seat)), `${s.id} seat shared`).toBe(false);
      seats.add(key(d.seat));
    }
  });

  it('has the Designer Team wing: 8 workstations, review board, preview screen, build/test station', () => {
    const wing = layout.furniture.filter((f) => f.zone === 'designer_team');
    expect(wing.filter((f) => f.kind === 'desk')).toHaveLength(8);
    for (const k of ['design_board', 'preview_screen', 'build_station'] as const) expect(wing.some((f) => f.kind === k), k).toBe(true);
    for (const k of ['candy_desk', 'review_table', 'storyboard_wall', 'studio_backdrop'] as const) expect(layout.furniture.some((f) => f.kind === k), k).toBe(true);
  });

  it('review seats are free and every desk can reach the review table', () => {
    for (const c of REVIEW_SEATS) expect(layout.blocked.has(key(c)), key(c)).toBe(false);
    for (const s of staff) expect(findPath(layout, layout.desks[s.id].seat, REVIEW_SEATS[0]), s.id).not.toBeNull();
  });

  it('maps floor cells to departments for the click filter', () => {
    expect(zoneAt(layout.desks.alex.seat)).toBe('designer_team');
    expect(zoneAt(layout.desks.candy.seat)).toBe('leadership');
    expect(ZONES.filter((z) => z.kind === 'department').map((z) => z.id).sort()).toEqual(
      ['creative_production', 'designer_team', 'leadership', 'publishing_community', 'quality_performance', 'strategy_content', 'systems']);
  });
});

describe('grid pathfinding', () => {
  const grid = { cols: 6, rows: 5, blocked: new Set(['2,0', '2,1', '2,2', '2,3']) };

  it('walks around furniture', () => {
    const p = findPath(grid, { x: 0, z: 0 }, { x: 4, z: 0 })!;
    expect(p[0]).toEqual({ x: 0, z: 0 });
    expect(p.at(-1)).toEqual({ x: 4, z: 0 });
    for (const c of p) expect(grid.blocked.has(key(c))).toBe(false);
    expect(p.some((c) => c.z === 4)).toBe(true);
  });

  it('never cuts a corner between two blocked cells', () => {
    const p = findPath(grid, { x: 1, z: 3 }, { x: 3, z: 4 })!;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (a.x !== b.x && a.z !== b.z) {
        expect(grid.blocked.has(key({ x: b.x, z: a.z }))).toBe(false);
        expect(grid.blocked.has(key({ x: a.x, z: b.z }))).toBe(false);
      }
    }
  });

  it('avoids other people, and fails honestly when there is no way through', () => {
    const p = findPath(grid, { x: 0, z: 0 }, { x: 4, z: 0 }, new Set(['2,4']));
    expect(p).toBeNull();
    const q = findPath({ ...grid, blocked: new Set(['2,0', '2,1', '2,2']) }, { x: 0, z: 0 }, { x: 4, z: 0 }, new Set(['2,4']))!;
    expect(q.some((c) => key(c) === '2,4')).toBe(false);
    expect(findPath(grid, { x: 0, z: 0 }, { x: 2, z: 0 })).toBeNull();
  });

  it('finds a free cell beside someone for a handoff', () => {
    const c = cellBeside(layout.desks.aisha.seat, layout.desks.candy.seat, layout, new Set())!;
    expect(layout.blocked.has(key(c))).toBe(false);
    expect(Math.abs(c.x - layout.desks.aisha.seat.x) + Math.abs(c.z - layout.desks.aisha.seat.z)).toBeLessThanOrEqual(2);
  });
});

describe('stored state → office state (no invented activity)', () => {
  const task = (o: Partial<TaskRecord>): TaskRecord => ({ id: 't1', ref: 'TSK-1', title: 'Poster', stage: 'design', side_state: null, blocker: null, owner_staff: 'mei', updated_at: '2026-11-06T01:00:00Z', ...o });

  it('everyone is idle unless their stored status says working; paused stays paused', () => {
    const s = staff.map((x) => x.id === 'zoe' ? { ...x, status: 'designing' } : x.id === 'ben' ? { ...x, paused: true } : x);
    const o = deriveOffice(s, [task({})], []);
    expect(o.zoe.activity).toBe('working');
    expect(o.ben.activity).toBe('paused');
    expect(o.mei.activity).toBe('idle'); // an assigned task alone is not proof of work
    expect(o.mei.task?.ref).toBe('TSK-1');
    expect(Object.values(o).filter((p) => p.activity === 'working')).toHaveLength(1);
  });

  it('shows waiting and blocked markers from questions, waiting chat messages and side states', () => {
    const s = staff.map((x) => x.id === 'sara' ? { ...x, open_questions: 2 } : x);
    const o = deriveOffice(s, [task({ side_state: 'blocked', blocker: 'Missing price list' }), task({ id: 't2', owner_staff: 'adam', stage: 'published', side_state: 'blocked' })],
      [{ id: 'iman', waiting: 1, unread: 0 }, { id: 'alex', waiting: 0, unread: 3 }]);
    expect(o.sara.markers).toContain('waiting');
    expect(o.iman.markers).toContain('waiting');
    expect(o.mei.markers).toContain('blocked');
    expect(o.mei.blocker).toBe('Missing price list');
    expect(o.adam.markers).toEqual([]); // finished tasks don't block
    expect(o.alex.markers).toEqual(['unread']);
    expect(o.daniel.markers).toEqual([]);
  });
});

describe('live events → office actions', () => {
  const ctx: MapContext = {
    taskOwner: (id) => ({ t1: 'mei', t2: 'ethan' } as Record<string, string>)[id],
    staff: Object.fromEntries(staff.map((s) => [s.id, { paused: s.id === 'ben' }])),
  };
  const ev = (o: Partial<EventRecord>): EventRecord => ({ seq: '1', type: 'x', actor_kind: 'system', actor_id: 'system', task_id: null, target: null, new_state: null, ...o });

  it('stage change → owner walks to own desk and works; finished stage → completion feedback', () => {
    expect(eventToActions(ev({ type: 'task.stage_changed', task_id: 't1', new_state: 'design' }), ctx)).toEqual([{ kind: 'goto_desk', staff: 'mei', work: true }]);
    expect(eventToActions(ev({ type: 'task.stage_changed', task_id: 't1', new_state: 'published' }), ctx)[0]).toMatchObject({ kind: 'gesture', staff: 'mei', gesture: 'complete' });
  });

  it('reviews → review table', () => {
    expect(eventToActions(ev({ type: 'review.submitted', actor_kind: 'staff', actor_id: 'ethan', task_id: 't2' }), ctx)[0]).toMatchObject({ kind: 'visit_review', staff: 'ethan' });
    expect(eventToActions(ev({ type: 'review.candy_completed', actor_kind: 'staff', actor_id: 'candy', task_id: 't2' }), ctx)[0]).toMatchObject({ kind: 'visit_review', staff: 'candy' });
  });

  it('questions, blockers, relays, replies and approvals', () => {
    expect(eventToActions(ev({ type: 'question.asked', actor_kind: 'staff', actor_id: 'sara' }), ctx)[0]).toMatchObject({ gesture: 'waiting', staff: 'sara' });
    expect(eventToActions(ev({ type: 'task.blocked', task_id: 't1' }), ctx)[0]).toMatchObject({ gesture: 'blocked', staff: 'mei' });
    expect(eventToActions(ev({ type: 'chat.order_relayed', actor_kind: 'staff', actor_id: 'candy', target: 'aisha' }), ctx)).toEqual([{ kind: 'handoff', from: 'candy', to: 'aisha', stay: 4 }]);
    expect(eventToActions(ev({ type: 'chat.order_relayed', actor_kind: 'staff', actor_id: 'candy', target: 'candy' }), ctx)).toEqual([]);
    expect(eventToActions(ev({ type: 'chat.staff_replied', actor_kind: 'staff', actor_id: 'alex', target: 'alex' }), ctx)[0]).toMatchObject({ gesture: 'talk', staff: 'alex' });
    expect(eventToActions(ev({ type: 'approval.approved', actor_kind: 'human', actor_id: 'u1', task_id: 't2' }), ctx)[0]).toMatchObject({ gesture: 'complete', staff: 'ethan' });
  });

  it('ignores paused staff, unknown staff and unrelated events', () => {
    expect(eventToActions(ev({ type: 'chat.staff_replied', actor_kind: 'staff', actor_id: 'ben' }), ctx)).toEqual([]);
    expect(eventToActions(ev({ type: 'chat.staff_replied', actor_kind: 'staff', actor_id: 'nobody' }), ctx)).toEqual([]);
    expect(eventToActions(ev({ type: 'auth.login' }), ctx)).toEqual([]);
    expect(eventToActions(ev({ type: 'task.stage_changed', task_id: 'unknown' }), ctx)).toEqual([]);
  });

  it('processes only events newer than the last one seen, oldest first', () => {
    const recent = [{ seq: '12' }, { seq: '11' }, { seq: '9' }];
    expect(maxSeq(recent)).toBe('12');
    expect(newEvents(recent, '9').map((e) => e.seq)).toEqual(['11', '12']);
    expect(newEvents(recent, '12')).toEqual([]);
  });
});

describe('crowd movement', () => {
  const run = (c: Crowd, seconds: number) => { for (let i = 0; i < seconds * 20; i++) c.update(0.05); };

  it('starts everyone seated at their own desk', () => {
    const c = new Crowd(layout);
    c.sync(staff.map((s) => s.id));
    expect(c.bodies.size).toBe(21);
    for (const b of c.bodies.values()) { expect(b.seated).toBe(true); expect(c.isHome(b)).toBe(true); }
  });

  it('walks to the review table, stays, then returns and sits down', () => {
    const c = new Crowd(layout);
    c.sync(staff.map((s) => s.id));
    c.apply({ kind: 'visit_review', staff: 'ethan', stay: 20 });
    const b = c.bodies.get('ethan')!;
    expect(c.walking(b)).toBe(true);
    run(c, 12);
    expect(REVIEW_SEATS.some((s) => s.x === b.cell.x && s.z === b.cell.z)).toBe(true);
    expect(b.seated).toBe(false);
    run(c, 25);
    expect(c.isHome(b)).toBe(true);
    expect(b.seated).toBe(true);
  });

  it('two people visiting at once take different seats; a handoff ends beside the recipient', () => {
    const c = new Crowd(layout);
    c.sync(staff.map((s) => s.id));
    c.apply({ kind: 'visit_review', staff: 'mei', stay: 30 });
    c.apply({ kind: 'visit_review', staff: 'arjun', stay: 30 });
    c.apply({ kind: 'handoff', from: 'candy', to: 'aisha', stay: 30 });
    run(c, 25);
    const mei = c.bodies.get('mei')!, arjun = c.bodies.get('arjun')!, candy = c.bodies.get('candy')!;
    expect(key(mei.cell)).not.toBe(key(arjun.cell));
    const seat = layout.desks.aisha.seat;
    expect(Math.abs(candy.cell.x - seat.x) + Math.abs(candy.cell.z - seat.z)).toBeLessThanOrEqual(2);
    expect(candy.gesture === 'talk' || candy.gestureUntil > 0).toBe(true);
  });

  it('with reduced motion people appear at the destination instantly (no walking)', () => {
    const c = new Crowd(layout, true);
    c.sync(staff.map((s) => s.id));
    c.apply({ kind: 'visit_review', staff: 'lina', stay: 1 });
    const b = c.bodies.get('lina')!;
    expect(c.walking(b)).toBe(false);
    expect(REVIEW_SEATS.some((s) => s.x === b.cell.x && s.z === b.cell.z)).toBe(true);
    c.update(1.5);
    expect(c.isHome(b)).toBe(true);
  });
});

describe('avatar briefs → respectful low-poly look', () => {
  it('reads hijab, hair, skin tone and outfit from the editable brief', () => {
    const iman = STAFF.find((s) => s.id === 'iman')!;
    const a = appearanceFor(iman.id, iman.colour, iman.avatar);
    expect(a.hairStyle).toBe('hijab');
    expect(a.hijabColour).toBe('#f2a7c3');
    const hakim = STAFF.find((s) => s.id === 'hakim')!;
    expect(appearanceFor(hakim.id, hakim.colour, hakim.avatar).glasses).toBe(true);
    const ravi = STAFF.find((s) => s.id === 'ravi')!;
    expect(appearanceFor(ravi.id, ravi.colour, ravi.avatar).beard).toBe(true);
    expect(appearanceFor('x', '#123456', {}).outfit).toBe('#123456');
  });

  it('gives the 21 staff distinct looks', () => {
    const looks = new Set(STAFF.map((s) => { const a = appearanceFor(s.id, s.colour, s.avatar); return `${a.skin}|${a.hairStyle}|${a.hijabColour}|${a.outfit}|${a.accent}`; }));
    expect(looks.size).toBe(21);
  });
});

describe('zone label placement', () => {
  const canvas = { width: 400, height: 300 };
  const size = { width: 80, height: 18 };

  it('keeps a zone label inside the canvas even when its anchor is off the edge', () => {
    const out = placeZoneLabels([{ id: 'systems', size, candidates: [{ x: -30, y: 150 }] }], [], canvas);
    expect(out.systems!.left).toBeGreaterThanOrEqual(0);
    expect(out.systems!.left + size.width).toBeLessThanOrEqual(canvas.width);
    const far = placeZoneLabels([{ id: 'z', size, candidates: [{ x: 450, y: 320 }] }], [], canvas).z!;
    expect(far.left + far.width).toBeLessThanOrEqual(canvas.width);
    expect(far.top + far.height).toBeLessThanOrEqual(canvas.height);
  });

  it('moves off a name tag to the next free edge spot, and never sits on one', () => {
    const tag = { left: 100, top: 100, width: 70, height: 30 };
    const out = placeZoneLabels([{ id: 'a', size, candidates: [{ x: 130, y: 112 }, { x: 300, y: 60 }] }], [tag], canvas);
    expect(out.a!.left).toBe(260);
    expect(overlaps(out.a!, tag)).toBe(false);
  });

  it('hides a zone label when every spot is covered, and zone labels do not overlap each other', () => {
    const tag = { left: 100, top: 100, width: 70, height: 30 };
    expect(placeZoneLabels([{ id: 'a', size, candidates: [{ x: 130, y: 112 }] }], [tag], canvas).a).toBeNull();
    const two = placeZoneLabels([
      { id: 'a', size, candidates: [{ x: 50, y: 50 }] },
      { id: 'b', size, candidates: [{ x: 60, y: 55 }, { x: 250, y: 200 }] },
    ], [], canvas);
    expect(overlaps(two.a!, two.b!)).toBe(false);
  });

  it('offers spots on every edge of a zone', () => {
    const c = zoneEdgeCandidates({ x: 1, z: 17, w: 5, h: 6 });
    expect(c.length).toBeGreaterThanOrEqual(6);
    expect(new Set(c.map((p) => `${p.x},${p.z}`)).size).toBe(c.length);
  });
});
