import { api } from './api';

/** AI-drafted Visit Report fields returned by POST /ai/leads/:id/visit-capture. */
export type VisitCaptureDraft = {
  outcome: string;
  whoMet?: string;
  competitor?: string;
  objection?: string;
  nextStep?: string;
  suggestedDueAt?: string;
  summary: string;
  suggestedStage?: string;
};

/**
 * Two-step AI Visit Capture: transcribe the rep's audio, then have AI draft a
 * structured Visit Report from the transcript. Needs connectivity — both calls
 * hit the model — so callers should fall back to manual entry when offline.
 */
export async function captureVisitFromAudio(
  leadId: string,
  audioBase64: string,
): Promise<{ transcript: string; draft: VisitCaptureDraft }> {
  const { transcript } = await api<{ transcript: string }>('/ai/transcribe', {
    method: 'POST',
    body: { audioBase64, mimeType: 'audio/m4a' },
  });
  const { draft } = await api<{ draft: VisitCaptureDraft }>(
    `/ai/leads/${leadId}/visit-capture`,
    { method: 'POST', body: { transcript } },
  );
  return { transcript, draft };
}
