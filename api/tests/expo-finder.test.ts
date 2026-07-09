import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import {
  buildDedupKey,
  isUpcoming,
  parseIsoDate,
  scoreConfidence,
  validateExtracted,
} from '../src/services/expo-finder.service.js';
import type { TavilyResult } from '../src/services/lead-engine/heat-map/tavily.provider.js';

const NOW = new Date('2026-07-09T00:00:00.000Z');

const source: TavilyResult = {
  title: 'Nairobi Tech Expo 2026',
  url: 'https://example.co.ke/expo',
  content: 'Held at KICC.',
  score: 0.9,
  published_date: '2026-06-01',
};

const allowed = new Map<string, TavilyResult>([[source.url, source]]);

const base = {
  name: 'Nairobi Tech Expo',
  sourceUrl: source.url,
  startDate: '2026-09-10',
  endDate: '2026-09-12',
  venue: 'KICC',
  city: 'Nairobi',
  country: 'Kenya',
  recommendation: 'BOOTH',
};

describe('parseIsoDate', () => {
  it('accepts only a full YYYY-MM-DD date', () => {
    expect(parseIsoDate('2026-09-10')?.toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });

  it('rejects a bare month, a year, and junk — a partial date is no date', () => {
    expect(parseIsoDate('2026-09')).toBeNull();
    expect(parseIsoDate('2026')).toBeNull();
    expect(parseIsoDate('September 2026')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('2026-13-45')).toBeNull();
  });
});

describe('isUpcoming', () => {
  it('keeps an event that has not finished', () => {
    expect(isUpcoming(new Date('2026-07-01T00:00:00Z'), new Date('2026-07-20T00:00:00Z'), NOW)).toBe(true);
  });

  it('drops an event that already ended', () => {
    expect(isUpcoming(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-05T00:00:00Z'), NOW)).toBe(false);
  });

  it('keeps an undated event so it can be researched later', () => {
    expect(isUpcoming(null, null, NOW)).toBe(true);
  });
});

describe('scoreConfidence', () => {
  it('rewards a dated, located, recently-published source', () => {
    const score = scoreConfidence({
      startDate: new Date('2026-09-10'),
      venue: 'KICC',
      websiteUrl: 'https://expo.example',
      sourcePublishedAt: new Date('2026-06-01'),
      now: NOW,
    });
    expect(score).toBe(100);
  });

  it('stays low when the source pins nothing down', () => {
    const score = scoreConfidence({
      startDate: null,
      venue: null,
      websiteUrl: null,
      sourcePublishedAt: null,
      now: NOW,
    });
    expect(score).toBe(40);
  });

  it('does not credit a stale source', () => {
    const fresh = scoreConfidence({
      startDate: null, venue: null, websiteUrl: null,
      sourcePublishedAt: new Date('2026-06-01'), now: NOW,
    });
    const stale = scoreConfidence({
      startDate: null, venue: null, websiteUrl: null,
      sourcePublishedAt: new Date('2019-06-01'), now: NOW,
    });
    expect(fresh).toBe(50);
    expect(stale).toBe(40);
  });
});

describe('buildDedupKey', () => {
  it('keys on the name and the starting month, so a re-run updates in place', () => {
    expect(buildDedupKey('Nairobi Tech Expo', new Date('2026-09-10'))).toBe('nairobi-tech-expo|2026-09');
  });

  it('separates an undated sighting from a dated one', () => {
    expect(buildDedupKey('Nairobi Tech Expo', null)).toBe('nairobi-tech-expo|tbd');
  });
});

describe('validateExtracted', () => {
  it('accepts a well-sourced upcoming expo', () => {
    const row = validateExtracted(base, 'LOCAL_KENYA', allowed, NOW);
    expect(row).not.toBeNull();
    expect(row!.name).toBe('Nairobi Tech Expo');
    expect(row!.recommendation).toBe('BOOTH');
    expect(row!.sourceTitle).toBe('Nairobi Tech Expo 2026');
    expect(row!.confidence).toBe(90); // dated + venue + recent source, no website
  });

  it('rejects a row citing a URL that was never in the search results', () => {
    const invented = { ...base, sourceUrl: 'https://hallucinated.example/expo' };
    expect(validateExtracted(invented, 'LOCAL_KENYA', allowed, NOW)).toBeNull();
  });

  it('rejects a row with no source at all', () => {
    expect(validateExtracted({ ...base, sourceUrl: null }, 'LOCAL_KENYA', allowed, NOW)).toBeNull();
  });

  it('rejects an expo that already happened', () => {
    const past = { ...base, startDate: '2026-01-01', endDate: '2026-01-03' };
    expect(validateExtracted(past, 'LOCAL_KENYA', allowed, NOW)).toBeNull();
  });

  it('rejects an event that ends before it starts', () => {
    const backwards = { ...base, startDate: '2026-09-12', endDate: '2026-09-10' };
    expect(validateExtracted(backwards, 'LOCAL_KENYA', allowed, NOW)).toBeNull();
  });

  it('rejects a nameless row', () => {
    expect(validateExtracted({ ...base, name: '  ' }, 'LOCAL_KENYA', allowed, NOW)).toBeNull();
  });

  it('keeps an undated expo but records the wording and scores it low', () => {
    const vague = { ...base, startDate: null, endDate: null, dateText: 'Q4 2026', venue: null };
    const row = validateExtracted(vague, 'ASIA', allowed, NOW);
    expect(row!.startDate).toBeNull();
    expect(row!.dateText).toBe('Q4 2026');
    expect(row!.confidence).toBe(50);
    expect(row!.dedupKey).toBe('nairobi-tech-expo|tbd');
  });

  it('discards dateText once a real date is known', () => {
    const row = validateExtracted({ ...base, dateText: 'sometime in September' }, 'LOCAL_KENYA', allowed, NOW);
    expect(row!.dateText).toBeNull();
  });

  it('drops an unrecognised recommendation rather than guessing one', () => {
    const row = validateExtracted({ ...base, recommendation: 'MAYBE' }, 'LOCAL_KENYA', allowed, NOW);
    expect(row!.recommendation).toBeNull();
  });

  it('treats the string "null" and "unknown" as absent', () => {
    const row = validateExtracted({ ...base, city: 'null', venue: 'unknown' }, 'LOCAL_KENYA', allowed, NOW);
    expect(row!.city).toBeNull();
    expect(row!.venue).toBeNull();
  });

  it('caps industry tags and drops empty ones', () => {
    const row = validateExtracted(
      { ...base, industryTags: ['ict', '', '  ', 'erp', 'sme', 'a', 'b', 'c', 'd', 'e', 'f'] },
      'LOCAL_KENYA',
      allowed,
      NOW,
    );
    expect(row!.industryTags).toHaveLength(8);
    expect(row!.industryTags).not.toContain('');
  });
});
