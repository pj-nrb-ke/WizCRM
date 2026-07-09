import { beforeEach, describe, expect, it } from 'vitest';
import {
  getErrorReport,
  recordServerError,
  resetErrorReport,
} from '../src/lib/error-recorder.js';

const err = (over: Partial<Parameters<typeof recordServerError>[0]> = {}) =>
  recordServerError({
    method: 'GET',
    url: '/leads',
    statusCode: 500,
    message: 'boom',
    ...over,
  });

describe('error-recorder', () => {
  beforeEach(() => resetErrorReport());

  it('starts empty', () => {
    const r = getErrorReport();
    expect(r.total).toBe(0);
    expect(r.recent).toEqual([]);
  });

  it('strips the query string, which can carry tokens', () => {
    err({ url: '/leads?token=supersecret&page=2' });
    expect(getErrorReport().recent[0].path).toBe('/leads');
  });

  it('keeps the newest error first', () => {
    err({ message: 'first' });
    err({ message: 'second' });
    const { recent } = getErrorReport();
    expect(recent[0].message).toBe('second');
    expect(recent[1].message).toBe('first');
  });

  it('counts every error but keeps only the last 50', () => {
    for (let i = 0; i < 60; i++) err({ message: `e${i}` });
    const r = getErrorReport();
    expect(r.total).toBe(60);
    expect(r.recent).toHaveLength(50);
    expect(r.recent[0].message).toBe('e59');
    expect(r.recent[49].message).toBe('e10');
  });

  it('truncates a runaway message rather than storing it whole', () => {
    err({ message: 'x'.repeat(5000) });
    expect(getErrorReport().recent[0].message).toHaveLength(500);
  });
});
