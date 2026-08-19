import { TelegramAdapter } from '../adapters/telegram.js';
import { updateEnvFile } from '../storage/env-store.js';

function operatorId(value) {
  const cleaned = String(value || '').trim();
  if (cleaned && !/^-?\d{1,20}$/.test(cleaned)) {
    throw Object.assign(new Error('L’identifiant opérateur Telegram doit être un nombre'), { statusCode: 400 });
  }
  return cleaned;
}

export class TelegramConnectionManager {
  constructor({ config, telegram, poller, processor, adapterFactory = (options) => new TelegramAdapter(options) }) {
    this.config = config;
    this.telegram = telegram;
    this.poller = poller;
    this.processor = processor;
    this.adapterFactory = adapterFactory;
    this.updating = null;
  }

  async update({ token, operatorChatId }) {
    if (this.updating) return this.updating;
    this.updating = this.#update({ token, operatorChatId }).finally(() => { this.updating = null; });
    return this.updating;
  }

  async #update({ token, operatorChatId }) {
    const suppliedToken = String(token || '').trim();
    const nextToken = suppliedToken || this.config.telegramToken;
    if (!nextToken) throw Object.assign(new Error('Colle d’abord le token fourni par BotFather'), { statusCode: 400 });
    const nextOperatorId = operatorId(operatorChatId ?? this.config.operatorChatId);

    const checker = suppliedToken
      ? this.adapterFactory({ token: nextToken, mediaDir: this.config.mediaDir })
      : this.telegram;
    let bot;
    try {
      bot = await checker.getMe();
    } catch {
      throw Object.assign(new Error('Telegram refuse ce token. Copie-le à nouveau depuis BotFather.'), {
        statusCode: 400,
        code: 'TELEGRAM_TOKEN_REJECTED',
      });
    }
    if (!bot?.id || !bot?.username) throw Object.assign(new Error('Telegram n’a pas reconnu ce bot'), { statusCode: 400 });

    await updateEnvFile(this.config.envFile, {
      TELEGRAM_BOT_TOKEN: nextToken,
      TELEGRAM_OPERATOR_CHAT_ID: nextOperatorId,
    });

    this.config.telegramToken = nextToken;
    this.config.operatorChatId = nextOperatorId;
    this.telegram.setToken(nextToken);
    this.telegram.botInfo = bot;
    this.processor.setOperatorChatId(nextOperatorId);
    await this.poller.restart();
    return {
      ok: true,
      bot: { id: String(bot.id), username: String(bot.username), firstName: String(bot.first_name || '') },
      operatorConfigured: Boolean(nextOperatorId),
      telegram: this.poller.status(),
    };
  }
}
