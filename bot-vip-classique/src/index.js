import { mkdir } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { JsonStore } from './storage/json-store.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { BotProcessor } from './core/bot-processor.js';
import { TelegramPoller } from './core/telegram-poller.js';
import { StripeWorker } from './core/stripe-worker.js';
import { TelegramConnectionManager } from './core/telegram-connection-manager.js';
import { createHttpServer } from './http/server.js';
import { log, logError } from './lib/log.js';

const rootDir = process.cwd();
const config = await loadConfig(rootDir);
if (!['127.0.0.1', 'localhost', '::1'].includes(config.host) && !config.adminToken) {
  throw new Error('ADMIN_TOKEN est obligatoire quand le panneau écoute au-delà de la machine locale');
}
await Promise.all([mkdir(config.dataDir, { recursive: true }), mkdir(config.mediaDir, { recursive: true })]);

const store = await new JsonStore(config.stateFile).init();
const telegram = new TelegramAdapter({ token: config.telegramToken, mediaDir: config.mediaDir });
const processor = new BotProcessor({ store, telegram, operatorChatId: config.operatorChatId });
const poller = new TelegramPoller({ telegram, store, processor });
const stripeWorker = new StripeWorker({ store, processor });
const telegramConnectionManager = new TelegramConnectionManager({ config, telegram, poller, processor });
const server = createHttpServer({ config, store, processor, poller, stripeWorker, telegram, telegramConnectionManager });

stripeWorker.start();
poller.start().catch((error) => logError('telegram.start_failed', error));

server.listen(config.port, config.host, () => {
  log('service.started', {
    port: config.port,
    telegramConfigured: telegram.configured,
    stripeWebhookConfigured: Boolean(config.stripeWebhookSecret),
    adminProtected: Boolean(config.adminToken),
  });
});

async function shutdown(signal) {
  log('service.stopping', { signal });
  poller.stop();
  stripeWorker.stop();
  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT').catch(() => process.exit(1)));
process.on('SIGTERM', () => shutdown('SIGTERM').catch(() => process.exit(1)));
