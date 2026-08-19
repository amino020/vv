import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramHtml } from '../src/core/telegram-format.js';

test('autorise le formatage Telegram prévu et neutralise le HTML inconnu', () => {
  const result = telegramHtml('<script>alerte</script><b>VIP & toi</b> <i>Emma</i>');
  assert.equal(result, '&lt;script&gt;alerte&lt;/script&gt;<b>VIP &amp; toi</b> <i>Emma</i>');
});

test('autorise uniquement les liens HTTPS ou Telegram', () => {
  assert.equal(telegramHtml('<a href="https://t.me/preuves">les avis</a>'), '<a href="https://t.me/preuves">les avis</a>');
  assert.match(telegramHtml('<a href="javascript:alert(1)">piège</a>'), /&lt;a href=/);
});
