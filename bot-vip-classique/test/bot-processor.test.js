import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';
import { BotProcessor } from '../src/core/bot-processor.js';

class TelegramFake {
  constructor() { this.calls = []; }
  async sendStep(chatId, step) { this.calls.push(['step', String(chatId), step.id]); }
  async sendMessage(chatId, text, markup) { this.calls.push(['message', String(chatId), text, markup]); }
  async answerCallbackQuery() {}
  async forwardMessage(operator, chatId, messageId) { this.calls.push(['forward', String(operator), String(chatId), messageId]); }
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vip-bot-test-'));
  const store = await new JsonStore(path.join(directory, 'state.json')).init();
  const telegram = new TelegramFake();
  const processor = new BotProcessor({ store, telegram, operatorChatId: '999' });
  return { directory, store, telegram, processor };
}

test('une capture ou déclaration de paiement ouvre une revue sans valider le client', async () => {
  const testbed = await fixture();
  try {
    await testbed.processor.processUpdate({ message: {
      message_id: 1, chat: { id: 123, type: 'private' }, from: { id: 123, username: 'prospect' }, text: '/start',
    } });
    await testbed.store.mutate((draft) => { draft.leads['123'].stepId = 'payment-howto'; });
    await testbed.processor.processUpdate({ message: {
      message_id: 2, chat: { id: 123, type: 'private' }, from: { id: 123, username: 'prospect' }, photo: [{ file_id: 'photo' }],
    } });
    await testbed.processor.processUpdate({ message: {
      message_id: 2, chat: { id: 123, type: 'private' }, from: { id: 123, username: 'prospect' }, photo: [{ file_id: 'photo' }],
    } });
    const lead = (await testbed.store.read()).leads['123'];
    assert.equal(lead.paymentStatus, 'claimed');
    assert.equal(lead.humanReview, true);
    assert.equal(lead.verifiedAt, undefined);
    assert.equal(testbed.telegram.calls.filter((call) => call[0] === 'forward').length, 1);
    assert.equal(testbed.telegram.calls.filter((call) => call[0] === 'message' && call[1] === '999').length, 1);
  } finally {
    await rm(testbed.directory, { recursive: true, force: true });
  }
});

test('seule une validation opérateur ou Stripe marque le client comme vérifié', async () => {
  const testbed = await fixture();
  try {
    await testbed.store.mutate((draft) => {
      draft.leads['123'] = { chatId: '123', status: 'claimed', paymentStatus: 'claimed', humanReview: true };
      draft.config.vipInviteLink = 'https://t.me/+vip';
    });
    await testbed.processor.approveLead('123', 'operator');
    const lead = (await testbed.store.read()).leads['123'];
    assert.equal(lead.paymentStatus, 'verified');
    assert.equal(lead.verifiedBy, 'operator');
    assert.ok(lead.accessDeliveredAt);
  } finally {
    await rm(testbed.directory, { recursive: true, force: true });
  }
});
