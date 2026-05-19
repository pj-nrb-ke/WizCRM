import { describe, expect, it } from 'vitest';
import {
  createActivitySchema,
  nextActionFeedbackSchema,
  postCallSchema,
  transcribeAudioSchema,
} from './schemas.js';

describe('UT-LITE-009 post-call schema', () => {
  it('requires leadId and roughNote', () => {
    expect(
      postCallSchema.safeParse({
        leadId: '00000000-0000-4000-8000-000000000001',
        roughNote: 'Spoke about pricing',
      }).success,
    ).toBe(true);
    expect(postCallSchema.safeParse({ leadId: 'x', roughNote: '' }).success).toBe(false);
  });

  it('accepts optional call duration', () => {
    const r = postCallSchema.safeParse({
      leadId: '00000000-0000-4000-8000-000000000001',
      roughNote: 'Call',
      callDurationSec: 120,
    });
    expect(r.success).toBe(true);
  });
});

describe('UT-LITE-007 next action feedback schema', () => {
  it('requires non-empty action', () => {
    expect(nextActionFeedbackSchema.safeParse({ action: 'Call back' }).success).toBe(true);
    expect(nextActionFeedbackSchema.safeParse({ action: '' }).success).toBe(false);
  });
});

describe('UT-LITE-008 activity and transcribe schemas', () => {
  it('validates note activity body', () => {
    expect(createActivitySchema.safeParse({ type: 'NOTE', body: 'Hello' }).success).toBe(true);
    expect(createActivitySchema.safeParse({ type: 'NOTE', body: '' }).success).toBe(false);
  });

  it('validates transcribe audio payload', () => {
    expect(transcribeAudioSchema.safeParse({ audioBase64: 'abc1234567' }).success).toBe(true);
    expect(transcribeAudioSchema.safeParse({ audioBase64: 'short' }).success).toBe(false);
  });
});
