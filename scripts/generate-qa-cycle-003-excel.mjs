#!/usr/bin/env node
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getQaDir, qaExcelFileName } from './qa-report-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-003.json');

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

function sheet(wb, name, headers, rows, mapRow) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  styleHeader(ws.getRow(1));
  for (const r of rows) {
    ws.addRow(headers.map((h) => mapRow(r, h)));
  }
  autoWidth(ws);
}

export async function writeCycle003Excel() {
  const p = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WizCRM QA Enforcement';
  wb.created = new Date();

  const sum = wb.addWorksheet('Test Summary');
  [
    ['Cycle', p.cycle],
    ['Date', p.ranAt?.slice(0, 10)],
    ['Web', p.baseUrl],
    ['API', p.apiUrl],
    ['Instructions', p.instructions],
    ['Overall', p.summary?.overall],
    ['Total tests', p.summary?.total],
    ['Passed', p.summary?.passed],
    ['Failed', p.summary?.failed],
    ['Duplicate tests', p.summary?.duplicateCount],
    ['Race tests', p.summary?.raceCount],
    ['Session tests', p.summary?.sessionCount],
    ['Multi-tab tests', p.summary?.multiTabCount],
    ['Long-duration tests', p.summary?.longDurationCount],
    ['Frontend sync tests', p.summary?.frontendSyncCount],
    ['Total nav actions (LD)', p.summary?.totalNavActions],
    ['Philosophy', 'Destructive enterprise abuse — state must verify'],
  ].forEach((r) => sum.addRow(r));
  styleHeader(sum.getRow(1));
  autoWidth(sum);

  const cols = ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence', 'Reproduction'];
  const map = (r, h) =>
    ({
      ID: r.id ?? '',
      Test: r.test,
      Status: r.status,
      Assertions: r.assertions ?? '',
      ms: r.durationMs ?? '',
      Notes: r.notes ?? '',
      Evidence: r.evidence ?? '',
      Reproduction: r.reproduction ?? '',
    })[h];

  sheet(wb, 'Duplicate Prevention Tests', cols, p.duplicatePrevention ?? [], map);
  sheet(wb, 'Race Condition Tests', cols, p.raceCondition ?? [], map);
  sheet(wb, 'Session Recovery Tests', cols, p.sessionRecovery ?? [], map);
  sheet(wb, 'Multi-Tab Tests', cols, p.multiTab ?? [], map);
  sheet(wb, 'Long-Duration Stability', cols, p.longDuration ?? [], map);
  sheet(wb, 'Frontend Sync Tests', cols, p.frontendSync ?? [], map);

  sheet(
    wb,
    'UX Findings',
    ['ID', 'Severity', 'Finding'],
    p.uxFindings ?? [],
    (r, h) => ({ ID: r.id, Severity: r.severity, Finding: r.finding })[h],
  );
  sheet(
    wb,
    'Evidence Index',
    ['Artifact', 'Path'],
    p.evidence ?? [],
    (r, h) => ({ Artifact: r.artifact, Path: r.path })[h],
  );
  sheet(
    wb,
    'Critical Issues',
    ['ID', 'Severity', 'Test', 'Notes', 'Evidence'],
    p.criticalIssues ?? [],
    (r, h) =>
      ({ ID: r.id, Severity: r.severity, Test: r.test, Notes: r.notes, Evidence: r.evidence ?? '' })[
        h
      ],
  );
  sheet(
    wb,
    'Recommended Fixes',
    ['ID', 'Priority', 'Action', 'Notes'],
    p.recommendedFixes ?? [],
    (r, h) => ({ ID: r.id, Priority: r.priority, Action: r.action, Notes: r.notes })[h],
  );

  const out = path.join(getQaDir(), qaExcelFileName('003'));
  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${out}`);
}

writeCycle003Excel().catch((e) => {
  console.error(e);
  process.exit(1);
});
