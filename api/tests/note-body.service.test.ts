import { describe, expect, it, vi } from 'vitest';
import { resolveActivityNoteBody } from '../src/services/note-body.service.js';

describe('UT-LITE-008 / QA-NFR-004 note body resolution', () => {
  it('returns cleaned body when AI succeeds', async () => {
    const clean = vi.fn().mockResolvedValue({
      cleanedBody: 'Professional note',
      subject: 'Follow-up',
    });
    const result = await resolveActivityNoteBody(
      { useAiClean: true, type: 'NOTE', body: 'uh hello' },
      clean,
    );
    expect(result.body).toBe('Professional note');
    expect(result.subject).toBe('Follow-up');
  });

  it('keeps raw body when AI clean fails', async () => {
    const clean = vi.fn().mockRejectedValue(new Error('AI_UNAVAILABLE'));
    const result = await resolveActivityNoteBody(
      { useAiClean: true, type: 'NOTE', body: 'raw transcript' },
      clean,
    );
    expect(result.body).toBe('raw transcript');
  });

  it('skips AI when useAiClean is false', async () => {
    const clean = vi.fn();
    const result = await resolveActivityNoteBody(
      { useAiClean: false, type: 'NOTE', body: 'plain' },
      clean,
    );
    expect(result.body).toBe('plain');
    expect(clean).not.toHaveBeenCalled();
  });
});
