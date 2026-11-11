/**
 * Server settings from environment variables. Local defaults stay exactly as before
 * (127.0.0.1:3100, plain HTTP); hosting sets HOST=0.0.0.0, COOKIE_SECURE=true and TRUST_PROXY=1.
 */
export interface ServerConfig {
  host: string;
  port: number;
  secureCookies: boolean;
  hsts: boolean;
  trustProxy: false | number;
  storageDir: string;
  assetsDir: string;
  webDir: string;
  maxUploadBytes: number;
  workerToken: string | null;
  /** Problems that make a public deployment unsafe; the server refuses to start when listening publicly. */
  problems: string[];
}

const yes = (v: string | undefined) => ['1', 'true', 'yes'].includes(String(v ?? '').trim().toLowerCase());

export function serverConfig(env: Record<string, string | undefined>): ServerConfig {
  const host = env.HOST?.trim() || '127.0.0.1';
  const port = Number(env.PORT ?? 3100);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`PORT must be a number between 1 and 65535 (got "${env.PORT}")`);
  const hops = env.TRUST_PROXY?.trim().toLowerCase();
  let trustProxy: false | number = false;
  if (hops && hops !== 'false' && hops !== '0') {
    // "true" means one proxy in front (typical for Railway/Render/Fly or Caddy). Never trust every hop.
    trustProxy = hops === 'true' ? 1 : Number(hops);
    if (!Number.isInteger(trustProxy) || trustProxy < 1 || trustProxy > 5) throw new Error(`TRUST_PROXY must be a number of proxy hops (1-5) or false (got "${env.TRUST_PROXY}")`);
  }
  const secureCookies = yes(env.COOKIE_SECURE);
  const workerToken = env.WORKER_TOKEN?.trim() || null;
  const isPublic = host !== '127.0.0.1' && host !== 'localhost' && host !== '::1';
  const problems: string[] = [];
  if (isPublic) {
    if (!secureCookies) problems.push('COOKIE_SECURE=true is required when the server listens publicly (it must sit behind HTTPS).');
    if (workerToken && workerToken.length < 32) problems.push('WORKER_TOKEN must be at least 32 characters when the server listens publicly.');
  }
  return {
    host, port, secureCookies, hsts: secureCookies, trustProxy,
    storageDir: env.STORAGE_DIR?.trim() || 'storage',
    assetsDir: env.ASSETS_DIR?.trim() || 'assets',
    webDir: env.WEB_DIR?.trim() || 'web/dist',
    maxUploadBytes: Number(env.UPLOAD_MAX_MB ?? 500) * 1024 * 1024,
    workerToken,
    problems,
  };
}
