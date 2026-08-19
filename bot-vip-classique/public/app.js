const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  dashboard: null,
  config: null,
  token: sessionStorage.getItem('vip-admin-token') || '',
  selectedStep: 0,
  leadFilter: 'all',
  leadSearch: '',
  dirty: false,
  noticeTimer: null,
  refreshing: false,
};

const titles = {
  journey: 'Le parcours d’Emma',
  offer: 'L’offre et les liens',
  leads: 'Les prospects',
  connections: 'Les connexions',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function telegramPreviewHtml(value) {
  let html = escapeHtml(value);
  const tags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'tg-spoiler'];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const tag of tags) {
      const target = ({ strong: 'b', em: 'i', ins: 'u', strike: 's', del: 's' })[tag] || tag;
      const open = `&lt;${tag}&gt;`;
      const close = `&lt;/${tag}&gt;`;
      html = html.replaceAll(open, `<${target}>`).replaceAll(close, `</${target}>`);
    }
  }
  return html.replace(/&lt;tg-emoji emoji-id=&quot;\d{5,30}&quot;&gt;([\s\S]*?)&lt;\/tg-emoji&gt;/gi, '$1');
}

function authHeaders(extra = {}) {
  return { ...extra, ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: authHeaders(options.headers || {}) });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    $('#auth-gate').classList.remove('is-hidden');
    throw Object.assign(new Error('Jeton administrateur refusé'), { unauthorized: true });
  }
  if (!response.ok) throw new Error(body.error || `Erreur ${response.status}`);
  return body;
}

function notify(message, error = false) {
  clearTimeout(state.noticeTimer);
  const notice = $('#notice');
  notice.textContent = message;
  notice.classList.toggle('is-error', error);
  notice.classList.remove('is-hidden');
  state.noticeTimer = setTimeout(() => notice.classList.add('is-hidden'), 4_500);
}

function markDirty() {
  state.dirty = true;
  $('#save-state').textContent = 'Modifications non enregistrées';
}

function markSaved() {
  state.dirty = false;
  $('#save-state').textContent = 'À jour';
}

function mediaPreview(step, compact = false) {
  if (step.mediaType === 'photo' && step.media) return `<img src="${escapeHtml(step.media)}" alt="Aperçu de l’étape">`;
  if (step.mediaType === 'video' && step.media) return `<video src="${escapeHtml(step.media)}" ${compact ? '' : 'controls'} muted playsinline></video>`;
  if (step.mediaType === 'voice' && step.media) return `<audio src="${escapeHtml(step.media)}" controls preload="metadata"></audio>`;
  return '<span>Aucun média</span>';
}

function actionLabel(action) {
  return ({
    next: 'Étape suivante', payment: 'Paiement Stripe', proof: 'Canal de preuves',
    contact: 'Contact privé', claim: 'J’ai payé', restart: 'Recommencer', url: 'Lien libre',
  })[action] || action;
}

function actionOptions(selected) {
  return ['next', 'payment', 'proof', 'contact', 'claim', 'restart', 'url']
    .map((action) => `<option value="${action}"${selected === action ? ' selected' : ''}>${actionLabel(action)}</option>`).join('');
}

function targetOptions(selected) {
  const options = state.config.steps.map((step) => `<option value="${escapeHtml(step.id)}"${selected === step.id ? ' selected' : ''}>${escapeHtml(step.title)}</option>`).join('');
  return `<option value="">Choisir…</option>${options}`;
}

function buttonRow(button, index) {
  const targetControl = button.action === 'next'
    ? `<select class="action-target" data-button-field="target">${targetOptions(button.target)}</select>`
    : button.action === 'url'
      ? `<input class="action-target" data-button-field="target" value="${escapeHtml(button.target)}" placeholder="https://…">`
      : '<span class="action-target"></span>';
  return `<div class="action-row" data-button-index="${index}">
    <input data-button-field="label" value="${escapeHtml(button.label)}" aria-label="Libellé du bouton">
    <select data-button-field="action" aria-label="Action du bouton">${actionOptions(button.action)}</select>
    ${targetControl}
    <button class="icon-button danger remove-action" type="button" aria-label="Supprimer le bouton">×</button>
  </div>`;
}

