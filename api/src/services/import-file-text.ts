import * as XLSX from 'xlsx';

const SPREADSHEET_EXTS = ['.xlsx', '.xls', '.xlsm'];
// The 14MB base64 upload cap (see leadImportExtractSchema/prospectImportExtractSchema)
// already bounds the absolute worst case — this just guards against pathological
// single-cell content, not against large-but-legitimate contact lists.
const MAX_TEXT_CHARS = 1_000_000;

function isSpreadsheet(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    SPREADSHEET_EXTS.some((ext) => lower.endsWith(ext)) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  );
}

/** Turns an uploaded file (spreadsheet, CSV, JSON, or plain text) into one bounded text blob for the LLM. */
export function buildExtractionText(fileName: string, mimeType: string, dataBase64: string): string {
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

/**
 * Splits a large text blob into line-bounded chunks small enough that the model's JSON
 * reply for any one chunk reliably finishes instead of getting cut off mid-object — that
 * truncation is what throws "Expected property name or '}' in JSON" on big imports.
 * Multi-sheet merge-by-company-name (see extraction prompts) only sees within one chunk;
 * an acceptable tradeoff for large single-purpose lists, which rarely span sheets anyway.
 */
export function chunkExtractionText(text: string, linesPerChunk = 120): string[] {
  const lines = text.split('\n');
  if (lines.length <= linesPerChunk) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
  }
  return chunks;
}
