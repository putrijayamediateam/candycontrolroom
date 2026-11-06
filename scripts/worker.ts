/**
 * Chat worker for a Claude session acting as CANDY or a staff member.
 * Uses the scoped WORKER_TOKEN: it can read waiting messages and write chat messages, nothing else.
 *
 *   pnpm worker inbox [--json]
 *   pnpm worker pickup <messageId...>
 *   pnpm worker post --as candy --thread candy --reply-to <id> --body-file reply.txt
 *   pnpm worker post --as candy --thread mei --kind relay --reply-to <orderId> --body "…"
 *   pnpm worker post --as mei --thread mei --reply-to <id> --body "…"
 */
import { readFileSync } from 'node:fs';

const base = process.env.CANDY_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3100}`;
const token = process.env.WORKER_TOKEN;
if (!token) { console.error('WORKER_TOKEN is missing (run with --env-file=.env).'); process.exit(1); }

async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { console.error(`Cannot reach ${base}. Is the CANDY server running?`); process.exit(1); });
  const data = await r.json().catch(() => null);
  if (!r.ok) { console.error(`${r.status} ${data?.error ?? ''}: ${data?.message ?? ''}`); process.exit(1); }
  return data;
}

function flag(args: string[], name: string) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'inbox') {
  const d = await call('GET', '/api/worker/inbox');
  if (args.includes('--json')) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }
  console.log(`Owner: ${d.owner?.display_name} · reply language: ${d.owner?.interface_locale} · content language: ${d.owner?.content_locale} · ${d.today}`);
  if (!d.pending.length) { console.log('No waiting messages.'); process.exit(0); }
  for (const m of d.pending) {
    console.log(`\n[${m.id}] ${m.delivery.toUpperCase()} · chat: ${m.thread_name} (${m.thread})${m.route_to ? ` · ORDER for ${m.route_to_name} (${m.route_to})` : ''} · ${m.created_at}`);
    console.log(`AIN: ${m.body}`);
  }
  console.log('\nUse --json for staff instructions, training files and recent messages per chat.');
} else if (cmd === 'pickup') {
  console.log(await call('POST', '/api/worker/pickup', { ids: args }));
} else if (cmd === 'post') {
  const asStaff = flag(args, 'as'); const thread = flag(args, 'thread');
  const file = flag(args, 'body-file');
  const body = file ? readFileSync(file, 'utf8') : flag(args, 'body');
  if (!asStaff || !thread || !body) { console.error('post needs --as, --thread and --body or --body-file'); process.exit(1); }
  const d = await call('POST', '/api/worker/messages', {
    asStaff, thread, body, replyTo: flag(args, 'reply-to'), kind: flag(args, 'kind'), locale: flag(args, 'locale'),
  });
  console.log(`posted ${d.message.id} in ${thread} as ${asStaff}`);
} else {
  console.log('Commands: inbox [--json] | pickup <ids…> | post --as <staff> --thread <staff> [--reply-to id] [--kind reply|relay|message|note] (--body text | --body-file path)');
}
