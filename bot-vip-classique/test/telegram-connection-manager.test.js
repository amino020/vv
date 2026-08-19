import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TelegramConnectionManager } from '../src/core/telegram-connection-manager.js';

test('teste, enregistre et active un bot sans renvoyer son token au panneau', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vip-telegram-connect-'));
  const envFile = path.join(directory, '.env');
  try {
    await writeFile(envFile, 'PORT=8791\nTELEGRAM_BOT_TOKEN=\nTELEGRAM_OPERATOR_CHAT_ID=\n');
    const calls = [];
    const telegram = {
      botInfo: null,
      setToken(token) { calls.push(['token', token]); },
    };
    const poller = {
      async restart() { calls.push(['restart']); return true; },
      status() { return { configured: true, running: true, bot: telegram.botInfo }; },
    };
    const processor = { setOperatorChatId(value) { calls.push(['operator', value]); } };
    const config = { envFile, mediaDir: directory, telegramToken: '', operatorChatId: '' };
    const manager = new TelegramConnectionManager({
      config, telegram, poller, processor,
      adapterFactory: () => ({ getMe: async () => ({ id: 42, username: 'bot_test', first_name: 'Test' }) }),
    });

    const result = await manager.update({ token: '123:secret-local', operatorChatId: '987' });
    const file = await readFile(envFile, 'utf8');
    assert.match(file, /^TELEGRAM_BOT_TOKEN=123:secret-local$/m);
    assert.match(file, /^TELEGRAM_OPERATOR_CHAT_ID=987$/m);
    assert.equal(result.bot.username, 'bot_test');
    assert.equal(JSON.stringify(result).includes('secret-local'), false);
    assert.deepEqual(calls, [['token', '123:secret-local'], ['operator', '987'], ['restart']]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
