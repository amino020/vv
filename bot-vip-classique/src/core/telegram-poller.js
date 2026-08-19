import { log, logError } from '../lib/log.js';

export class TelegramPoller {
  constructor({ telegram, store, processor }) {
    this.telegram = telegram;
    this.store = store;
    this.processor = processor;
    this.running = false;
    this.lastError = null;
    this.lastUpdateAt = null;
    this.loopPromise = null;
  }

  status() {
    return {
      configured: this.telegram.configured,
      running: this.running,
      lastError: this.lastError,
      lastUpdateAt: this.lastUpdateAt,
      bot: this.telegram.botInfo ? {
        id: String(this.telegram.botInfo.id),
        username: String(this.telegram.botInfo.username || ''),
        firstName: String(this.telegram.botInfo.first_name || ''),
      } : null,
    };
  }

  async start() {
    if (!this.telegram.configured || this.loopPromise) return false;
    await this.telegram.getMe();
    await this.telegram.deleteWebhook();
    this.running = true;
    this.loopPromise = this.#loop().finally(() => { this.loopPromise = null; });
    log('telegram.polling_started');
    return true;
  }

  stop() {
    this.running = false;
    this.telegram.abortLongPoll();
  }

  async restart() {
    this.stop();
    if (this.loopPromise) await this.loopPromise.catch(() => {});
    this.lastError = null;
    return this.start();
  }

  async #loop() {
    let failures = 0;
    while (this.running) {
      try {
        const state = await this.store.read();
        const updates = await this.telegram.getUpdates(Number(state.telegramOffset || 0));
        for (const update of updates) {
          await this.processor.processUpdate(update);
          await this.store.mutate((draft) => {
            draft.telegramOffset = Math.max(Number(draft.telegramOffset || 0), Number(update.update_id) + 1);
          });
          this.lastUpdateAt = new Date().toISOString();
        }
        failures = 0;
        this.lastError = null;
      } catch (error) {
        if (!this.running) break;
        failures += 1;
        this.lastError = String(error?.code || error?.name || 'telegram_error');
        logError('telegram.poll_failed', error, { failures });
        await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, failures * 2_000)));
      }
    }
    this.running = false;
  }
}
