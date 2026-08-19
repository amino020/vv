import { contactUrl, findStep } from './funnel.js';

const PAID_CLAIM = /\b(j['’]?ai\s+(?:bien\s+)?pay[ée]|paiement\s+(?:est\s+)?(?:fait|effectu[ée]|valid[ée])|c['’]?est\s+pay[ée]|je\s+viens\s+de\s+payer)\b/i;

function nowIso() {
  return new Date().toISOString();
}

function leadFromMessage(message, previous = {}) {
  const user = message.from || {};
  return {
    ...previous,
    chatId: String(message.chat.id),
    username: String(user.username || previous.username || '').slice(0, 100),
    firstName: String(user.first_name || previous.firstName || '').slice(0, 100),
    status: previous.status || 'new',
    paymentStatus: previous.paymentStatus || 'unpaid',
    startedAt: previous.startedAt || nowIso(),
    lastSeenAt: nowIso(),
  };
}

function contactKeyboard(config) {
  const url = contactUrl(config);
  return url ? { inline_keyboard: [[{ text: 'M’écrire directement', url }]] } : undefined;
}

export class BotProcessor {
  constructor({ store, telegram, operatorChatId }) {
    this.store = store;
    this.telegram = telegram;
    this.operatorChatId = operatorChatId;
  }

  setOperatorChatId(operatorChatId) {
    this.operatorChatId = String(operatorChatId || '').trim();
  }

  async processUpdate(update) {
    if (update.callback_query) return this.#processCallback(update.callback_query);
    if (update.message?.chat?.type === 'private') return this.#processMessage(update.message);
    return false;
  }

  async #processMessage(message) {
    const chatId = String(message.chat.id);
    const state = await this.store.read();
    const previous = state.leads[chatId] || {};
    const lead = leadFromMessage(message, previous);
    await this.store.mutate((draft) => { draft.leads[chatId] = lead; });

    const text = String(message.text || message.caption || '');
    if (/^\/id(?:\s|$)/i.test(text)) {
      await this.telegram.sendMessage(chatId, `Ton identifiant Telegram est : ${chatId}`);
      return true;
    }
    if (/^\/(start|help)(?:\s|$)/i.test(text)) {
      return this.sendStep(chatId, state.config.steps[0]?.id);
    }

    const atPaymentStep = previous.stepId === 'join' || previous.stepId === 'payment-howto' || previous.status === 'claimed';
    const screenshot = Array.isArray(message.photo) && message.photo.length > 0;
    if (PAID_CLAIM.test(text) || (screenshot && atPaymentStep)) {
      return this.claimPayment(chatId, { messageId: message.message_id, screenshot });
    }

