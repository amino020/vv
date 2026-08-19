import test from 'node:test';
import assert from 'node:assert/strict';
import { findStep, keyboardForStep, paymentUrl, sanitizeFunnel } from '../src/core/funnel.js';
import { DEFAULT_FUNNEL } from '../src/core/defaults.js';

test('ajoute une référence Telegram non sensible au lien Stripe', () => {
  const url = new URL(paymentUrl({ paymentLink: 'https://buy.stripe.com/test?locale=fr' }, 123456));
  assert.equal(url.searchParams.get('client_reference_id'), 'tg_123456');
  assert.equal(url.searchParams.get('utm_source'), 'telegram_bot');
  assert.equal(url.searchParams.get('locale'), 'fr');
});

test('refuse les liens non HTTPS et conserve au moins une étape', () => {
  const result = sanitizeFunnel({ ...DEFAULT_FUNNEL, paymentLink: 'javascript:alert(1)' }, DEFAULT_FUNNEL);
  assert.equal(result.paymentLink, '');
  assert.ok(result.steps.length > 0);
  assert.throws(() => sanitizeFunnel({ ...DEFAULT_FUNNEL, steps: [] }, DEFAULT_FUNNEL), /au moins une étape/);
});

test('limite le parcours à quatorze messages', () => {
  const steps = Array.from({ length: 14 }, (_, index) => ({
    id: `step-${index}`, title: `Étape ${index}`, text: 'Court', mediaType: 'photo', media: `/media/${index}.jpg`, buttons: [],
  }));
  const result = sanitizeFunnel({ ...DEFAULT_FUNNEL, steps }, DEFAULT_FUNNEL);
  assert.equal(result.steps.length, 14);
});

test('conserve les brouillons et les saute dans le parcours publié', () => {
  const steps = [
    { id: 'welcome', active: true, title: 'Accueil', text: 'Bienvenue', mediaType: 'none', media: '', buttons: [] },
    { id: 'draft', active: false, title: 'À compléter', text: 'Brouillon', mediaType: 'none', media: '', buttons: [] },
    { id: 'grade-one', active: true, title: 'Grade 1', text: 'Offre', mediaType: 'none', media: '', buttons: [] },
  ];
  const result = sanitizeFunnel({ ...DEFAULT_FUNNEL, steps }, DEFAULT_FUNNEL);
  assert.equal(result.steps[1].active, false);
  assert.equal(findStep(result, 'draft').id, 'grade-one');
});

test('refuse un parcours composé uniquement de brouillons', () => {
  const steps = [{ id: 'draft', active: false, title: 'Brouillon', text: 'Test', mediaType: 'none', media: '', buttons: [] }];
  assert.throws(() => sanitizeFunnel({ ...DEFAULT_FUNNEL, steps }, DEFAULT_FUNNEL), /étape active/);
});

test('présente une formule VIP unique à 35 euros sans suggérer de grades payants', () => {
  const publishedCopy = DEFAULT_FUNNEL.steps
    .filter((step) => step.active !== false)
    .map((step) => `${step.title}\n${step.text}`)
    .join('\n');
  assert.match(publishedCopy, /35\s*€/);
  assert.match(publishedCopy, /tout est compris/i);
  assert.doesNotMatch(publishedCopy, /\bgrades?\b/i);
  assert.doesNotMatch(publishedCopy, /par mois/i);
});

test('cache un bouton avant-goût tant que sa vidéo brouillon n’est pas prête', () => {
  const config = {
    steps: [
      { id: 'offer', active: true, buttons: [{ label: 'Avant-goût', action: 'next', target: 'teaser' }] },
      { id: 'teaser', active: false, mediaType: 'video', media: '', buttons: [] },
    ],
  };
  assert.equal(keyboardForStep(config.steps[0], config, '123'), undefined);
  config.steps[1].active = true;
  config.steps[1].media = '/media/teaser.mp4';
  assert.equal(keyboardForStep(config.steps[0], config, '123').inline_keyboard[0][0].text, 'Avant-goût');
});

test('exporte les messages et médias configurés dans le panel', () => {
  const videos = DEFAULT_FUNNEL.steps.filter((step) => step.mediaType === 'video');
  const usedMedia = new Set(DEFAULT_FUNNEL.steps.map((step) => step.media).filter(Boolean));
  assert.equal(DEFAULT_FUNNEL.steps.length, 13);
  assert.equal(DEFAULT_FUNNEL.steps.filter((step) => step.active !== false).length, 13);
  assert.deepEqual(videos.map((step) => step.id), ['weekly-content', 'join', 'teaser-two']);
  assert.ok(videos.every((step) => step.media.endsWith('.mp4')));
  assert.ok(usedMedia.has('/media/758183e5-a128-4222-b617-7addcf499bce.mp4'));
  assert.ok(usedMedia.has('/media/5137809a-02a5-4c39-bdfb-5d5af11137a6.mp4'));
  assert.ok(usedMedia.has('/media/1c904398-df33-4a27-a3b5-ec7bee82d5df.mp4'));
});

test('enchaîne deux étapes d’avant-goût avant de présenter le VIP', () => {
  const why = DEFAULT_FUNNEL.steps.find((step) => step.id === 'why-bot');
  const first = DEFAULT_FUNNEL.steps.find((step) => step.id === 'teaser-hook-one');
  const second = DEFAULT_FUNNEL.steps.find((step) => step.id === 'teaser-hook-two');
  assert.equal(why.buttons[0].target, first.id);
  assert.equal(first.buttons[0].target, second.id);
  assert.equal(second.buttons[0].target, 'vip-explained');
  assert.ok(first.active && second.active);
});

test('décrit clairement le contenu adulte inclus dans le VIP', () => {
  const publishedCopy = DEFAULT_FUNNEL.steps
    .filter((step) => step.active !== false)
    .map((step) => step.text)
    .join('\n');
  assert.doesNotMatch(publishedCopy, /NSFW/i);
  assert.match(publishedCopy, /nudes/i);
  assert.match(publishedCopy, /sextapes/i);
  assert.match(publishedCopy, /lesbiennes/i);
  assert.match(publishedCopy, /domination/i);
  assert.match(publishedCopy, /soumission/i);
  assert.match(publishedCopy, /jeux de rôle/i);
  assert.match(publishedCopy, /fantasme/i);
  assert.doesNotMatch(publishedCopy, /maitrsse|toute nues|vidéos seul\b/i);
  assert.match(DEFAULT_FUNNEL.adultNotice, /18\+/);
});
