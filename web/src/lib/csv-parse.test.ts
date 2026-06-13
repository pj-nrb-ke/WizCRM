import { describe, expect, it } from 'vitest';
import { parseCsvLine } from '../pages/BulkImportPage';

describe('parseCsvLine (quote-aware CSV)', () => {
  it('splits a plain line on commas', () => {
    expect(parseCsvLine('Ada Lovelace,Analytical Co,ada@x.com')).toEqual([
      'Ada Lovelace',
      'Analytical Co',
      'ada@x.com',
    ]);
  });

  it('keeps commas inside quoted fields intact', () => {
    expect(parseCsvLine('Grace Hopper,"Acme, Inc",grace@x.com')).toEqual([
      'Grace Hopper',
      'Acme, Inc',
      'grace@x.com',
    ]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseCsvLine('"She said ""hi""",b')).toEqual(['She said "hi"', 'b']);
  });

  it('trims surrounding whitespace per field', () => {
    expect(parseCsvLine('  a , b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('preserves empty trailing fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});
