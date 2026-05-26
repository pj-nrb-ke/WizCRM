import { describe, expect, it } from 'vitest';
import {
  createActivitySchema,
  createLeadSchema,
  nextActionFeedbackSchema,
  postCallSchema,
  transcribeAudioSchema,
  updateLeadSchema,
} from './schemas.js';

describe('UT-LITE-001 create lead schema', () => {
  it('requires name and phone or email', () => {
    expect(createLeadSchema.safeParse({ name: 'A', phone: '+27821234567' }).success).toBe(true);
    expect(createLeadSchema.safeParse({ name: 'A', email: 'a@b.com' }).success).toBe(true);
    expect(createLeadSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: '', phone: '+27821234567' }).success).toBe(false);
  });

  it('accepts source and priority', () => {
    const r = createLeadSchema.safeParse({
      name: 'A',
      phone: '+27821234567',
      source: 'Referral',
      priority: 'HOT',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.priority).toBe('HOT');
    }
  });
});

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

describe('close lead update schema', () => {
  it('requires wonValue when stage is WON', () => {
    expect(updateLeadSchema.safeParse({ stage: 'WON' }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ stage: 'WON', wonValue: 1200 }).success).toBe(true);
  });

  it('requires lossReason when stage is LOST', () => {
    expect(updateLeadSchema.safeParse({ stage: 'LOST' }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ stage: 'LOST', lossReason: 'PRICE' }).success).toBe(true);
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