    const lastFallback = Date.parse(previous.lastFallbackAt || 0);
    if (!Number.isFinite(lastFallback) || Date.now() - lastFallback > 12 * 60 * 60 * 1_000) {
      await this.store.mutate((draft) => {
        if (draft.leads[chatId]) draft.leads[chatId].lastFallbackAt = nowIso();
      });
      await this.telegram.sendMessage(
        chatId,
        'Ce parcours est automatique. Utilise les boutons pour découvrir le VIP ou viens m’écrire directement si tu veux parler avec moi.',
        contactKeyboard(state.config),
      );
    }
    return true;
  }

  async #processCallback(callback) {
    const chatId = String(callback.message?.chat?.id || callback.from?.id || '');
    if (!chatId) return false;
    await this.store.mutate((draft) => {
      const actor = callback.from || {};
      const lead = draft.leads[chatId] || {
        chatId, status: 'new', paymentStatus: 'unpaid', startedAt: nowIso(),
      };
      lead.username = String(actor.username || lead.username || '').slice(0, 100);
      lead.firstName = String(actor.first_name || lead.firstName || '').slice(0, 100);
      lead.lastSeenAt = nowIso();
      draft.leads[chatId] = lead;
    });
    const data = String(callback.data || '');
    if (data.startsWith('step:')) {
      await this.telegram.answerCallbackQuery(callback.id);
      return this.sendStep(chatId, data.slice(5));
    }
    if (data === 'claim:payment') {
      await this.telegram.answerCallbackQuery(callback.id, 'Demande envoyée pour vérification');
      return this.claimPayment(chatId, { screenshot: false });
    }
    await this.telegram.answerCallbackQuery(callback.id);
    return false;
  }

  async sendStep(chatId, stepId) {
    const state = await this.store.read();
    const step = findStep(state.config, stepId);
    if (!step) return false;
    await this.store.mutate((draft) => {
      const lead = draft.leads[chatId] || {
        chatId, status: 'new', paymentStatus: 'unpaid', startedAt: nowIso(),
      };
      lead.stepId = step.id;
      lead.status = lead.status === 'new' ? 'funnel' : lead.status;
      lead.lastSeenAt = nowIso();
      draft.leads[chatId] = lead;
    });
    await this.telegram.sendStep(chatId, step, state.config);
    return true;
  }

  async claimPayment(chatId, { messageId, screenshot = false } = {}) {
    const state = await this.store.read();
    const existing = state.leads[chatId] || { chatId };
    if (existing.paymentStatus === 'verified') {
      await this.telegram.sendMessage(chatId, state.config.verifiedReply, this.#vipKeyboard(state.config));
      return { alreadyVerified: true };
    }
    await this.store.mutate((draft) => {
      const lead = draft.leads[chatId] || { chatId, startedAt: nowIso() };
      lead.status = 'claimed';
      lead.paymentStatus = 'claimed';
      lead.humanReview = true;
      lead.claimedAt = lead.claimedAt || nowIso();
      lead.lastSeenAt = nowIso();
      lead.screenshotReceived = lead.screenshotReceived || screenshot;
      draft.leads[chatId] = lead;
    });

    if (!existing.claimAcknowledgedAt) {
      await this.telegram.sendMessage(chatId, state.config.claimReply, contactKeyboard(state.config));
      await this.store.mutate((draft) => {
        if (draft.leads[chatId]) draft.leads[chatId].claimAcknowledgedAt = nowIso();
      });
    }

    const latest = (await this.store.read()).leads[chatId];
    if (this.operatorChatId && !latest.operatorNotifiedAt) {
      const identity = latest.username ? `@${latest.username}` : latest.firstName || `Telegram ${chatId}`;
      try {
        await this.telegram.sendMessage(
          this.operatorChatId,
          `Paiement à vérifier pour ${identity}. Ouvre le panneau avant d’accorder l’accès VIP.`,
        );
        await this.store.mutate((draft) => {
          if (!draft.leads[chatId]) return;
          draft.leads[chatId].operatorNotifiedAt = nowIso();
          delete draft.leads[chatId].operatorNotificationError;
        });
      } catch (error) {
        await this.store.mutate((draft) => {
          if (draft.leads[chatId]) draft.leads[chatId].operatorNotificationError = String(error?.code || 'telegram_error');
        });
      }
    } else if (!this.operatorChatId) {
      await this.store.mutate((draft) => {
        if (draft.leads[chatId]) draft.leads[chatId].operatorNotificationError = 'operator_not_configured';
      });
    }

    if (this.operatorChatId && screenshot && messageId) {
      const forwarded = Array.isArray(latest.forwardedScreenshotMessageIds) ? latest.forwardedScreenshotMessageIds : [];
      if (!forwarded.includes(messageId)) {
        try {
          await this.telegram.forwardMessage(this.operatorChatId, chatId, messageId);
          await this.store.mutate((draft) => {
            const lead = draft.leads[chatId];
            if (!lead) return;
            lead.forwardedScreenshotMessageIds = [...new Set([...(lead.forwardedScreenshotMessageIds || []), messageId])].slice(-10);
          });
        } catch (error) {
          await this.store.mutate((draft) => {
            if (draft.leads[chatId]) draft.leads[chatId].screenshotForwardError = String(error?.code || 'telegram_error');
          });
        }
      }
    }
    return { claimed: true, duplicate: existing.paymentStatus === 'claimed' };
  }

  #vipKeyboard(config) {
    const rows = [];
    if (/^https:\/\//i.test(config.vipInviteLink || '')) rows.push([{ text: 'Ouvrir mon accès VIP', url: config.vipInviteLink }]);
    const contact = contactUrl(config);
    if (contact) rows.push([{ text: 'M’écrire directement', url: contact }]);
    return rows.length ? { inline_keyboard: rows } : undefined;
  }

  async approveLead(chatId, source = 'operator') {
    const state = await this.store.read();
    const existing = state.leads[String(chatId)];
    if (!existing) throw Object.assign(new Error('Prospect introuvable'), { statusCode: 404 });
    const alreadyDelivered = Boolean(existing.accessDeliveredAt);
    await this.store.mutate((draft) => {
      const lead = draft.leads[String(chatId)];
      lead.status = 'verified';
      lead.paymentStatus = 'verified';
      lead.humanReview = false;
      lead.verifiedAt = lead.verifiedAt || nowIso();
      lead.verifiedBy = source === 'stripe' ? 'stripe_webhook' : 'operator';
    });
    if (!alreadyDelivered) {
      await this.telegram.sendMessage(String(chatId), state.config.verifiedReply, this.#vipKeyboard(state.config));
      await this.store.mutate((draft) => {
        if (draft.leads[String(chatId)]) draft.leads[String(chatId)].accessDeliveredAt = nowIso();
      });
    }
    return (await this.store.read()).leads[String(chatId)];
  }

  async rejectClaim(chatId) {
    return this.store.mutate((draft) => {
      const lead = draft.leads[String(chatId)];
      if (!lead) throw Object.assign(new Error('Prospect introuvable'), { statusCode: 404 });
      lead.status = 'reviewed';
      lead.paymentStatus = 'unpaid';
      lead.humanReview = false;
      lead.reviewedAt = nowIso();
      return lead;
    });
  }
}
