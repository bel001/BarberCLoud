import { readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function files(dir) {
  const entries = await readdir(dir);
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if ((await stat(full)).isDirectory()) result.push(...await files(full));
    else if (full.endsWith('.js')) result.push(full);
  }
  return result;
}

const targets = [...await files('src'), ...await files('scripts'), ...await files('test')];
for (const target of targets) {
  const check = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  if (check.status !== 0) {
    console.error(check.stderr);
    process.exit(check.status || 1);
  }
}
console.log(`Sintaxis válida en ${targets.length} archivos JavaScript.`);
