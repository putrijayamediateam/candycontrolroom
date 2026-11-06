import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db/pool.js';
import { tx } from './db/pool.js';
import { PolicyError, emit } from './core/workflow.js';

/** Allowed training uploads. SVG and HTML are deliberately excluded (they can carry scripts). */
export const UPLOAD_TYPES: Record<string, { kind: 'image' | 'video' | 'zip'; mime: string }> = {
  '.png': { kind: 'image', mime: 'image/png' },
  '.jpg': { kind: 'image', mime: 'image/jpeg' },
  '.jpeg': { kind: 'image', mime: 'image/jpeg' },
  '.webp': { kind: 'image', mime: 'image/webp' },
  '.gif': { kind: 'image', mime: 'image/gif' },
  '.mp4': { kind: 'video', mime: 'video/mp4' },
  '.m4v': { kind: 'video', mime: 'video/mp4' },
  '.mov': { kind: 'video', mime: 'video/quicktime' },
  '.webm': { kind: 'video', mime: 'video/webm' },
  '.zip': { kind: 'zip', mime: 'application/zip' },
};

/** Checks the file's first bytes really match its extension, so a renamed program cannot pass as a picture. */
export function contentMatches(ext: string, head: Buffer): boolean {
  const hex = head.subarray(0, 12).toString('hex');
  const at = (off: number, s: string) => head.subarray(off, off + s.length).toString('latin1') === s;
  switch (ext) {
    case '.png': return hex.startsWith('89504e470d0a1a0a');
    case '.jpg': case '.jpeg': return hex.startsWith('ffd8ff');
    case '.gif': return at(0, 'GIF87a') || at(0, 'GIF89a');
    case '.webp': return at(0, 'RIFF') && at(8, 'WEBP');
    case '.mp4': case '.m4v': case '.mov': return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].some((b) => at(4, b));
    case '.webm': return hex.startsWith('1a45dfa3');
    case '.zip': return hex.startsWith('504b0304') || hex.startsWith('504b0506');
    default: return false;
  }
}

const CATEGORY = z.enum(['reference', 'approved_example', 'rejected_example']);
const StaffParam = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/) });
const FileParam = StaffParam.extend({ fileId: z.uuid() });

function header(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v !== 'string' || !v) return undefined;
  try { return decodeURIComponent(v); } catch { throw new PolicyError('invalid_input', `Header ${name} is not valid`); }
}

/** Keeps only a safe display name; the stored file name is always our own id. */
function cleanName(raw: string) {
  const name = basename(raw.replaceAll('\\', '/')).replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().slice(0, 200);
  if (!name || name === '.' || name === '..') throw new PolicyError('invalid_input', 'File name is missing');
  return name;
}

