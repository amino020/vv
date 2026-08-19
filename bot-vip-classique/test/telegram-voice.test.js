import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramAdapter } from '../src/adapters/telegram.js';

test('un vocal affiche les actions enregistrement puis envoi avant sendVoice', async () => {
  const calls = [];
  const adapter = new TelegramAdapter({
    token: 'test-token',
    mediaDir: 'C:\\media',
    delay: async (milliseconds) => { calls.push(['delay', milliseconds]); },
  });
  adapter.call = async (method, payload) => { calls.push([method, payload.action]); return true; };
  adapter.callWithFile = async (method, payload, field, file) => { calls.push([method, field, file, payload.caption, payload.parse_mode]); return true; };

  await adapter.sendStep('123', {
    id: 'voice', text: 'Écoute ça', mediaType: 'voice', media: '/media/intro.ogg', buttons: [],
  }, { steps: [{ id: 'voice' }] });

  assert.deepEqual(calls.slice(0, 3), [
    ['sendChatAction', 'record_voice'],
    ['delay', 900],
    ['sendChatAction', 'upload_voice'],
  ]);
  assert.equal(calls[3][0], 'sendVoice');
  assert.equal(calls[3][1], 'voice');
  assert.equal(calls[3][4], 'HTML');
});
