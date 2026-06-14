#!/usr/bin/env node
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getQaDir, qaExcelFileName } from './qa-report-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-004.json');

function styleHeader(row) {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
}

function autoWidth(ws) {
  ws.columns.forEach((col) => {
    let w = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      w = Math.min(70, Math.max(w, String(cell.value ?? '').length + 2));
    });
    col.width = w;
  });
}

function addSheet(wb, name, headers, rows, map) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  styleHeader(ws.getRow(1));
  for (const r of rows) ws.addRow(headers.map((h) => map(r, h)));
  autoWidth(ws);
}

const p = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const wb = new ExcelJS.Workbook();
wb.creator = 'WizCRM QA';
wb.created = new Date();

const sum = wb.addWorksheet('Test Summary');
[
  ['Cycle', p.cycle],
  ['Date', p.ranAt?.slice(0, 10)],
  ['Overall', p.summary?.overall],
  ['Automated total', p.summary?.total],
  ['Passed', p.summary?.passed],
  ['Failed', p.summary?.failed],
  ['Duplicate tests', `${p.summary?.duplicatePassed}/${p.summary?.duplicateCount}`],
  ['Manual remaining', 'MOBILE-PILOT.md (1)'],
  ['Fix applied', 'Advisory lock + transactional duplicate guard on lead create'],
  ['Prior failure doc', 'WizCRM-QA-Test-003.xlsx (23 duplicate fails pre-fix)'],
].forEach((r) => sum.addRow(r));
styleHeader(sum.getRow(1));
autoWidth(sum);

const cols = ['ID', 'Test', 'Status', 'Assertions', 'Notes'];
const stdMap = (r, h) =>
  ({ ID: r.id ?? '', Test: r.test, Status: r.status, Assertions: r.assertions ?? '', Notes: r.notes ?? '' })[h];

addSheet(wb, 'Duplicate Prevention Tests', cols, p.duplicatePrevention ?? [], stdMap);
addSheet(wb, 'Race Condition Tests', cols, p.raceCondition ?? [], stdMap);
addSheet(wb, 'Session Recovery Tests', cols, p.sessionRecovery ?? [], stdMap);
addSheet(wb, 'Multi-Tab Tests', cols, p.multiTab ?? [], stdMap);
addSheet(wb, 'Long-Duration Stability', cols, p.longDuration ?? [], stdMap);
addSheet(wb, 'Frontend Sync Tests', cols, p.frontendSync ?? [], stdMap);

addSheet(
  wb,
  'Security Tests',
  cols,
  p.securityApi ?? [],
  stdMap,
);

addSheet(
  wb,
  'UX Findings',
  ['ID', 'Severity', 'Finding'],
  p.uxFindings ?? [],
  (r, h) => ({ ID: r.id, Severity: r.severity, Finding: r.finding })[h],
);

addSheet(
  wb,
  'Evidence Index',
  ['Artifact', 'Path'],
  p.evidence ?? [],
  (r, h) => ({ Artifact: r.artifact, Path: r.path })[h],
);

addSheet(
  wb,
  'Critical Issues',
  ['ID', 'Severity', 'Test', 'Notes'],
  p.criticalIssues ?? [],
  (r, h) => ({ ID: r.id, Severity: r.severity, Test: r.test, Notes: r.notes })[h],
);

addSheet(
  wb,
  'Recommended Fixes',
  ['ID', 'Priority', 'Action', 'Notes'],
  p.recommendedFixes ?? [],
  (r, h) => ({ ID: r.id, Priority: r.priority, Action: r.action, Notes: r.notes })[h],
);

addSheet(
  wb,
  'Manual Remaining',
  ['ID', 'Test', 'Status', 'Notes'],
  p.manualRemaining ?? [],
  (r, h) => ({ ID: r.id, Test: r.test, Status: r.status, Notes: r.notes })[h],
);

const out = path.join(getQaDir(), qaExcelFileName('004'));
await wb.xlsx.writeFile(out);
console.log(`Wrote ${out}`);
