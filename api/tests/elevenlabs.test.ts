import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  renderTranscript,
  verifyWebhookSignature,
} from '../src/services/ai/elevenlabs.service.js';

const SECRET = 'whsec_test';

function sign(body: string, t: number, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v0=${mac}`;
}

describe('verifyWebhookSignature', () => {
  const body = '{"type":"post_call_transcription","data":{}}';
  const now = 1_800_000_000;

  it('accepts a correctly signed payload', () => {
    expect(verifyWebhookSignature(body, sign(body, now), SECRET, now)).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(body, sign(body, now, 'other'), SECRET, now)).toBe(false);
  });

  it('rejects a tampered body — the signature covers the raw bytes', () => {
    const tampered = body.replace('{}', '{"analysis":{"call_successful":"success"}}');
    expect(verifyWebhookSignature(tampered, sign(body, now), SECRET, now)).toBe(false);
  });

  it('rejects a replayed signature from an hour ago', () => {
    expect(verifyWebhookSignature(body, sign(body, now - 3600), SECRET, now)).toBe(false);
  });

  it('rejects a missing header, an empty secret, and garbage — without throwing', () => {
    expect(verifyWebhookSignature(body, undefined, SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, now), '', now)).toBe(false);
    expect(verifyWebhookSignature(body, 't=abc,v0=zz', SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, 'not-a-signature', SECRET, now)).toBe(false);
  });
});

describe('renderTranscript', () => {
  it('labels agent turns as Jane and everything else as Caller', () => {
    const out = renderTranscript({
      data: {
        transcript: [
          { role: 'agent', message: 'Hi, this is Jane.' },
          { role: 'user', message: 'We use spreadsheets.' },
          { role: 'agent', message: '' }, // empty turns are dropped
        ],
      },
    });
    expect(out).toBe('Jane: Hi, this is Jane.\nCaller: We use spreadsheets.');
  });

  it('returns an empty string for a payload with no transcript', () => {
    expect(renderTranscript({})).toBe('');
    expect(renderTranscript({ data: {} })).toBe('');
  });
});