function stepCard(step, index) {
  const active = step.active !== false;
  return `<article class="step-card${index === state.selectedStep ? ' is-selected' : ''}${active ? '' : ' is-draft'}" data-index="${String(index + 1).padStart(2, '0')}" data-step-index="${index}">
    <header class="step-card-head">
      <div class="step-title-row">
        <input data-field="title" value="${escapeHtml(step.title)}" aria-label="Titre de l’étape">
        <span class="step-id">${escapeHtml(step.id)}</span>${active ? '' : '<span class="draft-badge">Brouillon</span>'}
      </div>
      <div class="step-tools">
        <label class="step-active-toggle"><input type="checkbox" data-field="active"${active ? ' checked' : ''}><span>Envoyer cette étape</span></label>
        <button class="icon-button move-up" type="button" title="Monter" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-button move-down" type="button" title="Descendre" ${index === state.config.steps.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-button duplicate-step" type="button" title="Dupliquer">⧉</button>
        <button class="icon-button danger delete-step" type="button" title="Supprimer">×</button>
      </div>
    </header>
    <div class="step-body">
      <label>Texte Telegram <small class="format-hint" title="Lien : &lt;a href=&quot;https://…&quot;&gt;texte&lt;/a&gt; · Emoji Premium : &lt;tg-emoji emoji-id=&quot;IDENTIFIANT&quot;&gt;💗&lt;/tg-emoji&gt;">gras · italique · souligné · liens · emoji Premium</small><textarea data-field="text" rows="7">${escapeHtml(step.text)}</textarea></label>
      <div class="media-editor">
        <label>Format<select data-field="mediaType">
          <option value="none"${step.mediaType === 'none' ? ' selected' : ''}>Sans média</option>
          <option value="photo"${step.mediaType === 'photo' ? ' selected' : ''}>Photo</option>
          <option value="video"${step.mediaType === 'video' ? ' selected' : ''}>Vidéo MP4</option>
          <option value="voice"${step.mediaType === 'voice' ? ' selected' : ''}>Message vocal</option>
        </select></label>
        <div class="media-box">${mediaPreview(step)}</div>
        <label class="upload-button">Importer un média<input class="media-upload" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,audio/ogg,audio/mpeg,audio/mp4,.m4a"></label>
        <input data-field="media" value="${escapeHtml(step.media)}" placeholder="/media/... ou https://..." aria-label="Adresse du média">
      </div>
      <div class="button-editor">
        <div class="button-editor-head"><span>Boutons d’action</span><button class="add-button-link add-action" type="button">+ Ajouter</button></div>
        <div class="action-list">${(step.buttons || []).map(buttonRow).join('')}</div>
      </div>
    </div>
  </article>`;
}

function renderSteps() {
  state.selectedStep = Math.max(0, Math.min(state.selectedStep, state.config.steps.length - 1));
  $('#steps-list').innerHTML = state.config.steps.map(stepCard).join('');
  $('#nav-step-count').textContent = state.config.steps.length;
  renderPreview();
}

function renderPreview() {
  const step = state.config.steps[state.selectedStep];
  if (!step) return;
  $('#preview-brand').textContent = state.config.brandName || 'Emma';
  $('#preview-step-title').textContent = step.title;
  const media = step.mediaType !== 'none' ? mediaPreview(step, true) : '';
  const buttons = (step.buttons || []).map((button) => `<span>${escapeHtml(button.label)}</span>`).join('');
  $('#preview-message').innerHTML = `${media}<div class="bubble-copy">${telegramPreviewHtml(step.text)}</div>${buttons ? `<div class="preview-buttons">${buttons}</div>` : ''}`;
}

