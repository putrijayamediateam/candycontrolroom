import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Copies asset files that exist in `from` (the app image) but not yet in `to` (the host's volume).
 * Existing files are never overwritten: submitted assets keep their exact bytes, and re-renders
 * always arrive under new names. Returns the relative paths copied.
 */
export function syncMissingAssets(from: string, to: string): string[] {
  const src = resolve(from), dst = resolve(to);
  if (src === dst || !existsSync(src)) return [];
  mkdirSync(dst, { recursive: true });
  const copied: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(src, rel))) {
      const r = rel ? join(rel, name) : name;
      const s = join(src, r), d = join(dst, r);
      if (statSync(s).isDirectory()) { mkdirSync(d, { recursive: true }); walk(r); }
      else if (!existsSync(d)) { cpSync(s, d, { errorOnExist: true, force: false }); copied.push(r); }
    }
  };
  walk('');
  return copied;
}
