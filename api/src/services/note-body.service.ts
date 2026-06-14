/** NFR-004: optional AI clean; keep raw body when clean fails. */
export async function resolveActivityNoteBody(
  opts: { useAiClean?: boolean; type: string; body: string; subject?: string },
  clean: (body: string) => Promise<{ cleanedBody: string; subject?: string }>,
): Promise<{ body: string; subject?: string }> {
  let body = opts.body;
  let subject = opts.subject;
  if (opts.useAiClean && opts.type === 'NOTE') {
    try {
      const cleaned = await clean(body);
      body = cleaned.cleanedBody;
      subject = cleaned.subject ?? subject;
    } catch {
      // keep raw body
    }
  }
  return { body, subject };
}
