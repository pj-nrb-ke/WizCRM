#!/usr/bin/env node
/**
 * Builds docs/QA/results/QA-Test-###-SUMMARY.md and docs/QA/WizCRM-QA-Test-###.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReportPayload, qaExcelFileName } from './qa-report-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'QA', 'results');

const p = buildReportPayload();

fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, `QA-Test-${p.cycle}-SUMMARY.md`);

const lines = [
  `# QA Test ${p.cycle} — Summary`,
  '',
  `**Date:** ${p.date}`,
  `**Target:** ${p.baseUrl} (API: ${p.apiUrl})`,
  `**Excel:** [${qaExcelFileName(p.cycle)}](../${qaExcelFileName(p.cycle)})`,
  '',
  '## Test Summary',
  '',
  '| Metric | Count |',
  '|--------|------:|',
  `| Frontend passed | ${p.summary.frontendPassed} |`,
  `| Frontend failed | ${p.summary.frontendFailed} |`,
  `| Frontend skipped | ${p.summary.frontendSkipped} |`,
  `| Frontend total | ${p.summary.frontendTotal} |`,
  `| Backend passed | ${p.summary.backendPassed} |`,
  `| Backend failed | ${p.summary.backendFailed} |`,
  `| Enterprise state passed | ${p.summary.enterprisePassed ?? 0} |`,
  `| Security passed | ${p.summary.securityPassed ?? 0} |`,
  `| Security failed | ${p.summary.securityFailed ?? 0} |`,
  `| Overall | ${p.summary.overall} |`,
  '',
  '## Frontend Tests',
  '',
  '| ID | Suite | Test | Status | ms | Notes |',
  '|----|-------|------|--------|---:|-------|',
];

for (const r of p.frontend) {
  lines.push(`| ${r.id} | ${r.suite} | ${r.test} | ${r.status} | ${r.ms} | ${r.notes.replace(/\|/g, '/')} |`);
}

lines.push(
  '',
  '## Security Tests',
  '',
  `See **${qaExcelFileName(p.cycle)}** → Security Tests sheet (${p.summary.securityTotal ?? 0} rows).`,
  '',
  '## UX Findings',
  '',
  '| ID | Severity | Finding |',
  '|----|----------|---------|',
);
for (const u of p.ux) {
  lines.push(`| ${u.id} | ${u.severity} | ${u.finding} |`);
}

lines.push(
  '',
  '## Evidence Index',
  '',
  `See **${qaExcelFileName(p.cycle)}** → Evidence Index sheet.`,
  '',
);

fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`Wrote ${outFile}`);

const { writeQaExcel } = await import('./generate-qa-excel.mjs');
await writeQaExcel(p);