import path from 'node:path';

const ACTIONS = new Set(['next', 'payment', 'proof', 'contact', 'claim', 'restart', 'url']);

export function cleanUsername(value) {
  return String(value || '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
}

export function contactUrl(config) {
  const username = cleanUsername(config.creatorUsername);
  return username ? `https://t.me/${username}` : '';
}

export function paymentUrl(config, chatId) {
  const source = String(config.paymentLink || '').trim();
  if (!/^https:\/\//i.test(source)) return '';
  const url = new URL(source);
  url.searchParams.set('client_reference_id', `tg_${String(chatId).replace(/[^0-9]/g, '')}`);
  url.searchParams.set('utm_source', 'telegram_bot');
  return url.toString();
}

export function resolveButton(button, config, chatId, firstStepId) {
  const action = ACTIONS.has(button?.action) ? button.action : 'next';
  if (action === 'payment') return { text: button.label, url: paymentUrl(config, chatId) };
  if (action === 'proof') return { text: button.label, url: String(config.proofChannelLink || '') };
  if (action === 'contact') return { text: button.label, url: contactUrl(config) };
  if (action === 'url') return { text: button.label, url: String(button.target || '') };
  if (action === 'claim') return { text: button.label, callback_data: 'claim:payment' };
  const target = action === 'restart' ? firstStepId : String(button.target || firstStepId);
  return { text: button.label, callback_data: `step:${target}` };
}

export function keyboardForStep(step, config, chatId) {
  const firstStepId = findStep(config)?.id || 'welcome';
  const rows = [];
  for (const button of Array.isArray(step.buttons) ? step.buttons : []) {
    if (button?.action === 'next' && button.target) {
      const target = config.steps?.find((candidate) => candidate.id === button.target);
      if (!target || target.active === false || (target.mediaType === 'video' && !target.media)) continue;
    }
    const resolved = resolveButton(button, config, chatId, firstStepId);
    if (!resolved.text || (!resolved.url && !resolved.callback_data)) continue;
    rows.push([resolved]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export function findStep(config, id) {
  const steps = Array.isArray(config.steps) ? config.steps : [];
  if (!steps.length) return null;
  const requestedIndex = steps.findIndex((step) => step.id === id);
  const startIndex = requestedIndex >= 0 ? requestedIndex : 0;
  for (let offset = 0; offset < steps.length; offset += 1) {
    const step = steps[(startIndex + offset) % steps.length];
    if (step.active !== false) return step;
  }
  return null;
}

export function sanitizeFunnel(input, previous) {
  const text = (value, max = 4_000) => String(value ?? '').trim().slice(0, max);
  const url = (value) => {
    const candidate = text(value, 2_000);
    return !candidate || /^https:\/\//i.test(candidate) ? candidate : '';
  };
  const seen = new Set();
  const steps = (Array.isArray(input.steps) ? input.steps : previous.steps).slice(0, 14).map((raw, index) => {
    let id = text(raw.id, 48).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!id) id = `etape-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    const mediaType = ['none', 'photo', 'video', 'voice'].includes(raw.mediaType) ? raw.mediaType : 'none';
    const media = text(raw.media, 1_000);
    const buttons = (Array.isArray(raw.buttons) ? raw.buttons : []).slice(0, 6).map((button) => ({
      label: text(button.label, 64),
      action: ACTIONS.has(button.action) ? button.action : 'next',
      target: text(button.target, 2_000),
    })).filter((button) => button.label);
    return {
      id,
      active: raw.active !== false,
      title: text(raw.title, 120) || `Étape ${index + 1}`,
      text: text(raw.text),
      mediaType,
      media: mediaType === 'none' ? '' : media,
      buttons,
    };
  });
  if (!steps.length) throw Object.assign(new Error('Le parcours doit contenir au moins une étape'), { statusCode: 400 });
  if (!steps.some((step) => step.active)) {
    throw Object.assign(new Error('Le parcours doit contenir au moins une étape active'), { statusCode: 400 });
  }
  return {
    ...previous,
    brandName: text(input.brandName ?? previous.brandName, 120),
    creatorUsername: text(input.creatorUsername ?? previous.creatorUsername, 100),
    paymentLink: url(input.paymentLink ?? previous.paymentLink),
    proofChannelLink: url(input.proofChannelLink ?? previous.proofChannelLink),
    vipInviteLink: url(input.vipInviteLink ?? previous.vipInviteLink),
    priceText: text(input.priceText ?? previous.priceText, 500),
    claimReply: text(input.claimReply ?? previous.claimReply, 1_000),
    verifiedReply: text(input.verifiedReply ?? previous.verifiedReply, 1_000),
    adultNotice: text(input.adultNotice ?? previous.adultNotice, 500),
    steps,
  };
}

export function localMediaPath(mediaDir, mediaValue) {
  const value = String(mediaValue || '');
  if (!value.startsWith('/media/')) return null;
  const name = path.basename(value.slice('/media/'.length));
  const resolved = path.resolve(mediaDir, name);
  return resolved.startsWith(`${path.resolve(mediaDir)}${path.sep}`) ? resolved : null;
}
