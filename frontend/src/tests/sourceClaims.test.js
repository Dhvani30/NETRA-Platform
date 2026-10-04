import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const forbidden = [/X archive/i, /Reddit academic replay/i, /Platform Restricted/i, /Static JSONL Replay Layer/i, /Academic Dataset/i];
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);

test('built-source claims cannot invent unavailable imports or Meta restrictions', () => {
  const jsx = walk(sourceRoot).filter(file => /\.[jt]sx?$/.test(file) && !file.includes(`${sep}tests${sep}`));
  for (const file of jsx) {
    const contents = readFileSync(file, 'utf8');
    for (const expression of forbidden) assert.doesNotMatch(contents, expression, `${file} contains a hard-coded source claim`);
  }
});
