#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'QA', 'results', 'qa-cycle-004.json'), 'utf8'),
);
const out = path.join(root, 'docs', 'QA', 'results', 'QA-Test-004-SUMMARY.md');

const lines = [
  `# QA Test ${p.cycle} — Verification`,
  '',
  `**Excel:** [WizCRM-QA-Test-004.xlsx](../WizCRM-QA-Test-004.xlsx)`,
  `**Overall:** ${p.summary.overall}`,
  '',
  '## Automated QA status',
  '',
  '| Area | Status |',
  '|------|--------|',
  '| Cycles 001–002 (frontend, backend, security) | Complete |',
  '| Cycle 003 enterprise enforcement | Complete (found duplicate race) |',
  '| Cycle 004 duplicate re-test post-fix | See Excel |',
  '',
  '## Manual remaining',
  '',
  '- **MOBILE-PILOT.md** — install production APK on Android and run 5-minute pilot script.',
  '',
];

fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out}`);
