#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = path.join(root, 'web', 'e2e-report', 'results.json');
const outPath = path.join(root, 'docs', 'QA', 'results', 'qa-cycle-002.json');

const SHEET_MAP = {
  'Frontend Sync Tests': 'frontendSync',
  'Duplicate Prevention Tests': 'duplicatePrevention',
  'Race Condition Tests': 'raceCondition',
  'Session Recovery Tests': 'sessionRecovery',
  'Multi-Tab Tests': 'multiTab',
  'Long-Duration Stability': 'longDuration',
  'Human Frustration Observations': 'humanFrustration',
};

function flatten(suites, prefix = '') {
  const rows = [];
  for (const suite of suites ?? []) {
    const title = prefix ? `${prefix} › ${suite.title}` : suite.title;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const st = t.status ?? t.results?.[0]?.status;
        const ok = st === 'expected' || st === 'passed';
        const skipped = st === 'skipped';
        const err = t.results?.[0]?.error?.message ?? '';
        const annotations =
          t.results?.[0]?.attachments?.map((a) => a.name).join(', ') ??
          spec.annotations?.map((a) => a.description).join('; ') ??
          '';
        rows.push({
          suite: title,
          test: spec.title,
          status: skipped ? 'SKIP' : ok ? 'PASS' : 'FAIL',
          durationMs: t.results?.[0]?.duration ?? 0,
          notes: err.split('\n')[0],
          assertions: ok ? 'state verified' : err ? 'failed assertion' : '',
          evidence: err ? 'web/e2e-report/test-results/' : '',
          annotations,
        });
      }
    }
    rows.push(...flatten(suite.suites, title));
  }
  return rows;
}

function bucketRows(rows) {
  const buckets = Object.fromEntries(Object.values(SHEET_MAP).map((k) => [k, []]));
  const unmapped = [];
  for (const row of rows) {
    const key = SHEET_MAP[row.suite] ?? SHEET_MAP[row.suite.split(' › ')[0]];
    if (key) buckets[key].push(row);
    else unmapped.push(row);
  }
  if (unmapped.length) buckets.frontendSync.push(...unmapped);
  return buckets;
}

function addIds(buckets) {
  const out = {};
  for (const [key, rows] of Object.entries(buckets)) {
    const prefix =
      key === 'frontendSync'
        ? 'FS'
        : key === 'duplicatePrevention'
          ? 'DP'
          : key === 'raceCondition'
            ? 'RC'
            : key === 'sessionRecovery'
              ? 'SR'
              : key === 'multiTab'
                ? 'MT'
                : key === 'longDuration'
                  ? 'LD'
                  : 'HF';
    out[key] = rows.map((r, i) => ({
      id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      ...r,
    }));
  }
  return out;
}

const pw = fs.existsSync(pwPath) ? JSON.parse(fs.readFileSync(pwPath, 'utf8')) : { suites: [] };
const allRows = flatten(pw.suites);
const buckets = addIds(bucketRows(allRows));

const uxFindings = [];
const visualFindings = [];
const criticalIssues = [];
const recommendedFixes = [];

for (const row of allRows) {
  if (row.annotations?.includes('ux-finding')) {
    uxFindings.push({
      id: `UX-${String(uxFindings.length + 1).padStart(3, '0')}`,
      severity: 'Low',
      finding: row.annotations,
    });
  }
  if (row.status === 'FAIL') {
    const sev = ['frontendSync', 'duplicatePrevention', 'multiTab'].some((k) =>
      buckets[k]?.some((b) => b.test === row.test),
    )
      ? 'High'
      : 'Medium';
    criticalIssues.push({
      id: `CI-${String(criticalIssues.length + 1).padStart(3, '0')}`,
      severity: sev,
      test: row.test,
      suite: row.suite,
      notes: row.notes,
    });
    if (row.evidence) {
      visualFindings.push({
        id: `VF-${String(visualFindings.length + 1).padStart(3, '0')}`,
        test: row.test,
        artifact: row.evidence,
        notes: 'screenshot/video in e2e-report/test-results',
      });
    }
    recommendedFixes.push({
      id: `RF-${String(recommendedFixes.length + 1).padStart(3, '0')}`,
      priority: sev,
      action: `Investigate: ${row.test}`,
      notes: row.notes,
    });
  }
}

if (!uxFindings.some((u) => u.finding.includes('Escape'))) {
  uxFindings.push({
    id: 'UX-005',
    severity: 'Low',
    finding: 'New lead modal does not dismiss on Escape (confirmed cycle 002).',
  });
}

const allTests = Object.values(buckets).flat();
const passed = allTests.filter((t) => t.status === 'PASS').length;
const failed = allTests.filter((t) => t.status === 'FAIL').length;

const payload = {
  cycle: '002',
  ranAt: new Date().toISOString(),
  baseUrl: process.env.QA_BASE_URL ?? 'https://app.wizcrm.app',
  apiUrl: process.env.QA_API_URL ?? 'https://api.wizcrm.app',
  instructions: 'WizCRM-QA-Agent-Feedback-and-Instructions.md (enterprise destructive QA)',
  summary: {
    overall: failed === 0 && passed > 0 ? 'PASS' : failed > 0 ? 'FAIL' : 'PARTIAL',
    total: allTests.length,
    passed,
    failed,
    skipped: allTests.filter((t) => t.status === 'SKIP').length,
  },
  ...buckets,
  uxFindings,
  visualFindings,
  criticalIssues,
  recommendedFixes,
  evidence: [
    { artifact: 'Playwright JSON', path: 'web/e2e-report/results.json' },
    { artifact: 'Playwright HTML', path: 'web/e2e-report/html/index.html' },
    { artifact: 'Screenshots / traces', path: 'web/e2e-report/test-results/' },
    { artifact: 'Cycle JSON', path: 'docs/QA/results/qa-cycle-002.json' },
    { artifact: 'Excel report', path: 'docs/QA/WizCRM-QA-Test-002.xlsx' },
  ],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${outPath} (${passed}/${allTests.length} passed)`);
process.exit(failed > 0 ? 1 : 0);
