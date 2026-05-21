import { describe, expect, it } from 'vitest';
import { parseApiUrlFromFileContents } from './api-url-parse';

describe('parseApiUrlFromFileContents', () => {
  it('parses full URL', () => {
    expect(parseApiUrlFromFileContents('http://192.168.1.5:3000\n')).toBe('http://192.168.1.5:3000');
  });

  it('parses ip:port shorthand', () => {
    expect(parseApiUrlFromFileContents('192.168.1.5:3000')).toBe('http://192.168.1.5:3000');
  });

  it('skips comments and uses first real line', () => {
    expect(parseApiUrlFromFileContents('# dev\n\n192.168.1.5:4000')).toBe('http://192.168.1.5:4000');
  });

  it('strips :3000 from https cloud URLs', () => {
    expect(parseApiUrlFromFileContents('https://api.wizcrm.app:3000')).toBe('https://api.wizcrm.app');
  });
});
