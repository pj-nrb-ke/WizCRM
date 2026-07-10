import { describe, expect, it } from 'vitest';
import { escapeXml, escapeXmlAttr, extensionFor } from '../src/services/ai/voice-agent.service.js';

describe('escapeXml', () => {
  it('escapes an ampersand, which would otherwise break the whole response', () => {
    // "Johnson & Sons" inside <Say> is malformed XML — the caller hears nothing.
    expect(escapeXml('Johnson & Sons')).toBe('Johnson &amp; Sons');
  });

  it('escapes angle brackets so model output cannot inject XML tags', () => {
    expect(escapeXml('<Hangup/>')).toBe('&lt;Hangup/&gt;');
  });

  it('leaves apostrophes alone so TTS never reads "&apos;" aloud inside "can\'t"', () => {
    expect(escapeXml(`I can't provide pricing`)).toBe(`I can't provide pricing`);
  });

  it('leaves ordinary speech untouched', () => {
    const plain = 'Does your business use a C R M today?';
    expect(escapeXml(plain)).toBe(plain);
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeXml('a & b & c')).toBe('a &amp; b &amp; c');
  });
});

describe('escapeXmlAttr', () => {
  it('escapes quotes, which would otherwise terminate the attribute early', () => {
    expect(escapeXmlAttr(`https://x/y?a="1"`)).toBe('https://x/y?a=&quot;1&quot;');
  });

  it('still escapes the markup characters', () => {
    expect(escapeXmlAttr('a&b<c')).toBe('a&amp;b&lt;c');
  });
});

describe('extensionFor', () => {
  it('reads the audio format from the recording URL', () => {
    expect(extensionFor('https://voice.at.com/rec/abc.wav')).toBe('wav');
    expect(extensionFor('https://voice.at.com/rec/abc.mp3')).toBe('mp3');
  });

  it('ignores a query string', () => {
    expect(extensionFor('https://voice.at.com/rec/abc.mp3?token=xyz')).toBe('mp3');
  });

  it('falls back to wav when the URL has no usable extension', () => {
    expect(extensionFor('https://voice.at.com/rec/abc')).toBe('wav');
    expect(extensionFor('https://voice.at.com/rec/abc.somethinglong')).toBe('wav');
  });
});
