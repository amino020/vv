import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { keyboardForStep, localMediaPath } from '../core/funnel.js';
import { telegramHtml } from '../core/telegram-format.js';

function telegramError(method, response, body) {
  const error = new Error(`Telegram ${method} a refusé la requête`);
  error.code = `TELEGRAM_${response.status}`;
  error.retryAfter = Number(body?.parameters?.retry_after || 0);
  return error;
}

export class TelegramAdapter {
  constructor({ token, mediaDir, fetchImpl = fetch, delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) }) {
    this.token = token;
    this.mediaDir = mediaDir;
    this.fetch = fetchImpl;
    this.delay = delay;
    this.baseUrl = token ? `https://api.telegram.org/bot${token}` : '';
    this.pollController = null;
    this.botInfo = null;
  }

  get configured() {
    return Boolean(this.token);
  }

  setToken(token) {
    this.abortLongPoll();
    this.token = String(token || '').trim();
    this.baseUrl = this.token ? `https://api.telegram.org/bot${this.token}` : '';
    this.botInfo = null;
  }

  async call(method, payload = {}, { signal } = {}) {
    if (!this.configured) throw Object.assign(new Error('Token Telegram absent'), { code: 'TELEGRAM_NOT_CONFIGURED' });
    const response = await this.fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal || AbortSignal.timeout(method === 'getUpdates' ? 35_000 : 15_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) throw telegramError(method, response, body);
    return body.result;
  }

  async callWithFile(method, payload, fieldName, filePath) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null || value === '') continue;
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const data = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mime = extension === '.mp4' ? 'video/mp4'
      : extension === '.ogg' ? 'audio/ogg'
        : extension === '.mp3' ? 'audio/mpeg'
          : extension === '.m4a' ? 'audio/mp4'
      : extension === '.webp' ? 'image/webp'
        : extension === '.png' ? 'image/png' : 'image/jpeg';
    form.append(fieldName, new Blob([data], { type: mime }), path.basename(filePath));
    const response = await this.fetch(`${this.baseUrl}/${method}`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) throw telegramError(method, response, body);
    return body.result;
  }

  async getUpdates(offset) {
    const controller = new AbortController();
    this.pollController = controller;
    try {
      return await this.call('getUpdates', {
        offset, limit: 100, timeout: 25,
        allowed_updates: ['message', 'callback_query'],
      }, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]) });
    } finally {
      if (this.pollController === controller) this.pollController = null;
    }
  }

  abortLongPoll() {
    this.pollController?.abort();
    this.pollController = null;
  }

  async getMe() {
    const bot = await this.call('getMe');
    this.botInfo = bot;
    return bot;
  }

  deleteWebhook() {
    return this.call('deleteWebhook', { drop_pending_updates: false });
  }

  answerCallbackQuery(id, text = '') {
    return this.call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
  }

  sendMessage(chatId, text, replyMarkup) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text: telegramHtml(text),
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      disable_web_page_preview: true,
    });
  }

  async sendStep(chatId, step, config) {
    const replyMarkup = keyboardForStep(step, config, chatId);
    const text = String(step.text || '');
    const localPath = localMediaPath(this.mediaDir, step.media);
    if (['photo', 'video', 'voice'].includes(step.mediaType)) {
      const method = step.mediaType === 'video' ? 'sendVideo' : step.mediaType === 'voice' ? 'sendVoice' : 'sendPhoto';
      const field = step.mediaType === 'video' ? 'video' : step.mediaType === 'voice' ? 'voice' : 'photo';
      const payload = {
        chat_id: chatId,
        caption: text.length <= 1_000 ? telegramHtml(text, 1_000) : undefined,
        parse_mode: text.length <= 1_000 ? 'HTML' : undefined,
        reply_markup: text.length <= 1_000 ? replyMarkup : undefined,
        supports_streaming: step.mediaType === 'video' ? true : undefined,
      };
      if (step.mediaType === 'voice') {
        await this.call('sendChatAction', { chat_id: chatId, action: 'record_voice' }).catch(() => {});
        await this.delay(900);
        await this.call('sendChatAction', { chat_id: chatId, action: 'upload_voice' }).catch(() => {});
      }
      if (localPath) await this.callWithFile(method, payload, field, localPath);
      else if (/^https:\/\//i.test(step.media || '')) await this.call(method, { ...payload, [field]: step.media });
      else return this.sendMessage(chatId, text, replyMarkup);
      if (text.length > 1_000) return this.sendMessage(chatId, text, replyMarkup);
      return true;
    }
    return this.sendMessage(chatId, text, replyMarkup);
  }

  forwardMessage(operatorChatId, sourceChatId, messageId) {
    return this.call('forwardMessage', {
      chat_id: operatorChatId,
      from_chat_id: sourceChatId,
      message_id: messageId,
    });
  }
}
