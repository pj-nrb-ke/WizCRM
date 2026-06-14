#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDuplicateTests } from './duplicate-tests.mjs';
import { runRaceTests } from './race-tests.mjs';
import { runSessionTests } from './session-tests.mjs';
import { baseUrl } from './api-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const resultsDir = path.join(root, 'docs', 'QA', 'results');
const cycle = process.env.QA_CYCLE ?? '003';
const dupRerunOnly = cycle === '004' || process.env.QA_DUP_RERUN_ONLY === '1';

const duplicatePrevention = await runDuplicateTests();
let raceCondition = [];
let sessionRecovery = [];
if (!dupRerunOnly) {
  raceCondition = await runRaceTests();
  sessionRecovery = await runSessionTests();
}

fs.mkdirSync(resultsDir, { recursive: true });

if (dupRerunOnly) {
  const dupPath = path.join(resultsDir, 'qa-cycle-003-dup-rerun.json');
  fs.writeFileSync(
    dupPath,
    JSON.stringify(
      {
        cycle: '004-dup-rerun',
        ranAt: new Date().toISOString(),
        apiUrl: baseUrl,
        duplicatePrevention,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Wrote duplicate re-test → ${dupPath}`);
} else {
  const outPath = path.join(resultsDir, 'qa-cycle-003.json');
  const payload = {
    cycle: '003',
    ranAt: new Date().toISOString(),
    baseUrl: process.env.QA_BASE_URL ?? 'https://app.wizcrm.app',
    apiUrl: baseUrl,
    instructions: 'WizCRM-Enterprise-QA-Enforcement-Instructions.md',
    duplicatePrevention,
    raceCondition,
    sessionRecovery,
    multiTab: [],
    longDuration: [],
    frontendSync: [],
    uxFindings: [],
    visualFindings: [],
    criticalIssues: [],
    recommendedFixes: [],
    evidence: [],
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
}

const failed =
  duplicatePrevention.filter((r) => r.status === 'FAIL').length +
  raceCondition.filter((r) => r.status === 'FAIL').length +
  sessionRecovery.filter((r) => r.status === 'FAIL').length;

console.log(
  `\nAPI suite: DP=${duplicatePrevention.length} RC=${raceCondition.length} SR=${sessionRecovery.length} fails=${failed}`,
);
process.exit(failed > 0 ? 1 : 0);
