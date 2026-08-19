import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initialState } from '../core/defaults.js';

function normalizeState(value) {
  const fallback = initialState();
  const state = value && typeof value === 'object' ? value : {};
  return {
    ...fallback,
    ...state,
    config: { ...fallback.config, ...(state.config || {}) },
    leads: state.leads && typeof state.leads === 'object' ? state.leads : {},
    jobs: Array.isArray(state.jobs) ? state.jobs : [],
    processedStripeEvents: Array.isArray(state.processedStripeEvents) ? state.processedStripeEvents : [],
  };
}

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.state = initialState();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.state = normalizeState(JSON.parse(await readFile(this.file, 'utf8')));
      let recovered = false;
      for (const job of this.state.jobs) {
        if (job.status === 'processing') {
          job.status = 'queued';
          job.nextRunAt = new Date().toISOString();
          recovered = true;
        }
      }
      if (recovered) await this.#persist();
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.#persist();
    }
    return this;
  }

  async read() {
    await this.writeChain;
    return structuredClone(this.state);
  }

  async mutate(mutator) {
    const operation = this.writeChain.then(async () => {
      const draft = structuredClone(this.state);
      const result = await mutator(draft);
      draft.updatedAt = new Date().toISOString();
      this.state = normalizeState(draft);
      await this.#persist();
      return structuredClone(result);
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async #persist() {
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.file);
  }
}