function renderMetrics() {
  const { counts, jobs } = state.dashboard;
  $('#metrics').innerHTML = `
    <div class="metric"><strong>${counts.total}</strong><span>personnes entrées dans le parcours</span></div>
    <div class="metric${counts.claimed ? ' is-alert' : ''}"><strong>${counts.claimed}</strong><span>paiements à vérifier</span></div>
    <div class="metric"><strong>${counts.verified}</strong><span>accès VIP validés</span></div>`;
  $('#nav-claim-count').textContent = counts.claimed;
  if (jobs.failed) notify(`${jobs.failed} événement Stripe demande une vérification technique`, true);
}

function populateOffer() {
  const fields = {
    '#brand-name': 'brandName', '#creator-username': 'creatorUsername', '#payment-link': 'paymentLink',
    '#proof-link': 'proofChannelLink', '#vip-link': 'vipInviteLink', '#price-text': 'priceText',
    '#claim-reply': 'claimReply', '#verified-reply': 'verifiedReply', '#adult-notice': 'adultNotice',
  };
  for (const [selector, key] of Object.entries(fields)) $(selector).value = state.config[key] || '';
}

function leadStatus(lead) {
  if (lead.paymentStatus === 'verified') return ['VIP vérifié', 'verified'];
  if (lead.paymentStatus === 'claimed') return ['À vérifier', 'claimed'];
  if (lead.paymentStatus === 'payment_failed') return ['Paiement échoué', 'claimed'];
  if (lead.paymentStatus === 'canceled') return ['Résilié', 'unpaid'];
  return ['Dans le parcours', 'unpaid'];
}

function renderLeads() {
  const query = state.leadSearch.trim().toLowerCase();
  const leads = state.dashboard.leads.filter((lead) => {
    const matchesFilter = state.leadFilter === 'all' || lead.paymentStatus === state.leadFilter;
    const haystack = `${lead.username || ''} ${lead.firstName || ''} ${lead.chatId || ''}`.toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
  const container = $('#lead-list');
  if (!leads.length) {
    container.replaceChildren($('#empty-leads-template').content.cloneNode(true));
    return;
  }
  container.innerHTML = leads.map((lead) => {
    const [label, statusClass] = leadStatus(lead);
    const identity = lead.username ? `@${lead.username}` : lead.firstName || `Telegram ${lead.chatId}`;
    const date = lead.lastSeenAt ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lead.lastSeenAt)) : '—';
    const actions = lead.paymentStatus === 'claimed' || lead.paymentStatus === 'payment_failed'
      ? `<button class="small-button reject-lead" data-chat-id="${escapeHtml(lead.chatId)}">Refuser</button><button class="small-button approve approve-lead" data-chat-id="${escapeHtml(lead.chatId)}">Valider</button>`
      : '';
    const step = state.config.steps.find((candidate) => candidate.id === lead.stepId);
    const evidence = lead.screenshotReceived ? ' · capture reçue' : '';
    const notification = lead.operatorNotificationError ? ' · alerte opérateur à vérifier' : '';
    return `<article class="lead-row">
      <div class="lead-identity"><strong>${escapeHtml(identity)}</strong><small>Étape : ${escapeHtml(step?.title || lead.stepId || 'entrée')}${escapeHtml(evidence)}${escapeHtml(notification)}</small></div>
      <span class="status-pill ${statusClass}">${label}</span>
      <span class="lead-date">${date}</span>
      <div class="lead-actions">${actions}</div>
    </article>`;
  }).join('');
}

