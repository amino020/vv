import { createServer as createNodeServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findStep, sanitizeFunnel } from '../core/funnel.js';
import { DEFAULT_FUNNEL } from '../core/defaults.js';
import { sanitizeStripeEvent, verifyStripeEvent } from '../adapters/stripe-webhook.js';
import { logError } from '../lib/log.js';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.webp', 'image/webp'], ['.mp4', 'video/mp4'],
  ['.ogg', 'audio/ogg'], ['.mp3', 'audio/mpeg'], ['.m4a', 'audio/mp4'],
]);

const UPLOAD_TYPES = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['video/mp4', '.mp4'],
  ['audio/ogg', '.ogg'], ['audio/mpeg', '.mp3'], ['audio/mp4', '.m4a'], ['audio/x-m4a', '.m4a'],
]);

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

function json(response, status, body) {
  response.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function unauthorized(response) {
  json(response, 401, { error: 'Jeton administrateur refusé' });
}

function isAuthorized(request, config) {
  if (!config.adminToken) return true;
  const authorization = String(request.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : String(request.headers['x-admin-token'] || '');
  return token.length === config.adminToken.length && token === config.adminToken;
}

async function readBody(request, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Requête trop volumineuse'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request, maxBytes = 1_000_000) {
  const raw = await readBody(request, maxBytes);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON invalide'), { statusCode: 400 });
  }
}

function safeFile(root, pathname) {
  const relative = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  return resolved === path.resolve(root) || resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null;
}

async function serveFile(request, response, file) {
  const metadata = await stat(file);
  if (!metadata.isFile()) return false;
  const type = TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream';
  const range = String(request.headers.range || '').match(/^bytes=(\d*)-(\d*)$/);
  if (range && type.startsWith('video/')) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), metadata.size - 1) : metadata.size - 1;
    if (start > end || start >= metadata.size) {
      response.writeHead(416, { ...SECURITY_HEADERS, 'content-range': `bytes */${metadata.size}` });
      response.end();
      return true;
    }
    const { createReadStream } = await import('node:fs');
    response.writeHead(206, {
      ...SECURITY_HEADERS, 'content-type': type, 'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${metadata.size}`, 'content-length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(response);
    return true;
  }
  response.writeHead(200, {
    ...SECURITY_HEADERS, 'content-type': type, 'content-length': metadata.size,
    'cache-control': file.includes(`${path.sep}media${path.sep}`) ? 'private, max-age=3600' : 'no-cache',
  });
  response.end(await readFile(file));
  return true;
}

function dashboard(state, runtime, config) {
  const leads = Object.values(state.leads).sort((a, b) => Date.parse(b.lastSeenAt || 0) - Date.parse(a.lastSeenAt || 0));
  const counts = leads.reduce((result, lead) => {
    result.total += 1;
    if (lead.paymentStatus === 'claimed') result.claimed += 1;
    if (lead.paymentStatus === 'verified') result.verified += 1;
    return result;
  }, { total: 0, claimed: 0, verified: 0 });
  return {
    config: state.config,
    leads,
    counts,
    jobs: {
      queued: state.jobs.filter((job) => job.status === 'queued').length,
      failed: state.jobs.filter((job) => job.status === 'failed').length,
    },
    connections: {
      telegram: runtime.poller.status(),
      operatorConfigured: Boolean(config.operatorChatId),
      operatorChatId: config.operatorChatId || '',
      stripeWebhookConfigured: Boolean(config.stripeWebhookSecret),
      adminProtected: Boolean(config.adminToken),
      stripeWebhookPath: '/webhooks/stripe',
    },
  };
}

