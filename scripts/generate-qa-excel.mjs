#!/usr/bin/env node
/**
 * Writes docs/QA/WizCRM-QA-Test-###.xlsx per docs/QA/06-QA-Reporting-Excel-Rules.md
 */
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReportPayload, getQaDir, qaExcelFileName } from './qa-report-data.mjs';

function styleHeaderRow(row) {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
}

function autoWidth(worksheet, min = 10, max = 60) {
  worksheet.columns.forEach((col) => {
    let w = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      w = Math.min(max, Math.max(w, len + 2));
    });
    col.width = w;
  });
}

function addSheetSummary(wb, p) {
  const ws = wb.addWorksheet('Test Summary');
  const rows = [
    ['Field', 'Value'],
    ['Cycle', p.cycle],
    ['Date', p.date],
    ['Web URL', p.baseUrl],
    ['API URL', p.apiUrl],
    ['Instructions', p.instructions],
    ['Overall result', p.summary.overall],
    ['Frontend passed', p.summary.frontendPassed],
    ['Frontend failed', p.summary.frontendFailed],
    ['Frontend skipped', p.summary.frontendSkipped],
    ['Frontend total', p.summary.frontendTotal],
    ['Backend passed', p.summary.backendPassed],
    ['Backend failed', p.summary.backendFailed],
    ['Backend total', p.summary.backendTotal],
    ['Notes', p.summaryNotes ?? ''],
    ['Enterprise state passed', p.summary.enterprisePassed ?? 0],
    ['Enterprise state failed', p.summary.enterpriseFailed ?? 0],
    ['Security passed', p.summary.securityPassed ?? 0],
    ['Security failed', p.summary.securityFailed ?? 0],
    ['Security total', p.summary.securityTotal ?? 0],
  ];
  rows.forEach((r) => ws.addRow(r));
  styleHeaderRow(ws.getRow(1));
  autoWidth(ws);
}

function addSheetFromRows(wb, name, headers, dataRows) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  styleHeaderRow(ws.getRow(1));
  for (const row of dataRows) {
    ws.addRow(row);
  }
  autoWidth(ws);
}

export async function writeQaExcel(payload) {
  const p = payload ?? buildReportPayload();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WizCRM QA';
  wb.created = new Date();

  addSheetSummary(wb, p);

  addSheetFromRows(
    wb,
    'Frontend Tests',
    ['ID', 'Suite', 'Test', 'Status', 'ms', 'Notes'],
    p.frontend.map((r) => [r.id, r.suite, r.test, r.status, r.ms, r.notes]),
  );

  addSheetFromRows(
    wb,
    'Backend Tests',
    ['ID', 'Area', 'Test', 'Status', 'Notes'],
    p.backend.map((r) => [r.id, r.area, r.test, r.status, r.notes]),
  );

  addSheetFromRows(
    wb,
    'Security Tests',
    ['ID', 'Category', 'Test', 'Status', 'Notes'],
    p.security.map((r) => [r.id, r.category ?? '', r.test, r.status, r.notes]),
  );

  addSheetFromRows(
    wb,
    'UX Findings',
    ['ID', 'Severity', 'Finding'],
    p.ux.map((r) => [r.id, r.severity, r.finding]),
  );

  addSheetFromRows(
    wb,
    'Evidence Index',
    ['Artifact', 'Path', 'Cycle'],
    p.evidence.map((r) => [r.artifact, r.path, r.cycle]),
  );

  const outPath = path.join(getQaDir(), qaExcelFileName(p.cycle));
  await wb.xlsx.writeFile(outPath);
  console.log(`Wrote ${outPath}`);
  return outPath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  writeQaExcel().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
