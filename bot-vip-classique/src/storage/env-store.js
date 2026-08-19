import { readFile, rename, writeFile } from 'node:fs/promises';

function cleanValue(value) {
  const result = String(value ?? '').trim();
  if (/[\r\n\0]/.test(result)) throw Object.assign(new Error('Valeur de configuration invalide'), { statusCode: 400 });
  return result;
}

export async function updateEnvFile(file, changes) {
  let source = '';
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const pending = new Map(Object.entries(changes).map(([key, value]) => [key, cleanValue(value)]));
  const output = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !pending.has(match[1])) {
      if (line || output.length) output.push(line);
      continue;
    }
    output.push(`${match[1]}=${pending.get(match[1])}`);
    pending.delete(match[1]);
  }
  for (const [key, value] of pending) output.push(`${key}=${value}`);
  while (output.at(-1) === '') output.pop();
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${output.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
}