export function createHttpServer({ config, store, processor, poller, stripeWorker, telegram, telegramConnectionManager }) {
  return createNodeServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { ok: true, service: 'bot-vip-classique' });
      }

      if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
        const raw = await readBody(request, 2_000_000);
        const event = verifyStripeEvent(raw.toString('utf8'), request.headers['stripe-signature'], config.stripeWebhookSecret);
        const queued = await stripeWorker.enqueue(sanitizeStripeEvent(event));
        stripeWorker.tick().catch((error) => logError('stripe_worker.immediate_tick_failed', error));
        return json(response, 202, { received: true, duplicate: queued.duplicate === true });
      }

      if (url.pathname.startsWith('/api/')) {
        if (!isAuthorized(request, config)) return unauthorized(response);

        if (request.method === 'GET' && url.pathname === '/api/dashboard') {
          return json(response, 200, dashboard(await store.read(), { poller }, config));
        }
        if (request.method === 'PUT' && url.pathname === '/api/config') {
          const input = await readJson(request, 500_000);
          const next = await store.mutate((draft) => {
            draft.config = sanitizeFunnel(input, draft.config);
            return draft.config;
          });
          return json(response, 200, { ok: true, config: next });
        }
        if (request.method === 'POST' && url.pathname === '/api/config/reset') {
          const next = await store.mutate((draft) => {
            draft.config = sanitizeFunnel({ ...draft.config, steps: structuredClone(DEFAULT_FUNNEL.steps) }, draft.config);
            return draft.config;
          });
          return json(response, 200, { ok: true, config: next });
        }
        if (request.method === 'POST' && url.pathname === '/api/connections/telegram') {
          if (!telegramConnectionManager) throw Object.assign(new Error('Configuration Telegram indisponible'), { statusCode: 503 });
          const body = await readJson(request, 20_000);
          const result = await telegramConnectionManager.update({
            token: body.token,
            operatorChatId: body.operatorChatId,
          });
          return json(response, 200, result);
        }
        if (request.method === 'POST' && url.pathname === '/api/media') {
          const mime = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
          const extension = UPLOAD_TYPES.get(mime);
          if (!extension) throw Object.assign(new Error('Format accepté : JPG, PNG, WEBP, MP4, OGG, MP3 ou M4A'), { statusCode: 415 });
          const limit = mime.startsWith('video/') || mime.startsWith('audio/') ? 50_000_000 : 10_000_000;
          const bytes = await readBody(request, limit);
          if (!bytes.length) throw Object.assign(new Error('Fichier vide'), { statusCode: 400 });
          await mkdir(config.mediaDir, { recursive: true });
          const filename = `${randomUUID()}${extension}`;
          await writeFile(path.join(config.mediaDir, filename), bytes, { mode: 0o600 });
          return json(response, 201, { ok: true, media: `/media/${filename}`, mime, bytes: bytes.length });
        }
        if (request.method === 'POST' && url.pathname === '/api/test') {
          if (!config.operatorChatId) throw Object.assign(new Error('TELEGRAM_OPERATOR_CHAT_ID absent'), { statusCode: 409 });
          const state = await store.read();
          const step = findStep(state.config);
          if (!step) throw Object.assign(new Error('Aucune étape active'), { statusCode: 409 });
          await telegram.sendStep(config.operatorChatId, step, state.config);
          return json(response, 200, { ok: true });
        }
        const leadAction = url.pathname.match(/^\/api\/leads\/(\d+)\/(approve|reject)$/);
        if (request.method === 'POST' && leadAction) {
          const [, chatId, action] = leadAction;
          const lead = action === 'approve'
            ? await processor.approveLead(chatId, 'operator')
            : await processor.rejectClaim(chatId);
          return json(response, 200, { ok: true, lead });
        }
        return json(response, 404, { error: 'Route inconnue' });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
        const file = safeFile(config.mediaDir, url.pathname.slice('/media/'.length));
        if (!file || !(await serveFile(request, response, file).catch(() => false))) return json(response, 404, { error: 'Média introuvable' });
        return;
      }

      if (request.method === 'GET') {
        const requested = url.pathname === '/' ? 'index.html' : url.pathname;
        const file = safeFile(config.publicDir, requested);
        if (file && await serveFile(request, response, file).catch(() => false)) return;
        const index = path.join(config.publicDir, 'index.html');
        if (await serveFile(request, response, index).catch(() => false)) return;
      }
      return json(response, 404, { error: 'Introuvable' });
    } catch (error) {
      logError('http.request_failed', error, { path: url.pathname, method: request.method });
      return json(response, Number(error?.statusCode || 500), {
        error: Number(error?.statusCode || 500) >= 500 ? 'Service indisponible' : error.message,
        code: error?.code,
      });
    }
  });
}
