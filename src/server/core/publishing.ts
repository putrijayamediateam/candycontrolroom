import type { Db } from '../db/pool.js';
import { tx } from '../db/pool.js';
import { myDate } from '../../shared/time.js';
import { PolicyError, emit, type Actor } from './workflow.js';
import { authorizeSideEffect } from './approvals.js';

/** A real provider adapter must confirm outcomes; adapters exist only for connected, verified accounts. */
export interface PublishAdapter {
  platform: string;
  capabilities: Record<string, boolean>;          // e.g. { feed_image: true, story: false }
  publish(p: { idempotencyKey: string; versionId: string; format: string }): Promise<{ providerPostId: string; confirmed: boolean }>;
  /** Look up whether a publish with this key already happened (for ambiguous outcomes). */
  lookup(idempotencyKey: string): Promise<{ providerPostId: string } | null>;
}

export async function schedulePost(db: Db, actor: Actor, input: { taskId: string; versionId: string; platform: string; format: string; isStory?: boolean; slotAt: Date }) {
  return tx(db, async (c) => {
    const auth = await authorizeSideEffect(c, input.versionId, 'schedule');
    if (!auth.ok) throw new PolicyError('not_authorized', auth.reason);
    const key = `${input.versionId}:${input.platform}:${input.format}:${input.slotAt.toISOString()}`;
    const r = await c.query(
      `INSERT INTO platform_posts (task_id, version_id, platform, format, is_story, slot_at, my_date, status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
      [input.taskId, input.versionId, input.platform, input.format, input.isStory ?? false, input.slotAt, myDate(input.slotAt), key]);
    if (r.rowCount) await emit(c, actor, 'post.scheduled', { taskId: input.taskId, versionId: input.versionId, target: input.platform, data: { slot_at: input.slotAt, basis: auth.basis } });
    return r.rows[0] ?? (await c.query(`SELECT * FROM platform_posts WHERE idempotency_key=$1`, [key])).rows[0];
  });
}

/**
 * Publish one post. Safe to call repeatedly (retries, duplicate jobs, refresh):
 * - row lock + status guard prevents two workers publishing the same post
 * - permission is re-checked right before dispatch
 * - an ambiguous result becomes 'unknown' and is reconciled with the provider before any retry
 * - 'published' only on provider confirmation
 */
export async function publishPost(db: Db, postId: string, adapter: PublishAdapter | null) {
  const claim = await tx(db, async (c) => {
    const p = (await c.query(`SELECT * FROM platform_posts WHERE id=$1 FOR UPDATE SKIP LOCKED`, [postId])).rows[0];
    if (!p) return { skip: 'locked_by_other_worker' as const };
    if (p.status === 'published') return { skip: 'already_published' as const };
    if (p.status === 'unknown') return { reconcile: p };
    if (p.status !== 'scheduled') return { skip: `status_${p.status}` as const };
    if (!adapter) {
      await c.query(`UPDATE platform_posts SET status='manual_pending' WHERE id=$1`, [postId]);
      await emit(c, { kind: 'staff', staffId: 'daniel' }, 'post.manual_handoff', { taskId: p.task_id, versionId: p.version_id, target: p.platform, reason: `${p.platform} is not connected; manual publish package prepared` });
      return { skip: 'manual_handoff' as const };
    }
    if (adapter.capabilities[p.format] !== true) {
      await c.query(`UPDATE platform_posts SET status='manual_pending' WHERE id=$1`, [postId]);
      await emit(c, { kind: 'staff', staffId: 'daniel' }, 'post.manual_handoff', { taskId: p.task_id, target: p.platform, reason: `${p.format} is not supported by the connected ${p.platform} integration` });
      return { skip: 'unsupported_format' as const };
    }
    const auth = await authorizeSideEffect(c, p.version_id, 'publish');
    if (!auth.ok) {
      await c.query(`UPDATE platform_posts SET status='planned' WHERE id=$1`, [postId]);
      await emit(c, { kind: 'system' }, 'post.paused', { taskId: p.task_id, versionId: p.version_id, target: p.platform, reason: auth.reason });
      return { skip: 'not_authorized' as const, reason: auth.reason };
    }
    await c.query(`UPDATE platform_posts SET status='publishing' WHERE id=$1`, [postId]);
    await emit(c, { kind: 'staff', staffId: 'daniel' }, 'post.dispatching', { taskId: p.task_id, versionId: p.version_id, target: p.platform, data: { basis: auth.basis } });
    return { dispatch: p };
  });

  if ('skip' in claim) return claim;
  const p = 'dispatch' in claim ? claim.dispatch : claim.reconcile;
  if (!adapter) return { skip: 'manual_handoff' as const };

  if ('reconcile' in claim) {
    const found = await adapter.lookup(p.idempotency_key);
    return finish(db, p, found ? { providerPostId: found.providerPostId, confirmed: true } : null, 'reconciled');
  }
  try {
    const res = await adapter.publish({ idempotencyKey: p.idempotency_key, versionId: p.version_id, format: p.format });
    return finish(db, p, res, 'dispatched');
  } catch (e) {
    await tx(db, async (c) => {
      await c.query(`UPDATE platform_posts SET status='unknown' WHERE id=$1`, [p.id]);
      await emit(c, { kind: 'system' }, 'post.outcome_unknown', { taskId: p.task_id, target: p.platform, reason: String((e as Error).message) });
    });
    return { status: 'unknown' as const };
  }
}

async function finish(db: Db, p: { id: string; task_id: string; version_id: string; platform: string }, res: { providerPostId: string; confirmed: boolean } | null, how: string) {
  return tx(db, async (c) => {
    if (res?.confirmed) {
      await c.query(`UPDATE platform_posts SET status='published', provider_post_id=$2, provider_confirmed_at=now() WHERE id=$1`, [p.id, res.providerPostId]);
      await emit(c, { kind: 'staff', staffId: 'daniel' }, 'post.published', { taskId: p.task_id, versionId: p.version_id, target: p.platform, data: { provider_post_id: res.providerPostId, how } });
      return { status: 'published' as const };
    }
    if (how === 'reconciled') {
      // Provider confirms it never happened: safe to return to scheduled for one retry
      await c.query(`UPDATE platform_posts SET status='scheduled' WHERE id=$1`, [p.id]);
      return { status: 'scheduled' as const };
    }
    await c.query(`UPDATE platform_posts SET status='unknown' WHERE id=$1`, [p.id]);
    return { status: 'unknown' as const };
  });
}

export async function setPublishingPaused(db: Db, userId: string, paused: boolean) {
  await tx(db, async (c) => {
    await c.query(`INSERT INTO app_settings(key,value) VALUES ('publishing_paused',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(paused)]);
    await emit(c, { kind: 'human', userId }, paused ? 'publishing.paused' : 'publishing.resumed');
  });
}
