import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnvFile } from '../src/storage/env-store.js';

test('met à jour Telegram atomiquement sans effacer les autres réglages', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vip-env-test-'));
  const file = path.join(directory, '.env');
  try {
    await writeFile(file, 'PORT=8791\nTELEGRAM_BOT_TOKEN=ancien\nAUTRE=conserve\n');
    await updateEnvFile(file, { TELEGRAM_BOT_TOKEN: 'nouveau', TELEGRAM_OPERATOR_CHAT_ID: '123' });
    const result = await readFile(file, 'utf8');
    assert.match(result, /^PORT=8791$/m);
    assert.match(result, /^TELEGRAM_BOT_TOKEN=nouveau$/m);
    assert.match(result, /^TELEGRAM_OPERATOR_CHAT_ID=123$/m);
    assert.match(result, /^AUTRE=conserve$/m);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
