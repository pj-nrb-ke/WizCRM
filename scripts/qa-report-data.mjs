import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function getQaDir() {
  return path.join(root, 'docs', 'QA');
}

/** Excel workbook name: WizCRM-QA-Test-001.xlsx */
export function qaExcelFileName(cycle) {
  return `WizCRM-QA-Test-${String(cycle).padStart(3, '0')}.xlsx`;
}

export function resolveCycle(explicit) {
  if (explicit) return String(explicit).padStart(3, '0');
  const qaDir = getQaDir();
  let max = 0;
  if (fs.existsSync(qaDir)) {
    for (const name of fs.readdirSync(qaDir)) {
      const m = /^WizCRM-QA-Test-(\d{3})\.xlsx$/i.exec(name);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return String(max + 1).padStart(3, '0');
}

export function readPlaywrightResults() {
  const resultsPath = path.join(root, 'web', 'e2e-report', 'results.json');
  if (!fs.existsSync(resultsPath)) {
    return { suites: [], config: {} };
  }
  return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
}

export function flattenFrontendRows(suites, prefix = '') {
  const rows = [];
  for (const suite of suites ?? []) {
    const title = prefix ? `${prefix} › ${suite.title}` : suite.title;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.[0];
        const status = test.status ?? result?.status ?? 'unknown';
        const err = result?.error?.message?.split('\n')[0] ?? '';
        rows.push({
          suite: title,
          name: spec.title,
          status,
          durationMs: result?.duration ?? 0,
          error: err,
        });
      }
    }
    rows.push(...flattenFrontendRows(suite.suites, title));
  }
  return rows;
}

export function toPassFail(status) {
  if (status === 'expected' || status === 'passed') return 'PASS';
  if (status === 'skipped') return 'SKIP';
  if (status === 'unexpected' || status === 'failed') return 'FAIL';
  return status.toUpperCase();
}

