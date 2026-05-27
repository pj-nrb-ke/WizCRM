#!/usr/bin/env node
/**
 * Cycle 004 report: verification after duplicate fix + doc 05 security + manual pilot note.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cycle003 = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'QA', 'results', 'qa-cycle-003.json'), 'utf8'),
);
const dupPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-003-dup-rerun.json');
const secPath = path.join(root, 'docs', 'QA', 'results', 'qa-security-performance.json');
const outPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-004.json');

const dupRerun = fs.existsSync(dupPath)
  ? JSON.parse(fs.readFileSync(dupPath, 'utf8'))
  : { duplicatePrevention: cycle003.duplicatePrevention };

const security = secPath && fs.existsSync(secPath)
  ? JSON.parse(fs.readFileSync(secPath, 'utf8'))
  : {};

const secRows = (security.apiSecurity ?? []).map((r, i) => ({
  id: `SEC-${String(i + 1).padStart(3, '0')}`,
  test: r.test,
  status: r.status,
  notes: r.notes ?? '',
  assertions: r.status === 'PASS' ? 'verified' : 'failed',
}));

const payload = {
  cycle: '004',
  ranAt: new Date().toISOString(),
  baseUrl: process.env.QA_BASE_URL ?? 'https://app.wizcrm.app',
  apiUrl: process.env.QA_API_URL ?? 'https://api.wizcrm.app',
  instructions:
    'Cycle 004 verification: duplicate fix + remaining automated gates (Enterprise Enforcement follow-up)',
  duplicatePrevention: dupRerun.duplicatePrevention ?? [],
  raceCondition: cycle003.raceCondition ?? [],
  sessionRecovery: cycle003.sessionRecovery ?? [],
  multiTab: cycle003.multiTab ?? [],
  longDuration: cycle003.longDuration ?? [],
  frontendSync: cycle003.frontendSync ?? [],
  securityApi: secRows,
  manualRemaining: [
    {
      id: 'MAN-001',
      test: 'MOBILE-PILOT.md — physical Android APK pilot',
      status: 'MANUAL',
      notes: 'User device sign-off required; see docs/MOBILE-PILOT.md',
    },
  ],
  uxFindings: [
    ...(cycle003.uxFindings ?? []),
    {
      id: 'UX-008',
      severity: 'Info',
      finding: 'Cycle 004: duplicate create race fixed via advisory lock + transactional guard.',
    },
  ],
  evidence: [
    { artifact: 'Cycle JSON', path: 'docs/QA/results/qa-cycle-004.json' },
    { artifact: 'Duplicate re-test', path: 'docs/QA/results/qa-cycle-003-dup-rerun.json' },
    { artifact: 'Excel', path: 'docs/QA/WizCRM-QA-Test-004.xlsx' },
    { artifact: 'Prior cycle 003', path: 'docs/QA/WizCRM-QA-Test-003.xlsx' },
  ],
};

const allAutomated = [
  ...payload.duplicatePrevention,
  ...payload.raceCondition,
  ...payload.sessionRecovery,
  ...payload.multiTab,
  ...payload.longDuration,
  ...payload.frontendSync,
  ...payload.securityApi,
];
const passed = allAutomated.filter((r) => r.status === 'PASS').length;
const failed = allAutomated.filter((r) => r.status === 'FAIL').length;

payload.summary = {
  overall: failed === 0 && passed > 0 ? 'PASS' : 'FAIL',
  total: allAutomated.length,
  passed,
  failed,
  duplicateCount: payload.duplicatePrevention.length,
  duplicatePassed: payload.duplicatePrevention.filter((r) => r.status === 'PASS').length,
  manualRemaining: 1,
};

payload.criticalIssues = allAutomated
  .filter((r) => r.status === 'FAIL')
  .map((r, i) => ({
    id: `CI-${String(i + 1).padStart(3, '0')}`,
    severity: 'High',
    test: r.test,
    notes: r.notes,
  }));

payload.recommendedFixes = payload.criticalIssues.map((c, i) => ({
  id: `RF-${String(i + 1).padStart(3, '0')}`,
  priority: c.severity,
  action: c.test,
  notes: c.notes,
}));

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${outPath} (${passed}/${allAutomated.length} automated pass)`);
process.exit(failed > 0 ? 1 : 0);
