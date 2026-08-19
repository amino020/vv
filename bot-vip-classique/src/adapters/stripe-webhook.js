import { createHmac, timingSafeEqual } from 'node:crypto';

function signatures(header) {
  const result = { timestamp: 0, values: [] };
  for (const part of String(header || '').split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') result.timestamp = Number(value);
    if (key === 'v1' && value) result.values.push(value);
  }
  return result;
}

function safeEqualHex(left, right) {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyStripeEvent(rawBody, signatureHeader, secret, now = Date.now()) {
  if (!secret) throw Object.assign(new Error('Webhook Stripe non configuré'), { statusCode: 503, code: 'STRIPE_NOT_CONFIGURED' });
  const parsed = signatures(signatureHeader);
  if (!parsed.timestamp || !parsed.values.length) {
    throw Object.assign(new Error('Signature Stripe absente'), { statusCode: 400, code: 'STRIPE_SIGNATURE_INVALID' });
  }
  if (Math.abs(Math.floor(now / 1_000) - parsed.timestamp) > 300) {
    throw Object.assign(new Error('Signature Stripe expirée'), { statusCode: 400, code: 'STRIPE_SIGNATURE_EXPIRED' });
  }
  const expected = createHmac('sha256', secret).update(`${parsed.timestamp}.${rawBody}`).digest('hex');
  if (!parsed.values.some((value) => safeEqualHex(value, expected))) {
    throw Object.assign(new Error('Signature Stripe invalide'), { statusCode: 400, code: 'STRIPE_SIGNATURE_INVALID' });
  }
  const event = JSON.parse(rawBody);
  if (!event?.id || !event?.type || !event?.data?.object) {
    throw Object.assign(new Error('Événement Stripe incomplet'), { statusCode: 400, code: 'STRIPE_EVENT_INVALID' });
  }
  return event;
}

export function sanitizeStripeEvent(event) {
  const object = event.data.object || {};
  return {
    id: String(event.id),
    type: String(event.type),
    created: Number(event.created || 0),
    clientReferenceId: String(object.client_reference_id || ''),
    customerId: typeof object.customer === 'string' ? object.customer : String(object.customer?.id || ''),
    subscriptionId: typeof object.subscription === 'string' ? object.subscription : String(object.subscription?.id || object.id || ''),
    paymentStatus: String(object.payment_status || object.status || ''),
  };
}