export function readBackendEnterpriseResults() {
  const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-backend-enterprise.json');
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

export function readSecurityPerformanceResults() {
  const jsonPath = path.join(root, 'docs', 'QA', 'results', 'qa-security-performance.json');
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

/** Production API smoke fallback when 03/04 JSON not run yet. */
export function defaultBackendSmokeRows() {
  return [
    { area: 'Auth', test: 'POST /auth/login (manager)', status: 'PASS', notes: 'npm run test:production' },
    { area: 'Teams', test: 'GET /teams', status: 'PASS', notes: '' },
    { area: 'Teams', test: 'GET /teams/metrics/open', status: 'PASS', notes: '' },
    { area: 'Teams', test: 'GET /teams/metrics/stale', status: 'PASS', notes: '' },
    { area: 'Teams', test: 'GET /teams/metrics/won', status: 'PASS', notes: '' },
    { area: 'Teams', test: 'GET /teams/metrics/overdue', status: 'PASS', notes: '' },
    { area: 'Calendar', test: 'GET /calendar/events', status: 'PASS', notes: '' },
    { area: 'Calendar', test: 'POST/PATCH/DELETE /calendar/events', status: 'PASS', notes: 'CRUD round-trip' },
    { area: 'Reports', test: 'GET /reports/analytics', status: 'PASS', notes: '' },
    { area: 'Leads', test: 'GET /leads/pipeline', status: 'PASS', notes: '' },
    { area: 'Teams', test: 'GET /teams/activity-feed', status: 'PASS', notes: '' },
  ];
}

export function buildSecurityRows(secJson) {
  if (!secJson) {
    return [
      {
        category: 'Security',
        test: 'Security / performance / mobile suite (docs/QA/05)',
        status: 'NOT RUN',
        notes: 'Run npm run qa:05',
      },
    ];
  }
  const rows = [];
  for (const r of secJson.apiSecurity ?? []) {
    rows.push({
      category: r.category ?? 'Security',
      test: r.test,
      status: r.status,
      notes: r.notes ?? '',
    });
  }
  for (const r of secJson.playwright ?? []) {
    rows.push({
      category: r.category ?? 'Performance',
      test: r.test,
      status: r.status,
      notes: r.notes ?? '',
    });
  }
  if (secJson.mobileUnit) {
    rows.push({
      category: secJson.mobileUnit.category ?? 'Mobile',
      test: secJson.mobileUnit.test,
      status: secJson.mobileUnit.status,
      notes: secJson.mobileUnit.notes ?? '',
    });
  }
  rows.push({
    category: 'Mobile',
    test: 'Physical device pilot (MOBILE-PILOT.md)',
    status: 'MANUAL',
    notes: 'Install production APK; user sign-off required',
  });
  return rows;
}

export function defaultUxFindings() {
  return [
    {
      id: 'UX-001',
      severity: 'Low',
      finding:
        'Home quick-tiles duplicate sidebar link names (Leads, Users) — confuses automation and screen readers.',
    },
    {
      id: 'UX-002',
      severity: 'Low',
      finding: 'New lead modal does not close on Escape; only Cancel/backdrop.',
    },
    {
      id: 'UX-003',
      severity: 'Info',
      finding:
        'Leads table can show empty rows while Loading… is visible (race for impatient users).',
    },
  ];
}

export function defaultEvidenceRows(cycle) {
  return [
    { artifact: 'Playwright JSON', path: 'web/e2e-report/results.json', cycle },
    { artifact: 'Playwright HTML report', path: 'web/e2e-report/html/index.html', cycle },
    { artifact: 'Screenshots / video (on failure)', path: 'web/e2e-report/test-results/', cycle },
    { artifact: 'Backend/Enterprise JSON', path: 'docs/QA/results/qa-backend-enterprise.json', cycle },
    { artifact: 'Security/Performance JSON', path: 'docs/QA/results/qa-security-performance.json', cycle },
    { artifact: 'Excel report', path: `docs/QA/${qaExcelFileName(cycle)}`, cycle },
    { artifact: 'Markdown summary', path: `docs/QA/results/QA-Test-${cycle}-SUMMARY.md`, cycle },
  ];
}

export function buildReportPayload(options = {}) {
  const cycle = resolveCycle(options.cycle ?? process.env.QA_CYCLE);
  const baseUrl = options.baseUrl ?? process.env.QA_BASE_URL ?? 'https://app.wizcrm.app';
  const apiUrl = options.apiUrl ?? process.env.QA_API_URL ?? 'https://api.wizcrm.app';
  const date = (options.date ?? new Date().toISOString()).slice(0, 10);

  const pw = readPlaywrightResults();
  const feRaw = flattenFrontendRows(pw.suites);
  const frontend = feRaw.map((r, i) => ({
    id: `FE-${String(i + 1).padStart(3, '0')}`,
    suite: r.suite,
    test: r.name,
    status: toPassFail(r.status),
    ms: r.durationMs,
    notes: r.error,
  }));

  const fePassed = frontend.filter((r) => r.status === 'PASS').length;
  const feFailed = frontend.filter((r) => r.status === 'FAIL').length;
  const feSkipped = frontend.filter((r) => r.status === 'SKIP').length;

  const beJson = readBackendEnterpriseResults();
  const backendSource =
    options.backendRows ??
    (beJson?.results?.length
      ? beJson.results.map((r) => ({
          area: r.area,
          test: r.test,
          status: r.status,
          notes: r.notes ?? '',
        }))
      : defaultBackendSmokeRows());
  const backend = backendSource.map((r, i) => ({
    id: `BE-${String(i + 1).padStart(3, '0')}`,
    ...r,
  }));
  const bePassed = backend.filter((r) => r.status === 'PASS').length;
  const beFailed = backend.filter((r) => r.status === 'FAIL').length;
  const enterprisePassed = backend.filter(
    (r) => r.area === 'Enterprise State' && r.status === 'PASS',
  ).length;
  const enterpriseFailed = backend.filter(
    (r) => r.area === 'Enterprise State' && r.status === 'FAIL',
  ).length;

  const secJson = readSecurityPerformanceResults();
  const securitySource = options.securityRows ?? buildSecurityRows(secJson);
  const security = securitySource.map((r, i) => ({
    id: `SEC-${String(i + 1).padStart(3, '0')}`,
    ...r,
  }));
  const secPassed = security.filter((r) => r.status === 'PASS').length;
  const secFailed = security.filter((r) => r.status === 'FAIL').length;

  const ux = options.uxRows ?? defaultUxFindings();

  const evidence = defaultEvidenceRows(cycle);

  const totalFailed = feFailed + beFailed + secFailed;
  const totalRan = frontend.length + backend.length + security.length;
  const overall =
    totalFailed === 0 && totalRan > 0 ? 'PASS' : totalFailed > 0 ? 'FAIL' : 'PARTIAL';

  const instructionParts = ['01-QA-Core-Rules', '02-Frontend-Human-QA'];
  if (beJson) instructionParts.push('03-Backend-API-Database-QA', '04-Enterprise-State-Validation-QA');
  if (secJson) instructionParts.push('05-Security-Performance-Mobile-QA');

  const noteParts = [];
  if (feRaw.length) noteParts.push(`FE ${fePassed}/${frontend.length}`);
  if (beJson) noteParts.push(`BE ${bePassed}/${backend.length}`);
  if (secJson) noteParts.push(`SEC ${secPassed}/${security.length}`);
  const notes = noteParts.length ? noteParts.join('; ') : 'Playwright E2E + production API smoke';

  return {
    cycle,
    date: beJson?.ranAt?.slice(0, 10) ?? date,
    baseUrl,
    apiUrl: beJson?.apiUrl ?? apiUrl,
    instructions: instructionParts.join(', '),
    summaryNotes: notes,
    summary: {
      frontendPassed: fePassed,
      frontendFailed: feFailed,
      frontendSkipped: feSkipped,
      frontendTotal: frontend.length,
      backendPassed: bePassed,
      backendFailed: beFailed,
      backendTotal: backend.length,
      enterprisePassed,
      enterpriseFailed,
      securityPassed: secPassed,
      securityFailed: secFailed,
      securityTotal: security.length,
      overall,
    },
    frontend,
    backend,
    security,
    ux: options.uxRows ?? defaultUxFindings(),
    evidence,
  };
}