function renderConnections() {
  const connections = state.dashboard.connections;
  const cards = [
    ['Telegram', connections.telegram.running, connections.telegram.running ? 'Lecture des messages active.' : connections.telegram.configured ? `Arrêté : ${connections.telegram.lastError || 'redémarrage nécessaire'}.` : 'Ajoute le token depuis le bloc « Ajouter le bot ».'],
    ['Réception privée', connections.operatorConfigured, connections.operatorConfigured ? 'Les preuves et alertes arrivent dans ton chat opérateur.' : 'Ajoute ton identifiant de chat Telegram.'],
    ['Validation Stripe', connections.stripeWebhookConfigured, connections.stripeWebhookConfigured ? 'Les événements Stripe signés peuvent valider un accès.' : 'Sans secret webhook, la validation reste manuelle.'],
    ['Panneau', connections.adminProtected, connections.adminProtected ? 'Le panneau est protégé par jeton.' : 'Mode local sans jeton : ajoute ADMIN_TOKEN avant une mise en ligne.'],
  ];
  $('#connection-grid').innerHTML = cards.map(([title, ready, detail]) => `<article class="connection-card${ready ? ' is-ready' : ''}"><header><strong>${title}</strong><i></i></header><p>${escapeHtml(detail)}</p></article>`).join('');
  $('#webhook-path').textContent = connections.stripeWebhookPath;
  const dot = $('#telegram-dot');
  dot.className = connections.telegram.running ? 'is-live' : connections.telegram.lastError ? 'is-error' : '';
  $('#telegram-label').textContent = connections.telegram.running ? 'Telegram en ligne' : connections.telegram.configured ? 'Telegram arrêté' : 'Token à configurer';
  const bot = connections.telegram.bot;
  $('#connected-bot-name').textContent = bot?.username ? `@${bot.username}` : 'Bot Telegram';
  $('#telegram-connect-chip').textContent = connections.telegram.running ? 'Actif' : connections.telegram.configured ? 'À relancer' : 'Non configuré';
  $('#telegram-connect-chip').classList.toggle('is-ready', connections.telegram.running);
  $('#telegram-bot-token').placeholder = connections.telegram.configured ? 'Token actif · laisser vide pour le garder' : '123456:ABC…';
  const operatorInput = $('#telegram-operator-id');
  if (document.activeElement !== operatorInput && !operatorInput.value) operatorInput.value = connections.operatorChatId || '';
}

function renderAll() {
  renderMetrics();
  renderSteps();
  populateOffer();
  renderLeads();
  renderConnections();
}

async function loadDashboard() {
  state.dashboard = await api('/api/dashboard');
  state.config = structuredClone(state.dashboard.config);
  renderAll();
  markSaved();
}

async function refreshLiveDashboard() {
  if (state.refreshing || !state.dashboard || document.hidden) return;
  state.refreshing = true;
  try {
    const latest = await api('/api/dashboard');
    state.dashboard = latest;
    if (!state.dirty) state.config = structuredClone(latest.config);
    renderMetrics();
    renderLeads();
    renderConnections();
  } catch (error) {
    if (!error.unauthorized) $('#telegram-label').textContent = 'Actualisation interrompue';
  } finally {
    state.refreshing = false;
  }
}

function swapSteps(from, to) {
  if (to < 0 || to >= state.config.steps.length) return;
  [state.config.steps[from], state.config.steps[to]] = [state.config.steps[to], state.config.steps[from]];
  state.selectedStep = to;
  markDirty();
  renderSteps();
}

