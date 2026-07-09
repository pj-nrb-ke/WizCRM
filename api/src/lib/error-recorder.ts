/**
 * A small in-memory record of server-side failures, so a manager can see what
 * broke without SSHing into the box to read journalctl.
 *
 * Deliberately not a database table: if the database is what is broken, writing
 * the error report to it would fail too. The buffer is lost on restart, which is
 * an acceptable trade — the watchdog emails on failure, this is for triage after.
 */
export type RecordedError = {
  at: string;
  method: string;
  /** Path only. Query strings can carry tokens and are stripped. */
  path: string;
  statusCode: number;
  message: string;
};

const MAX_RECENT = 50;

const recent: RecordedError[] = [];
let total = 0;
let since = new Date();

function stripQuery(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

export function recordServerError(input: {
  method: string;
  url: string;
  statusCode: number;
  message: string;
}): void {
  total += 1;
  recent.unshift({
    at: new Date().toISOString(),
    method: input.method,
    path: stripQuery(input.url).slice(0, 200),
    statusCode: input.statusCode,
    message: input.message.slice(0, 500),
  });
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
}

export function getErrorReport() {
  return {
    total,
    since: since.toISOString(),
    recent: [...recent],
  };
}

/** Test seam. */
export function resetErrorReport(): void {
  recent.length = 0;
  total = 0;
  since = new Date();
}
