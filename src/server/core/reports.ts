import type { Db } from '../db/pool.js';

export const CORE_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'threads'] as const;

/** Daily CPR/DPR list from stored records for a Malaysia date. */
export async function dailyPrList(db: Db, day: string, kind?: 'CPR' | 'DPR') {
  const r = await db.query(
    `SELECT rr.id, rr.task_id, rr.version_id, rr.ref, rr.kind, rr.my_date, rr.status, rr.summary, rr.candy_review, rr.submitted_at, rr.repo_pr_url,
            s.display_name AS submitted_by, t.title, t.ref AS task_ref, t.is_demo, v.version, v.platform,
            a.decision, a.decided_by_kind, a.reason AS decision_reason, a.created_at AS decided_at
       FROM review_requests rr
       JOIN tasks t ON t.id=rr.task_id
       JOIN deliverable_versions v ON v.id=rr.version_id
       JOIN staff s ON s.id=rr.submitted_by
       LEFT JOIN LATERAL (SELECT * FROM approvals a WHERE a.version_id=rr.version_id ORDER BY created_at DESC LIMIT 1) a ON true
      WHERE rr.my_date=$1 AND ($2::text IS NULL OR rr.kind=$2)
      ORDER BY rr.ref`, [day, kind ?? null]);
  return r.rows.map((x) => ({
    ...x,
    decided_by: x.decided_by_kind === 'candy_delegated' ? "CANDY under AIN's delegation" : x.decided_by_kind === 'human' ? 'AIN' : null,
  }));
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

/** Per-platform counters. Published counts only provider-confirmed posts. Stories follow the configured rule. */
export async function dailyCounters(db: Db, day: string) {
  const targets = (await db.query(`SELECT * FROM daily_targets`)).rows;
  const posts = (await db.query(`SELECT platform, status, is_story, provider_confirmed_at FROM platform_posts WHERE my_date=$1`, [day])).rows;
  return targets.map((t) => {
    const mine = posts.filter((p) => p.platform === t.platform);
    const counts = (pred: (p: any) => boolean) => mine.filter(pred).length;
    const feed = (p: any) => !p.is_story || t.stories_count_toward_feed;
    const published = counts((p) => feed(p) && p.status === 'published' && p.provider_confirmed_at);
    return {
      platform: t.platform,
      target: t.feed_target,
      planned: counts((p) => feed(p) && p.status === 'planned'),
      scheduled: counts((p) => feed(p) && p.status === 'scheduled'),
      published,
      failed: counts((p) => feed(p) && ['failed', 'unknown'].includes(p.status)),
      manualPending: counts((p) => feed(p) && p.status === 'manual_pending'),
      storiesPublished: counts((p) => p.is_story && p.status === 'published'),
      storyTarget: t.story_target,
      shortfall: Math.max(0, t.feed_target - published),
    };
  });
}
