import { readFile } from 'node:fs/promises';
import path from 'node:path';

function parseEnv(text) {
  const values = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export async function loadConfig(rootDir = process.cwd()) {
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(path.join(rootDir, '.env'), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const env = { ...fileValues, ...process.env };
  return {
    rootDir,
    port: integer(env.PORT, 8791),
    host: String(env.HOST || '127.0.0.1').trim(),
    adminToken: String(env.ADMIN_TOKEN || '').trim(),
    telegramToken: String(env.TELEGRAM_BOT_TOKEN || '').trim(),
    operatorChatId: String(env.TELEGRAM_OPERATOR_CHAT_ID || '').trim(),
    stripeWebhookSecret: String(env.STRIPE_WEBHOOK_SECRET || '').trim(),
    publicBaseUrl: String(env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    dataDir: path.join(rootDir, 'data'),
    mediaDir: path.join(rootDir, 'data', 'media'),
    publicDir: path.join(rootDir, 'public'),
    stateFile: path.join(rootDir, 'data', 'state.json'),
    envFile: path.join(rootDir, '.env'),
  };
}