async function uploadMedia(input, stepIndex) {
  const file = input.files?.[0];
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
  if (!allowed.includes(file.type)) return notify('Format accepté : JPG, PNG, WEBP, MP4, OGG, MP3 ou M4A', true);
  input.disabled = true;
  try {
    const response = await api('/api/media', { method: 'POST', headers: { 'content-type': file.type }, body: file });
    state.config.steps[stepIndex].media = response.media;
    state.config.steps[stepIndex].mediaType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'voice' : 'photo';
    markDirty();
    renderSteps();
    notify('Média importé. Enregistre le parcours pour le publier.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    input.disabled = false;
  }
}

$('#steps-list').addEventListener('click', (event) => {
  const card = event.target.closest('.step-card');
  if (!card) return;
  const index = Number(card.dataset.stepIndex);
  if (!Number.isInteger(index)) return;
  state.selectedStep = index;
  if (event.target.closest('.move-up')) return swapSteps(index, index - 1);
  if (event.target.closest('.move-down')) return swapSteps(index, index + 1);
  if (event.target.closest('.duplicate-step')) {
    const copy = structuredClone(state.config.steps[index]);
    copy.id = `${copy.id}-copie-${Date.now().toString(36).slice(-4)}`;
    copy.title = `${copy.title} · copie`;
    state.config.steps.splice(index + 1, 0, copy);
    state.selectedStep = index + 1;
    markDirty();
    return renderSteps();
  }
  if (event.target.closest('.delete-step')) {
    if (state.config.steps.length === 1) return notify('Le parcours doit garder au moins une étape.', true);
    state.config.steps.splice(index, 1);
    state.selectedStep = Math.min(index, state.config.steps.length - 1);
    markDirty();
    return renderSteps();
  }
  if (event.target.closest('.add-action')) {
    state.config.steps[index].buttons.push({ label: 'Continuer', action: 'next', target: state.config.steps[index + 1]?.id || state.config.steps[0].id });
    markDirty();
    return renderSteps();
  }
  const actionRow = event.target.closest('.action-row');
  if (event.target.closest('.remove-action') && actionRow) {
    state.config.steps[index].buttons.splice(Number(actionRow.dataset.buttonIndex), 1);
    markDirty();
    return renderSteps();
  }
  $$('.step-card').forEach((element) => element.classList.toggle('is-selected', element === card));
  renderPreview();
});

$('#steps-list').addEventListener('input', (event) => {
  const card = event.target.closest('.step-card');
  if (!card) return;
  const stepIndex = Number(card.dataset.stepIndex);
  const step = state.config.steps[stepIndex];
  if (event.target.dataset.field && event.target.type !== 'checkbox') step[event.target.dataset.field] = event.target.value;
  const actionRow = event.target.closest('.action-row');
  if (actionRow && event.target.dataset.buttonField) {
    step.buttons[Number(actionRow.dataset.buttonIndex)][event.target.dataset.buttonField] = event.target.value;
  }
  markDirty();
  if (stepIndex === state.selectedStep) renderPreview();
});

$('#steps-list').addEventListener('change', (event) => {
  const card = event.target.closest('.step-card');
  if (!card) return;
  const stepIndex = Number(card.dataset.stepIndex);
  if (event.target.classList.contains('media-upload')) return uploadMedia(event.target, stepIndex);
  if (event.target.dataset.field) {
    state.config.steps[stepIndex][event.target.dataset.field] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    markDirty();
    renderSteps();
    return;
  }
  if (event.target.dataset.buttonField === 'action') {
    const row = event.target.closest('.action-row');
    const button = state.config.steps[stepIndex].buttons[Number(row.dataset.buttonIndex)];
    button.action = event.target.value;
    button.target = button.action === 'next' ? state.config.steps[stepIndex + 1]?.id || state.config.steps[0].id : '';
    markDirty();
    renderSteps();
  }
});

$('#add-step').addEventListener('click', () => {
  const id = `etape-${Date.now().toString(36).slice(-6)}`;
  state.config.steps.push({ id, active: true, title: 'Nouvelle étape', text: 'Écris ici le prochain message du parcours.', mediaType: 'none', media: '', buttons: [] });
  state.selectedStep = state.config.steps.length - 1;
  markDirty();
  renderSteps();
});

$('#reset-funnel').addEventListener('click', async () => {
  if (!window.confirm('Réinitialiser les messages du parcours ? Tes liens, prospects et réglages Telegram seront conservés.')) return;
  const button = $('#reset-funnel');
  button.disabled = true;
  try {
    const result = await api('/api/config/reset', { method: 'POST' });
    state.config = structuredClone(result.config);
    state.dashboard.config = structuredClone(result.config);
    state.selectedStep = 0;
    renderAll();
    markSaved();
    notify('Parcours réinitialisé. Les connexions et les prospects ont été conservés.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

const offerFields = {
  'brand-name': 'brandName', 'creator-username': 'creatorUsername', 'payment-link': 'paymentLink',
  'proof-link': 'proofChannelLink', 'vip-link': 'vipInviteLink', 'price-text': 'priceText',
  'claim-reply': 'claimReply', 'verified-reply': 'verifiedReply', 'adult-notice': 'adultNotice',
};
for (const [id, key] of Object.entries(offerFields)) {
  $(`#${id}`).addEventListener('input', (event) => {
    state.config[key] = event.target.value;
    markDirty();
    if (key === 'brandName') renderPreview();
  });
}

$('#save-button').addEventListener('click', async () => {
  const button = $('#save-button');
  button.disabled = true;
  try {
    const result = await api('/api/config', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state.config),
    });
    state.config = result.config;
    state.dashboard.config = result.config;
    markSaved();
    renderSteps();
    notify('Parcours enregistré. Les prochains clics utilisent cette version.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#test-button').addEventListener('click', async () => {
  const button = $('#test-button');
  button.disabled = true;
  try {
    if (state.dirty) notify('Enregistre d’abord les modifications avant le test.', true);
    else {
      await api('/api/test', { method: 'POST' });
      notify('Première étape envoyée dans ton chat opérateur.');
    }
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#lead-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.leadFilter = button.dataset.filter;
  $$('.filter', $('#lead-filters')).forEach((element) => element.classList.toggle('is-active', element === button));
  renderLeads();
});

$('#lead-search').addEventListener('input', (event) => {
  state.leadSearch = event.target.value;
  renderLeads();
});

$('#telegram-connect-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#telegram-connect-button');
  button.disabled = true;
  $('#telegram-connect-help').textContent = 'Vérification du bot auprès de Telegram…';
  try {
    const result = await api('/api/connections/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: $('#telegram-bot-token').value.trim(),
        operatorChatId: $('#telegram-operator-id').value.trim(),
      }),
    });
    $('#telegram-bot-token').value = '';
    $('#telegram-connect-help').textContent = result.operatorConfigured
      ? `@${result.bot.username} reçoit les prospects et te prévient en privé.`
      : `@${result.bot.username} est actif. Envoie-lui /id puis ajoute ton identifiant opérateur.`;
    await refreshLiveDashboard();
    notify(`@${result.bot.username} est connecté.`);
  } catch (error) {
    $('#telegram-connect-help').textContent = error.message;
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#lead-list').addEventListener('click', async (event) => {
  const approve = event.target.closest('.approve-lead');
  const reject = event.target.closest('.reject-lead');
  const button = approve || reject;
  if (!button) return;
  const action = approve ? 'approve' : 'reject';
  if (approve && !confirm('As-tu vérifié ce paiement dans Stripe ? Valider enverra immédiatement le lien VIP.')) return;
  if (reject && !confirm('Retirer cette demande de la file de vérification ?')) return;
  button.disabled = true;
  try {
    await api(`/api/leads/${encodeURIComponent(button.dataset.chatId)}/${action}`, { method: 'POST' });
    await loadDashboard();
    notify(approve ? 'Paiement validé et accès envoyé.' : 'Demande classée sans paiement.');
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$$('.nav-item').forEach((button) => button.addEventListener('click', () => {
  if (state.dirty && !confirm('Des modifications ne sont pas enregistrées. Changer de page sans les perdre ?')) return;
  $$('.nav-item').forEach((item) => item.classList.toggle('is-active', item === button));
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.dataset.viewPanel === button.dataset.view));
  $('#page-title').textContent = titles[button.dataset.view];
}));

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  state.token = $('#admin-token').value.trim();
  sessionStorage.setItem('vip-admin-token', state.token);
  $('#auth-error').textContent = '';
  try {
    await loadDashboard();
    $('#auth-gate').classList.add('is-hidden');
  } catch (error) {
    $('#auth-error').textContent = error.message;
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

loadDashboard().catch((error) => {
  if (!error.unauthorized) notify(error.message, true);
});

setInterval(() => refreshLiveDashboard(), 5_000);
