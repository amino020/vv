export function log(event, details = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (/token|secret|key|message|caption|payload/i.test(key)) continue;
    safe[key] = value;
  }
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), event, ...safe })}\n`);
}

export function logError(event, error, details = {}) {
  log(event, { ...details, error: String(error?.code || error?.name || 'error') });
}
