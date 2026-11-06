import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError, useApi } from '../api';
import { useSession } from '../session';
import { fmtDateTime } from '../format';
import { Badge, Empty, ErrorNote, Field } from '../ui';

const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.mp4,.m4v,.mov,.webm,.zip';
type Category = 'reference' | 'approved_example' | 'rejected_example';

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

/** Streams one file to the server with upload progress (fetch cannot report upload progress). */
function uploadFile(staffId: string, file: File, category: Category, note: string, onProgress: (p: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/staff/${encodeURIComponent(staffId)}/files`);
    x.setRequestHeader('x-candy-request', '1');
    x.setRequestHeader('content-type', 'application/octet-stream');
    x.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    x.setRequestHeader('x-file-category', category);
    if (note) x.setRequestHeader('x-file-note', encodeURIComponent(note));
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let data: any = null; try { data = JSON.parse(x.responseText); } catch { /* not json */ }
      if (x.status >= 200 && x.status < 300) resolve(data);
      else reject(new ApiError(x.status, data?.error ?? 'upload_failed', data?.message ?? x.statusText));
    };
    x.onerror = () => reject(new ApiError(0, 'network', 'network'));
    x.send(file);
  });
}

export function TrainingFiles({ staffId, staffName }: { staffId: string; staffName: string }) {
  const { t, i18n } = useTranslation();
  const { isOwner } = useSession();
  const st = useApi<any>(`/api/staff/${staffId}/files`);
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>('reference');
  const [note, setNote] = useState('');
  const [queue, setQueue] = useState<{ name: string; progress: number; state: 'uploading' | 'done' | 'failed'; error?: ApiError }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removeError, setRemoveError] = useState<ApiError | null>(null);
  const busy = queue.some((q) => q.state === 'uploading');

  const start = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    const allowed: string[] = st.data?.allowed ?? ACCEPT.split(',');
    const max: number = st.data?.max_bytes ?? 500 * 1048576;
    const items = list.map((f) => ({ name: f.name, progress: 0, state: 'uploading' as const }));
    setQueue(items);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const fail = (error: ApiError) => setQueue((q) => q.map((x, n) => (n === i ? { ...x, state: 'failed', error } : x)));
      if (!allowed.includes(ext)) { fail(new ApiError(415, 'unsupported_file', ext)); continue; }
      if (f.size > max) { fail(new ApiError(413, 'file_too_large', fmtSize(max))); continue; }
      if (f.size === 0) { fail(new ApiError(400, 'invalid_input', 'empty')); continue; }
      try {
        await uploadFile(staffId, f, category, note, (p) => setQueue((q) => q.map((x, n) => (n === i ? { ...x, progress: p } : x))));
        setQueue((q) => q.map((x, n) => (n === i ? { ...x, progress: 1, state: 'done' } : x)));
      } catch (e) { fail(e as ApiError); }
    }
    setNote('');
    if (input.current) input.current.value = '';
    st.reload();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (isOwner && !busy) void start(e.dataTransfer.files);
  };

  const remove = async (f: any) => {
    if (!window.confirm(t('training.removeConfirm', { name: f.original_name }))) return;
    setRemoveError(null);
    try { await api(`/api/staff/${staffId}/files/${f.id}/remove`, { method: 'POST' }); st.reload(); }
    catch (e) { setRemoveError(e as ApiError); }
  };

  const files: any[] = st.data?.files ?? [];
  return (
    <section className="training-files" aria-labelledby={`tf-${staffId}`}>
      <h3 id={`tf-${staffId}`}>{t('training.title', { count: files.length })}</h3>
      <p className="muted small">{t('training.explain', { name: staffName })}</p>

      {isOwner && (
        <div className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <div className="grid-2">
            <Field label={t('training.category')}>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)} disabled={busy}>
                <option value="reference">{t('training.cat_reference')}</option>
                <option value="approved_example">{t('training.cat_approved_example')}</option>
                <option value="rejected_example">{t('training.cat_rejected_example')}</option>
              </select>
            </Field>
            <Field label={t('training.note')} hint={t('training.noteHint')}>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} />
            </Field>
          </div>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => e.target.files && void start(e.target.files)} />
          <div className="row gap wrap">
            <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
              <span aria-hidden="true">⬆</span> {busy ? t('training.uploading') : t('training.upload')}
            </button>
            <span className="muted small">{t('training.dropHint', { max: fmtSize(st.data?.max_bytes ?? 500 * 1048576) })}</span>
          </div>
          {queue.length > 0 && (
            <ul className="plain-list compact upload-queue" aria-live="polite">
              {queue.map((q, n) => (
                <li key={n}>
                  <div className="row gap wrap">
                    <strong className="small">{q.name}</strong>
                    {q.state === 'uploading' && <span className="small muted">{Math.round(q.progress * 100)}%</span>}
                    {q.state === 'done' && <Badge tone="ok">{t('training.uploaded')}</Badge>}
                    {q.state === 'failed' && <Badge tone="bad">{t('training.failed')}</Badge>}
                  </div>
                  {q.state === 'uploading' && <progress max={1} value={q.progress} aria-label={q.name} />}
                  {q.error && <ErrorNote error={q.error} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ErrorNote error={st.error} onRetry={st.reload} />
      <ErrorNote error={removeError} />
      {st.data && files.length === 0 && <Empty title={t('training.empty')}>{t('training.emptyHint')}</Empty>}
      {files.length > 0 && (
        <div className="training-grid">
          {files.map((f) => (
            <figure key={f.id} className="asset">
              {f.kind === 'image' && <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.original_name} loading="lazy" /></a>}
              {f.kind === 'video' && <video src={f.url} controls preload="metadata" />}
              {f.kind === 'zip' && <div className="asset-missing"><span aria-hidden="true" className="zip-icon">🗜</span>{t('training.zipStored')}</div>}
              <figcaption>
                <strong className="small break">{f.original_name}</strong>
                <span className="row gap wrap">
                  <Badge tone={f.category === 'approved_example' ? 'ok' : f.category === 'rejected_example' ? 'warn' : 'neutral'}>{t(`training.cat_${f.category}`)}</Badge>
                  <Badge>{t(`training.kind_${f.kind}`)}</Badge>
                </span>
                {f.note && <span className="small">{f.note}</span>}
                <span className="muted small">{fmtSize(f.size_bytes)} · {fmtDateTime(f.created_at, i18n.language)}</span>
                <span className="row gap wrap">
                  <a className="btn btn-small" href={f.url} download={f.original_name}>{t('training.download')}</a>
                  {isOwner && <button className="btn btn-small btn-ghost" onClick={() => remove(f)}>{t('training.remove')}</button>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="muted small">{t('training.safety')}</p>
    </section>
  );
}
