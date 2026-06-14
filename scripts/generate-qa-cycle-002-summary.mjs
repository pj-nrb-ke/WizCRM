#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-002.json');
const outPath = path.join(root, 'docs', 'QA', 'results', 'QA-Test-002-SUMMARY.md');

const p = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const lines = [
  `# QA Test ${p.cycle} — Enterprise Summary`,
  '',
  `**Date:** ${p.ranAt?.slice(0, 10)}`,
  `**Target:** ${p.baseUrl} (API: ${p.apiUrl})`,
  `**Excel:** [WizCRM-QA-Test-002.xlsx](../WizCRM-QA-Test-002.xlsx)`,
  `**Instructions:** ${p.instructions}`,
  '',
  '## Result',
  '',
  `| Metric | Value |`,
  `|--------|------:|`,
  `| Overall | **${p.summary.overall}** |`,
  `| Passed | ${p.summary.passed} |`,
  `| Failed | ${p.summary.failed} |`,
  `| Total | ${p.summary.total} |`,
  '',
  '## Focus areas',
  '',
  '- Frontend/backend synchronization (assertion-heavy)',
  '- Duplicate prevention',
  '- Race conditions',
  '- Session recovery',
  '- Multi-tab conflicts',
  '- Long-duration stability (60 nav cycles)',
  '',
];

if (p.criticalIssues?.length) {
  lines.push('## Critical issues', '', '| ID | Severity | Test |', '|----|----------|------|');
  for (const c of p.criticalIssues) {
    lines.push(`| ${c.id} | ${c.severity} | ${c.test} |`);
  }
}

lines.push('', 'Full detail in Excel workbook sheets.');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath}`);
