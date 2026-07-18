import * as XLSX from 'xlsx';

const SPREADSHEET_EXTS = ['.xlsx', '.xls', '.xlsm'];
const MAX_TEXT_CHARS = 60_000; // keeps token cost bounded on very large files

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
