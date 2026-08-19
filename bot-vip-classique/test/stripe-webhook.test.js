import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sanitizeStripeEvent, verifyStripeEvent } from '../src/adapters/stripe-webhook.js';

test('accepte une signature Stripe valide et ne conserve aucune donnée de paiement', () => {
  const secret = 'whsec_test_local';
  const timestamp = 1_700_000_000;
  const raw = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', created: timestamp, data: { object: {
    client_reference_id: 'tg_123', customer: 'cus_1', subscription: 'sub_1', payment_status: 'paid', customer_email: 'prive@example.test',
  } } });
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  const event = verifyStripeEvent(raw, `t=${timestamp},v1=${signature}`, secret, timestamp * 1_000);
  const clean = sanitizeStripeEvent(event);
  assert.equal(clean.clientReferenceId, 'tg_123');
  assert.equal(clean.paymentStatus, 'paid');
  assert.equal('customer_email' in clean, false);
});

test('refuse une signature Stripe falsifiée', () => {
  assert.throws(
    () => verifyStripeEvent('{"id":"evt"}', 't=1700000000,v1=00', 'whsec_test', 1_700_000_000_000),
    (error) => error.code === 'STRIPE_SIGNATURE_INVALID',
  );
});
