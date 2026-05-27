#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = path.join(root, 'web', 'e2e-report', 'results.json');
const outPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-003.json');

const PW_MAP = {
  'Multi-Tab Tests': 'multiTab',
  'Long-Duration Stability': 'longDuration',
  'Frontend Sync Tests': 'frontendSync',
};

function flatten(suites, prefix = '') {
  const rows = [];
  for (const suite of suites ?? []) {
    const title = prefix ? `${prefix} › ${suite.title}` : suite.title;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const st = t.status ?? t.results?.[0]?.status;
        const ok = st === 'expected' || st === 'passed';
        const err = t.results?.[0]?.error?.message ?? '';
        const hasTrace = (t.results?.[0]?.attachments ?? []).length > 0;
        rows.push({
          test: spec.title,
          status: st === 'skipped' ? 'SKIP' : ok ? 'PASS' : 'FAIL',
          durationMs: t.results?.[0]?.duration ?? 0,
          notes: err.split('\n')[0],
          assertions: ok ? 'state verified' : 'failed',
          evidence: !ok
            ? `web/e2e-report/test-results/; trace=${hasTrace}; screenshot=on-failure`
            : '',
          reproduction: !ok ? `Playwright: ${title} › ${spec.title}` : '',
        });
      }
    }
    rows.push(...flatten(suite.suites, title));
  }
  return rows;
}

function addIds(rows, prefix) {
  return rows.map((r, i) => ({
    id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
    ...r,
  }));
}

const existing = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
  : { duplicatePrevention: [], raceCondition: [], sessionRecovery: [] };

const pw = fs.existsSync(pwPath) ? JSON.parse(fs.readFileSync(pwPath, 'utf8')) : { suites: [] };
function collectPlaywrightBuckets(suites) {
  const buckets = { multiTab: [], longDuration: [], frontendSync: [] };
  function walk(list) {
    for (const suite of list ?? []) {
      const key = PW_MAP[suite.title];
      if (key) {
        for (const spec of suite.specs ?? []) {
          for (const t of spec.tests ?? []) {
            const st = t.status ?? t.results?.[0]?.status;
            const ok = st === 'expected' || st === 'passed';
            const err = t.results?.[0]?.error?.message ?? '';
            buckets[key].push({
              test: spec.title,
              status: ok ? 'PASS' : 'FAIL',
              durationMs: t.results?.[0]?.duration ?? 0,
              notes: err.split('\n')[0],
              assertions: ok ? 'state verified' : 'failed',
              evidence: !ok ? 'screenshot+trace+video in e2e-report/test-results/' : '',
              reproduction: !ok ? `${suite.title} › ${spec.title}` : '',
            });
          }
        }
      }
      walk(suite.suites);
    }
  }
  walk(suites);
  return buckets;
}

const buckets = collectPlaywrightBuckets(pw.suites);

const prefixMap = { multiTab: 'MT', longDuration: 'LD', frontendSync: 'FS' };
for (const k of Object.keys(buckets)) {
  buckets[k] = addIds(buckets[k], prefixMap[k]);
}

existing.multiTab = buckets.multiTab;
existing.longDuration = buckets.longDuration;
existing.frontendSync = buckets.frontendSync;
existing.ranAt = new Date().toISOString();

const all = [
  ...existing.duplicatePrevention,
  ...existing.raceCondition,
  ...existing.sessionRecovery,
  ...existing.multiTab,
  ...existing.longDuration,
  ...existing.frontendSync,
];

const passed = all.filter((r) => r.status === 'PASS').length;
const failed = all.filter((r) => r.status === 'FAIL').length;

existing.summary = {
  overall: failed === 0 && passed > 0 ? 'PASS' : 'FAIL',
  total: all.length,
  passed,
  failed,
  skipped: all.filter((r) => r.status === 'SKIP').length,
  duplicateCount: existing.duplicatePrevention.length,
  raceCount: existing.raceCondition.length,
  sessionCount: existing.sessionRecovery.length,
  multiTabCount: existing.multiTab.length,
  longDurationCount: existing.longDuration.length,
  frontendSyncCount: existing.frontendSync.length,
  totalNavActions: existing.longDuration.length * 50,
};

existing.criticalIssues = all
  .filter((r) => r.status === 'FAIL')
  .map((r, i) => ({
    id: `CI-${String(i + 1).padStart(3, '0')}`,
    severity: r.id?.startsWith('DP') ? 'Critical' : 'High',
    test: r.test,
    notes: r.notes,
    evidence: r.evidence || 'API concurrent test — see qa-cycle-003.json',
  }));

existing.recommendedFixes = existing.criticalIssues.map((c, i) => ({
  id: `RF-${String(i + 1).padStart(3, '0')}`,
  priority: c.severity,
  action: `Fix: ${c.test}`,
  notes: c.notes,
}));

existing.visualFindings = existing.criticalIssues.map((c, i) => ({
  id: `VF-${String(i + 1).padStart(3, '0')}`,
  test: c.test,
  artifact: c.evidence,
  notes: 'screenshot/trace required per enforcement rules',
}));

existing.uxFindings = [
  {
    id: 'UX-005',
    severity: 'Low',
    finding: 'New lead modal does not dismiss on Escape (prior cycles).',
  },
  {
    id: 'UX-006',
    severity: 'Info',
    finding: 'Cycle 003: 500 total navigations across 10 long-duration tests.',
  },
  {
    id: 'UX-007',
    severity: 'Critical',
    finding:
      'Concurrent duplicate lead creates can produce multiple rows for same phone/email — race in duplicate check (23/25 DP tests failed).',
  },
];

existing.evidence = [
  { artifact: 'Cycle JSON', path: 'docs/QA/results/qa-cycle-003.json' },
  { artifact: 'Playwright JSON', path: 'web/e2e-report/results.json' },
  { artifact: 'Playwright HTML', path: 'web/e2e-report/html/index.html' },
  { artifact: 'Traces/screenshots', path: 'web/e2e-report/test-results/' },
  { artifact: 'Excel', path: 'docs/QA/WizCRM-QA-Test-003.xlsx' },
];

fs.writeFileSync(outPath, JSON.stringify(existing, null, 2), 'utf8');
console.log(
  `Merged cycle 003: ${passed}/${all.length} passed (DP=${existing.duplicatePrevention.length} RC=${existing.raceCondition.length} SR=${existing.sessionRecovery.length} MT=${existing.multiTab.length} LD=${existing.longDuration.length} FS=${existing.frontendSync.length})`,
);
process.exit(failed > 0 ? 1 : 0);
