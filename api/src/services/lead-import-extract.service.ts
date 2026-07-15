import * as XLSX from 'xlsx';
import { LEAD_PRIORITIES, type ExtractedLeadRow, type LeadPriority } from '@wizcrm/shared';
import { createOpenAIClient, chatJson } from './ai/openai.provider.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-level sanitization — an LLM hallucinating one bad field (e.g. "Use
 * website enquiry" as an email) must not silently drop the whole lead, the
 * way a single strict object-level zod parse would. */
function sanitizeRow(item: Record<string, unknown>): ExtractedLeadRow | null {
  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
  };
  const name = str(item.name, 200);
  if (!name) return null;

  const email = str(item.email, 200);
  const phone = str(item.phone, 30);
  const priorityRaw = str(item.priority, 10)?.toUpperCase();

  const tagsRaw = Array.isArray(item.tags) ? item.tags : [];
  const tags = tagsRaw
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim().slice(0, 40))
    .slice(0, 10);

  return {
    name,
    company: str(item.company, 200),
    email: email && EMAIL_RE.test(email) ? email : undefined,
    phone: phone && phone.length >= 5 ? phone : undefined,
    address: str(item.address, 500),
    source: str(item.source, 100),
    tags: tags.length ? tags : undefined,
    priority:
      priorityRaw && (LEAD_PRIORITIES as readonly string[]).includes(priorityRaw)
        ? (priorityRaw as LeadPriority)
        : undefined,
  };
}

const SPREADSHEET_EXTS = ['.xlsx', '.xls', '.xlsm'];
const MAX_TEXT_CHARS = 60_000; // keeps token cost bounded on very large files
const MAX_CANDIDATES = 500;

export class LeadImportUnavailableError extends Error {
  readonly code = 'LEAD_IMPORT_UNAVAILABLE';
}

function isSpreadsheet(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    SPREADSHEET_EXTS.some((ext) => lower.endsWith(ext)) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  );
}

/** Turns an uploaded file (spreadsheet, CSV, JSON, or plain text) into one bounded text blob for the LLM. */
function buildExtractionText(fileName: string, mimeType: string, dataBase64: string): string {
  const buffer = Buffer.from(dataBase64, 'base64');

  if (isSpreadsheet(fileName, mimeType)) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (!csv.trim()) continue;
      parts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
    }
    return parts.join('\n\n').slice(0, MAX_TEXT_CHARS);
  }

  // CSV / JSON / plain text — already human/LLM-readable as-is.
  return buffer.toString('utf-8').slice(0, MAX_TEXT_CHARS);
}

const SYSTEM_PROMPT = `You extract a sales lead list from a raw file dump (spreadsheet CSV export, JSON, or plain text) so it can be imported into a CRM.

The source is often messy: multiple sheets, inconsistent headers, a decision-maker/contact
listed in a separate sheet from the company's other details. When two sheets both reference
the same company (match by company name, case-insensitive, tolerate minor spelling variation),
MERGE them into a single lead — do not create duplicate leads for the same company.

For each company, produce ONE lead with these fields:
- name: the contact PERSON's name (the decision-maker/individual to reach), e.g. "Ketul Tanna".
  If no named individual is given anywhere, use the company name as the fallback so a lead can
  still be created with a real name field.
- company: the company/organization name.
- email: prefer a named person's direct email over a generic one (info@, sales@) when both exist.
  Omit entirely if the value is just instructional text like "Use website enquiry" rather than a
  real address.
- phone: a real phone number only. Omit if the source only says something like "No reliable
  public number confirmed".
- address: physical address or location if present, otherwise omit.
- source: a short label for where this list came from, inferred from context (e.g. the file
  name or sheet name), or omit if nothing sensible applies.
- tags: 0-3 short tags such as the sector/industry (e.g. "FMCG manufacturing"), omit if unclear.
- priority: map any priority/tier indicator (A/B/C, High/Medium/Low, numeric 1-3, etc.) to
  exactly one of "HOT", "WARM", "COLD" (A/1/High -> HOT, B/2/Medium -> WARM, C/3/Low -> COLD).
  Omit if no priority signal exists in the source.

Skip rows that are clearly not real leads (headers, blank rows, notes-to-self, totals).
Every lead needs a non-empty "name". If literally nothing usable exists for a row, drop it
rather than inventing data.

Return strict JSON: { "leads": [...], "warnings": [...] }. "warnings" is a short list of plain-English
notes about anything you skipped, merged, or are unsure about (e.g. "3 rows had no usable contact
info and were skipped").`;

export type LeadExtractionResult = {
  candidates: ExtractedLeadRow[];
  warnings: string[];
  truncated: boolean;
};

export async function extractLeadsFromImport(
  fileName: string,
  mimeType: string,
  dataBase64: string,
): Promise<LeadExtractionResult> {
  const client = createOpenAIClient();
  if (!client) {
    throw new LeadImportUnavailableError('AI extraction is not configured for this server.');
  }

  const text = buildExtractionText(fileName, mimeType, dataBase64);
  if (!text.trim()) {
    return { candidates: [], warnings: ['The file appeared to be empty.'], truncated: false };
  }

  const raw = await chatJson<{ leads?: unknown[]; warnings?: unknown[] }>(
    client,
    SYSTEM_PROMPT,
    `File: ${fileName}\n\n${text}`,
    { temperature: 0.2 },
  );

  const items = Array.isArray(raw.leads) ? raw.leads : [];
  const candidates: ExtractedLeadRow[] = [];
  let dropped = 0;
  for (const item of items) {
    if (candidates.length >= MAX_CANDIDATES) break;
    if (typeof item !== 'object' || item === null) {
      dropped++;
      continue;
    }
    const sanitized = sanitizeRow(item as Record<string, unknown>);
    if (sanitized) candidates.push(sanitized);
    else dropped++;
  }

  const warnings = (raw.warnings ?? []).filter((w): w is string => typeof w === 'string');
  if (dropped > 0) {
    warnings.push(`${dropped} row${dropped === 1 ? '' : 's'} had no usable name and were skipped.`);
  }
  const truncated = items.length > MAX_CANDIDATES;

  return { candidates, warnings, truncated };
}
