#!/usr/bin/env node
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getQaDir, qaExcelFileName } from './qa-report-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-002.json');

function styleHeader(row) {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
}

function autoWidth(ws) {
  ws.columns.forEach((col) => {
    let w = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      w = Math.min(60, Math.max(w, String(cell.value ?? '').length + 2));
    });
    col.width = w;
  });
}

function addTable(ws, headers, rows) {
  ws.addRow(headers);
  styleHeader(ws.getRow(1));
  for (const row of rows) {
    ws.addRow(headers.map((h) => row[h] ?? ''));
  }
  autoWidth(ws);
}

function loadPayload() {
  if (!fs.existsSync(jsonPath)) throw new Error(`Missing ${jsonPath} — run QA cycle 002 first`);
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

export async function writeCycle002Excel(payload) {
  const p = payload ?? loadPayload();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WizCRM QA';
  wb.created = new Date();

  const summary = wb.addWorksheet('Test Summary');
  [
    ['Field', 'Value'],
    ['Cycle', p.cycle],
    ['Date', p.ranAt?.slice(0, 10)],
    ['Web URL', p.baseUrl],
    ['API URL', p.apiUrl],
    ['Instructions', p.instructions],
    ['Overall', p.summary.overall],
    ['Total tests', p.summary.total],
    ['Passed', p.summary.passed],
    ['Failed', p.summary.failed],
    ['Skipped', p.summary.skipped],
    ['Philosophy', 'PASS only when state/data verified, not UI survival alone'],
  ].forEach((r) => summary.addRow(r));
  styleHeader(summary.getRow(1));
  autoWidth(summary);

  const testSheets = [
    ['Frontend Sync Tests', 'frontendSync', ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence']],
    [
      'Duplicate Prevention Tests',
      'duplicatePrevention',
      ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence'],
    ],
    ['Race Condition Tests', 'raceCondition', ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence']],
    ['Session Recovery Tests', 'sessionRecovery', ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence']],
    ['Multi-Tab Tests', 'multiTab', ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence']],
    ['Long-Duration Stability', 'longDuration', ['ID', 'Test', 'Status', 'Assertions', 'ms', 'Notes', 'Evidence']],
  ];

  for (const [sheetName, key, headers] of testSheets) {
    const ws = wb.addWorksheet(sheetName);
    const rows = (p[key] ?? []).map((r) => ({
      ID: r.id,
      Test: r.test,
      Status: r.status,
      Assertions: r.assertions ?? '',
      ms: r.durationMs ?? '',
      Notes: r.notes ?? '',
      Evidence: r.evidence ?? '',
    }));
    addTable(ws, headers, rows);
  }

  addTable(wb.addWorksheet('UX Findings'), ['ID', 'Severity', 'Finding'], p.uxFindings ?? []);
  addTable(wb.addWorksheet('Visual Findings'), ['ID', 'Test', 'Artifact', 'Notes'], p.visualFindings ?? []);
  addTable(wb.addWorksheet('Evidence Index'), ['Artifact', 'Path'], p.evidence ?? []);
  addTable(
    wb.addWorksheet('Critical Issues'),
    ['ID', 'Severity', 'Suite', 'Test', 'Notes'],
    (p.criticalIssues ?? []).map((c) => ({
      ID: c.id,
      Severity: c.severity,
      Suite: c.suite,
      Test: c.test,
      Notes: c.notes,
    })),
  );
  addTable(
    wb.addWorksheet('Recommended Fixes'),
    ['ID', 'Priority', 'Action', 'Notes'],
    (p.recommendedFixes ?? []).map((r) => ({
      ID: r.id,
      Priority: r.priority,
      Action: r.action,
      Notes: r.notes,
    })),
  );

  const out = path.join(getQaDir(), qaExcelFileName('002'));
  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${out}`);
  return out;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  writeCycle002Excel().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
