#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'QA', 'results', 'qa-cycle-003.json'), 'utf8'),
);
const out = path.join(root, 'docs', 'QA', 'results', 'QA-Test-003-SUMMARY.md');

const lines = [
  `# QA Test ${p.cycle} — Enterprise Enforcement`,
  '',
  `**Date:** ${p.ranAt?.slice(0, 10)}`,
  `**Excel:** [WizCRM-QA-Test-003.xlsx](../WizCRM-QA-Test-003.xlsx)`,
  `**Instructions:** ${p.instructions}`,
  '',
  '## Result',
  '',
  `| Metric | Value |`,
  `|--------|------:|`,
  `| **Overall** | **${p.summary.overall}** |`,
  `| Passed | ${p.summary.passed} |`,
  `| Failed | ${p.summary.failed} |`,
  `| Total | ${p.summary.total} |`,
  '',
  '## Mandatory counts met',
  '',
  `| Category | Required | Run |`,
  `|----------|--------:|----:|`,
  `| Duplicate prevention | 25 | ${p.summary.duplicateCount} |`,
  `| Race condition | 20 | ${p.summary.raceCount} |`,
  `| Session recovery | 20 | ${p.summary.sessionCount} |`,
  `| Multi-tab | 15 | ${p.summary.multiTabCount} |`,
  `| Long-duration | 10 | ${p.summary.longDurationCount} (${p.summary.totalNavActions} nav actions) |`,
  `| Frontend sync | — | ${p.summary.frontendSyncCount} |`,
  '',
  '## Top critical finding',
  '',
  '**Concurrent duplicate lead creation** — parallel POST with the same phone/email can create 2+ rows (23/25 duplicate tests failed). Sequential duplicate returns 409 correctly; race window is the defect.',
  '',
  'See **Critical Issues** and **Recommended Fixes** sheets in Excel.',
];

fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out}`);
