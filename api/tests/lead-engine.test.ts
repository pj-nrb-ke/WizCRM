import { describe, it, expect } from 'vitest';
import { scoreCandidate, parseScoringRules } from '../src/services/lead-engine/scoring.service.js';
import { normalizeName, buildDedupHash } from '../src/services/lead-engine/discovery/google-places.provider.js';
import { verifyUnsubToken } from '../src/services/lead-engine/email-sequence.service.js';
import { defaultScoringRules } from '../src/services/lead-engine/campaign.service.js';
import type { CompanyCandidate } from '../src/services/lead-engine/types.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<CompanyCandidate> = {}): CompanyCandidate {
  return {
    companyName: 'Acme ERP Solutions',
    normalizedName: 'acmeerpsolut',
    sectorTags: ['software', 'erp'],
    source: 'google_places',
    raw: {},
    ...overrides,
  };
}

// ── normalizeName ──────────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('strips Ltd / Limited', () => {
    expect(normalizeName('Acme Limited')).not.toContain('limited');
    expect(normalizeName('Acme Ltd')).not.toContain('ltd');
  });

  it('lowercases and removes punctuation', () => {
    const result = normalizeName('Tech & Co. Ltd');
    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it('strips Kenya / Nairobi suffixes', () => {
    expect(normalizeName('Safaricom Kenya Limited')).not.toContain('kenya');
  });

  it('two similar names produce the same output', () => {
    expect(normalizeName('Skyline Holdings Ltd')).toBe(normalizeName('Skyline Holdings Limited'));
  });
});

// ── buildDedupHash ─────────────────────────────────────────────────────────

describe('buildDedupHash', () => {
  it('returns a 16-char hex string', () => {
    const hash = buildDedupHash('acmeerp', 'Nairobi CBD', '+254712345678');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('same inputs → same hash', () => {
    const a = buildDedupHash('acmeerp', 'Nairobi CBD', '+254712345678');
    const b = buildDedupHash('acmeerp', 'Nairobi CBD', '+254712345678');
    expect(a).toBe(b);
  });

  it('different name → different hash', () => {
    const a = buildDedupHash('acmeerp', 'Nairobi CBD', '+254712345678');
    const b = buildDedupHash('zenith', 'Nairobi CBD', '+254712345678');
    expect(a).not.toBe(b);
  });

  it('works without optional fields', () => {
    expect(() => buildDedupHash('acmeerp')).not.toThrow();
  });
});

// ── scoreCandidate ─────────────────────────────────────────────────────────

describe('scoreCandidate', () => {
  const rules = defaultScoringRules();

  it('assigns tier A when score ≥ 60', () => {
    const c = makeCandidate({ website: 'https://acme.co.ke', phone: '+254700000000' });
    const result = scoreCandidate(c, rules, ['erp']);
    expect(result.tier).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('assigns tier C for website+phone but no keyword match (25 pts)', () => {
    // has_website (15 pts) + has_phone (10 pts) = 25 pts, no keyword match
    const c = makeCandidate({ website: 'https://acme.co.ke', phone: '+254700000000', sectorTags: [] });
    const result = scoreCandidate(c, rules, ['cloud']);
    expect(result.score).toBe(25);
    expect(result.tier).toBe('C');
  });

  it('assigns tier C when 15 ≤ score < 35', () => {
    const c = makeCandidate({ website: 'https://acme.co.ke', phone: undefined, sectorTags: [] });
    const result = scoreCandidate(c, rules, ['cloud']);
    expect(result.score).toBe(15);
    expect(result.tier).toBe('C');
  });

  it('returns null tier when score < 15', () => {
    const c = makeCandidate({ website: undefined, phone: undefined, sectorTags: [] });
    const result = scoreCandidate(c, rules, ['cloud']);
    expect(result.score).toBe(0);
    expect(result.tier).toBeNull();
  });

  it('keyword match adds points', () => {
    const c = makeCandidate({ sectorTags: ['erp', 'software'] });
    const result = scoreCandidate(c, rules, ['erp']);
    const kwSignal = result.breakdown.find((b) => b.key === 'industry_keyword_match');
    expect(kwSignal?.detected).toBe(true);
    expect(kwSignal?.points).toBe(50);
  });

  it('breakdown has an entry per signal', () => {
    const c = makeCandidate();
    const result = scoreCandidate(c, rules, []);
    expect(result.breakdown).toHaveLength(rules.signals.length);
  });

  it('score is never negative', () => {
    const negRules = {
      signals: [{ key: 'penalty', label: 'Penalty', points: -100, builtIn: 'has_website' as const }],
      tierThresholds: { A: 60, B: 35, C: 15 },
    };
    const c = makeCandidate({ website: 'https://x.com' });
    const result = scoreCandidate(c, negRules, []);
    expect(result.score).toBe(0);
  });
});

// ── parseScoringRules ──────────────────────────────────────────────────────

describe('parseScoringRules', () => {
  it('passes through a valid rules object', () => {
    const raw = { signals: [], tierThresholds: { A: 60, B: 35, C: 15 } };
    expect(parseScoringRules(raw)).toEqual(raw);
  });

  it('returns fallback for null', () => {
    const result = parseScoringRules(null);
    expect(result.signals).toEqual([]);
    expect(result.tierThresholds).toBeDefined();
  });

  it('returns fallback for arbitrary string', () => {
    const result = parseScoringRules('garbage');
    expect(Array.isArray(result.signals)).toBe(true);
  });
});

// ── verifyUnsubToken ───────────────────────────────────────────────────────

describe('verifyUnsubToken', () => {
  it('returns true for the correct token', async () => {
    // import dynamically to get the same module instance
    const { verifyUnsubToken: verify } = await import(
      '../src/services/lead-engine/email-sequence.service.js'
    );
    const prospectId = 'test-prospect-abc';
    // Generate token the same way the service does (same HMAC call)
    const { createHmac } = await import('node:crypto');
    const secret = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production';
    const expected = createHmac('sha256', secret).update(prospectId).digest('hex').slice(0, 20);
    expect(verify(prospectId, expected)).toBe(true);
  });

  it('returns false for a wrong token', () => {
    expect(verifyUnsubToken('some-id', 'wrongtoken1234567890')).toBe(false);
  });

  it('returns false for empty token', () => {
    expect(verifyUnsubToken('some-id', '')).toBe(false);
  });
});