export function registerUploadRoutes(app: FastifyInstance, opts: { db: Db; storageDir: string; maxBytes: number }) {
  const { db, maxBytes } = opts;
  const root = resolve(opts.storageDir, 'training');

  // Raw file bodies are streamed straight to disk (never buffered whole in memory).
  app.addContentTypeParser('application/octet-stream', (_req, payload, done) => done(null, payload));

  const requireOwner = (req: FastifyRequest) => {
    if (req.user?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN (owner) can do this');
  };
  const staffExists = async (id: string) => (await db.query(`SELECT 1 FROM staff WHERE id=$1`, [id])).rowCount === 1;

  app.get('/api/staff/:id/files', async (req) => {
    const { id } = StaffParam.parse(req.params);
    const r = await db.query(
      `SELECT f.id, f.staff_id, f.original_name, f.kind, f.mime, f.size_bytes::text AS size_bytes, f.sha256, f.category, f.note, f.created_at, u.display_name AS uploaded_by_name
         FROM training_files f JOIN users u ON u.id=f.uploaded_by WHERE f.staff_id=$1 AND f.removed_at IS NULL ORDER BY f.created_at DESC`, [id]);
    return { files: r.rows.map((f) => ({ ...f, size_bytes: Number(f.size_bytes), url: `/api/staff/${id}/files/${f.id}` })), max_bytes: maxBytes, allowed: Object.keys(UPLOAD_TYPES) };
  });

  app.post('/api/staff/:id/files', async (req, reply) => {
    requireOwner(req);
    const { id } = StaffParam.parse(req.params);
    if (!(await staffExists(id))) throw new PolicyError('not_found', 'Staff member not found');
    if (!String(req.headers['content-type'] ?? '').startsWith('application/octet-stream')) throw new PolicyError('invalid_input', 'Send the file as application/octet-stream');
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > maxBytes) { req.raw.resume(); throw new PolicyError('file_too_large', `Files can be at most ${Math.round(maxBytes / 1048576)} MB`); }

    const original = cleanName(header(req, 'x-file-name') ?? '');
    const ext = extname(original).toLowerCase();
    const type = UPLOAD_TYPES[ext];
    if (!type) { req.raw.resume(); throw new PolicyError('unsupported_file', `Allowed: ${Object.keys(UPLOAD_TYPES).join(', ')}`); }
    const category = CATEGORY.parse(header(req, 'x-file-category') ?? 'reference');
    const note = (header(req, 'x-file-note') ?? '').slice(0, 500) || null;

    const fileId = randomUUID();
    const dir = join(root, id);
    mkdirSync(dir, { recursive: true });
    const part = join(dir, `${fileId}.part`);
    const final = join(dir, `${fileId}${ext}`);
    const hash = createHash('sha256');
    let size = 0; let head = Buffer.alloc(0);
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        if (size > maxBytes) return cb(new PolicyError('file_too_large', `Files can be at most ${Math.round(maxBytes / 1048576)} MB`));
        if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
        hash.update(chunk);
        cb(null, chunk);
      },
    });
    const body = req.body as Readable | undefined;
    if (!body || typeof (body as Readable).pipe !== 'function') throw new PolicyError('invalid_input', 'No file was sent');
    try {
      await pipeline(body, meter, createWriteStream(part, { flags: 'wx' }));
      if (size === 0) throw new PolicyError('invalid_input', 'The file is empty');
      if (!contentMatches(ext, head)) throw new PolicyError('file_type_mismatch', `The file content does not look like a real ${ext} file`);
      renameSync(part, final);
    } catch (e) {
      try { unlinkSync(part); } catch { /* not written */ }
      if (e instanceof PolicyError) throw e;
      throw new PolicyError('upload_failed', 'The upload was interrupted. Nothing was saved.');
    }

    try {
      const row = await tx(db, async (c) => {
        const r = await c.query(
          `INSERT INTO training_files (id, staff_id, original_name, stored_name, kind, mime, size_bytes, sha256, category, note, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, staff_id, original_name, kind, mime, size_bytes::text AS size_bytes, sha256, category, note, created_at`,
          [fileId, id, original, basename(final), type.kind, type.mime, size, hash.digest('hex'), category, note, req.user!.id]);
        await emit(c, { kind: 'human', userId: req.user!.id }, 'staff.training_file_added', { target: id, data: { file_id: fileId, name: original, kind: type.kind, category, size } });
        return r.rows[0];
      });
      return reply.code(201).send({ file: { ...row, size_bytes: Number(row.size_bytes), url: `/api/staff/${id}/files/${fileId}` } });
    } catch (e) {
      try { unlinkSync(final); } catch { /* ignore */ }
      throw e;
    }
  });

  app.get('/api/staff/:id/files/:fileId', async (req, reply) => {
    const { id, fileId } = FileParam.parse(req.params);
    const f = (await db.query(`SELECT * FROM training_files WHERE id=$1 AND staff_id=$2 AND removed_at IS NULL`, [fileId, id])).rows[0];
    const full = f ? resolve(root, id, f.stored_name) : '';
    if (!f || !full.startsWith(root + sep) || !existsSync(full)) return reply.code(404).send({ error: 'not_found', message: 'File not found' });
    return sendFile(req, reply, full, f.mime, f.kind === 'zip' ? 'attachment' : 'inline', f.original_name);
  });

  /** Removes a file from the staff member's training. The stored file is kept on disk (nothing is permanently deleted). */
  app.post('/api/staff/:id/files/:fileId/remove', async (req) => {
    requireOwner(req);
    const { id, fileId } = FileParam.parse(req.params);
    return tx(db, async (c) => {
      const r = await c.query(`UPDATE training_files SET removed_at=now(), removed_by=$3 WHERE id=$1 AND staff_id=$2 AND removed_at IS NULL RETURNING original_name`, [fileId, id, req.user!.id]);
      if (!r.rowCount) throw new PolicyError('not_found', 'File not found');
      await emit(c, { kind: 'human', userId: req.user!.id }, 'staff.training_file_removed', { target: id, data: { file_id: fileId, name: r.rows[0].original_name } });
      return { ok: true };
    });
  });
}

/** Streams a private file, with byte-range support so videos can seek. */
function sendFile(req: FastifyRequest, reply: FastifyReply, full: string, mime: string, disposition: 'inline' | 'attachment', name: string) {
  const size = statSync(full).size;
  reply.header('x-content-type-options', 'nosniff');
  reply.header('content-security-policy', "default-src 'none'; sandbox");
  reply.header('cache-control', 'private, max-age=300');
  reply.header('accept-ranges', 'bytes');
  reply.header('content-disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end || start >= size) return reply.code(416).header('content-range', `bytes */${size}`).send();
    reply.code(206).header('content-range', `bytes ${start}-${end}/${size}`).header('content-length', end - start + 1);
    return reply.type(mime).send(createReadStream(full, { start, end }));
  }
  reply.header('content-length', size);
  return reply.type(mime).send(createReadStream(full));
}
