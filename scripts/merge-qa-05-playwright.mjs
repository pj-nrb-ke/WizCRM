#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = path.join(root, 'web', 'e2e-report', 'results.json');
const outPath = path.join(root, 'docs', 'QA', 'results', 'qa-security-performance.json');

function flatten(suites, prefix = '') {
  const rows = [];
  for (const suite of suites ?? []) {
    const title = prefix ? `${prefix} › ${suite.title}` : suite.title;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const st = t.status ?? t.results?.[0]?.status;
        const ok = st === 'expected' || st === 'passed';
        const skipped = st === 'skipped';
        rows.push({
          category: title.includes('Mobile') ? 'Mobile' : title.includes('Performance') ? 'Performance' : 'Security',
          test: spec.title,
          status: skipped ? 'SKIP' : ok ? 'PASS' : 'FAIL',
          notes: t.results?.[0]?.error?.message?.split('\n')[0] ?? '',
        });
      }
    }
    rows.push(...flatten(suite.suites, title));
  }
  return rows;
}

const existing = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
  : {};
const pw = fs.existsSync(pwPath) ? JSON.parse(fs.readFileSync(pwPath, 'utf8')) : { suites: [] };
const playwright = flatten(pw.suites);

const mobile = {
  category: 'Mobile',
  test: 'npm test --prefix mobile (unit)',
  status: process.env.QA_MOBILE_UNIT_STATUS === 'fail' ? 'FAIL' : 'PASS',
  notes: process.env.QA_MOBILE_UNIT_NOTES ?? '',
};

fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      ...existing,
      playwright,
      mobileUnit: mobile,
      playwrightRanAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  'utf8',
);
console.log(`Merged ${playwright.length} Playwright rows into ${outPath}`);
