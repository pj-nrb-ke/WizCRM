import { describe, expect, it } from 'vitest';
import {
  downsampleTo8k,
  escapeXml,
  escapeXmlAttr,
  extensionFor,
  pcmToWav,
  TELEPHONY_RATE,
} from '../src/services/ai/voice-agent.service.js';

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

describe('downsampleTo8k', () => {
  /** Build 24 kHz mono s16le PCM from a list of sample values. */
  const pcm = (samples: number[]) => {
    const b = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => b.writeInt16LE(s, i * 2));
    return b;
  };

  it('keeps one sample for every three, at a third the rate', () => {
    const out = downsampleTo8k(pcm([300, 300, 300, 900, 900, 900]));
    expect(out.length).toBe(4); // 2 samples x 2 bytes
    expect(out.readInt16LE(0)).toBe(300);
    expect(out.readInt16LE(2)).toBe(900);
  });

  it('averages each group of three rather than plainly dropping samples', () => {
    // Plain decimation would return 0 here and alias the tone into the voice band.
    const out = downsampleTo8k(pcm([0, 300, 600]));
    expect(out.readInt16LE(0)).toBe(300);
  });

  it('ignores a trailing partial group instead of reading past the buffer', () => {
    expect(() => downsampleTo8k(pcm([1, 2, 3, 4, 5]))).not.toThrow();
    expect(downsampleTo8k(pcm([1, 2, 3, 4, 5])).length).toBe(2);
  });

  it('survives full-scale samples without overflowing', () => {
    const out = downsampleTo8k(pcm([32767, 32767, 32767]));
    expect(out.readInt16LE(0)).toBe(32767);
    const min = downsampleTo8k(pcm([-32768, -32768, -32768]));
    expect(min.readInt16LE(0)).toBe(-32768);
  });
});

describe('pcmToWav', () => {
  const wav = pcmToWav(Buffer.alloc(160), TELEPHONY_RATE);

  it('writes a RIFF/WAVE header a telephony player will accept', () => {
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.subarray(36, 40).toString()).toBe('data');
  });

  it('declares 8 kHz, mono, 16-bit PCM', () => {
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(8000); // sample rate
    expect(wav.readUInt32LE(28)).toBe(16000); // byte rate = rate * 2
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it('states the correct sizes, or players read garbage past the end', () => {
    expect(wav.readUInt32LE(4)).toBe(36 + 160); // RIFF chunk size
    expect(wav.readUInt32LE(40)).toBe(160); // data size
    expect(wav.length).toBe(44 + 160);
  });
});
