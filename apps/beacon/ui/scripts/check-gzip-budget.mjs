// Fails when the initial bundle of a built Angular app is over a gzipped budget.
// Angular's own budgets measure raw sizes only; this measures what a browser
// downloads before the first render: every script, stylesheet and modulepreload
// referenced by index.html, each gzipped at level 6 (a typical server setting).
//
// usage: node check-gzip-budget.mjs <output dir> <budget in KB>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [dir, budgetArg] = process.argv.slice(2);
const budget = Number(budgetArg) * 1000;
if (!dir || !Number.isFinite(budget) || budget <= 0) {
  console.error('usage: node check-gzip-budget.mjs <output dir> <budget in KB>');
  process.exit(2);
}

const index = readFileSync(join(dir, 'index.html'), 'utf8');
const refs = [...index.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)]
  .map(([, ref]) => ref)
  .filter((ref) => /\.(js|css)$/.test(ref) && !/^[a-z]+:/i.test(ref));
const files = [...new Set(refs)].map((ref) => ({
  ref,
  size: gzipSync(readFileSync(join(dir, ref)), { level: 6 }).length,
}));
const total = files.reduce((sum, f) => sum + f.size, 0);

const kb = (n) => `${(n / 1000).toFixed(1)} KB`;
for (const f of files) console.log(`  ${f.ref.padEnd(40)} ${kb(f.size)}`);
console.log(`initial (gzip): ${kb(total)} of ${kb(budget)}`);
if (total > budget) {
  console.error(`over the initial budget by ${kb(total - budget)}`);
  process.exit(1);
}
