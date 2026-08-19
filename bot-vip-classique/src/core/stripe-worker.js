import { randomUUID } from 'node:crypto';
import { logError } from '../lib/log.js';

function chatIdFromReference(reference) {
  return String(reference || '').match(/^tg_(\d+)$/)?.[1] || '';
}

export class StripeWorker {
  constructor({ store, processor }) {
    this.store = store;
    this.processor = processor;
    this.timer = null;
    this.running = false;
  }

  async enqueue(event) {
    return this.store.mutate((draft) => {
      if (draft.processedStripeEvents.includes(event.id) || draft.jobs.some((job) => job.event?.id === event.id)) {
        return { duplicate: true };
      }
      draft.jobs.push({
        id: randomUUID(), type: 'stripe_event', status: 'queued', attempts: 0,
        nextRunAt: new Date().toISOString(), createdAt: new Date().toISOString(), event,
      });
      return { queued: true };
    });
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch((error) => logError('stripe_worker.tick_failed', error)), 750);
    this.timer.unref?.();
    this.tick().catch((error) => logError('stripe_worker.tick_failed', error));
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.store.mutate((draft) => {
        const due = draft.jobs.find((candidate) => candidate.status === 'queued'
          && Date.parse(candidate.nextRunAt || 0) <= Date.now());
        if (!due) return null;
        due.status = 'processing';
        due.attempts += 1;
        due.startedAt = new Date().toISOString();
        return due;
      });
      if (!job) return;
      try {
        await this.#process(job.event);
        await this.store.mutate((draft) => {
          draft.jobs = draft.jobs.filter((candidate) => candidate.id !== job.id);
          draft.processedStripeEvents.push(job.event.id);
          draft.processedStripeEvents = draft.processedStripeEvents.slice(-1_000);
        });
      } catch (error) {
        await this.store.mutate((draft) => {
          const current = draft.jobs.find((candidate) => candidate.id === job.id);
          if (!current) return;
          current.status = current.attempts >= 8 ? 'failed' : 'queued';
          current.nextRunAt = new Date(Date.now() + Math.min(60_000, 2 ** current.attempts * 1_000)).toISOString();
          current.lastError = String(error?.code || error?.name || 'error');
        });
        logError('stripe_worker.job_failed', error, { eventType: job.event.type, attempts: job.attempts });
      }
    } finally {
      this.running = false;
    }
  }

  async #process(event) {
    const state = await this.store.read();
    const byReference = chatIdFromReference(event.clientReferenceId);
    const byCustomer = Object.values(state.leads).find((lead) => lead.stripeCustomerId && lead.stripeCustomerId === event.customerId)?.chatId;
    const chatId = byReference || byCustomer || '';
    if (!chatId) return;

    if (event.type === 'checkout.session.completed') {
      await this.store.mutate((draft) => {
        const lead = draft.leads[String(chatId)];
        if (!lead) return;
        if (event.customerId) lead.stripeCustomerId = event.customerId;
        if (event.subscriptionId) lead.stripeSubscriptionId = event.subscriptionId;
      });
      if (['paid', 'no_payment_required'].includes(event.paymentStatus)) {
        await this.processor.approveLead(chatId, 'stripe');
      }
      return;
    }
    if (event.type === 'checkout.session.async_payment_succeeded' || event.type === 'invoice.paid') {
      await this.processor.approveLead(chatId, 'stripe');
      return;
    }
    if (['checkout.session.async_payment_failed', 'invoice.payment_failed'].includes(event.type)) {
      await this.store.mutate((draft) => {
        const lead = draft.leads[String(chatId)];
        if (!lead) return;
        lead.paymentStatus = 'payment_failed';
        lead.status = 'payment_attention';
      });
      return;
    }
    if (event.type === 'customer.subscription.deleted') {
      await this.store.mutate((draft) => {
        const lead = draft.leads[String(chatId)];
        if (!lead) return;
        lead.paymentStatus = 'canceled';
        lead.status = 'former_member';
      });
    }
  }
}
