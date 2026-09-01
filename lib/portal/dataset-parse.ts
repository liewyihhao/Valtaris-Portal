// ---------------------------------------------------------------------------
// STREAMING DATASET PARSERS (JSONL / CSV / JSON-array).
// Each parser consumes an async iterable of UTF-8 string chunks (a file stream)
// and yields one row at a time — never holding the whole file in memory — so
// multi-GB uploads can be imported row-by-row. Pure w.r.t. I/O: callers pass the
// chunk iterable, so the parsers are unit-testable from a string.
// ---------------------------------------------------------------------------

export type DatasetFormat = "jsonl" | "csv" | "json";
export type DatasetRow = { index: number; data: Record<string, unknown> };

/** Pick a format from a filename extension. Pure. */
export function detectFormat(filename: string): DatasetFormat | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  return null;
}

/** Normalize a parsed value into a task `data` object. */
function asData(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

// --- JSONL -----------------------------------------------------------------
export async function* jsonlRows(chunks: AsyncIterable<string>): AsyncGenerator<DatasetRow> {
  let buf = "";
  let index = 0;
  for await (const chunk of chunks) {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "").trim();
      buf = buf.slice(nl + 1);
      if (line) yield { index: index++, data: asData(JSON.parse(line)) };
    }
  }
  const last = buf.replace(/\r$/, "").trim();
  if (last) yield { index: index++, data: asData(JSON.parse(last)) };
}

// --- CSV (quote-aware, handles embedded commas/newlines/escaped quotes) -----
export async function* csvRows(chunks: AsyncIterable<string>): AsyncGenerator<DatasetRow> {
  let header: string[] | null = null;
  let index = 0;
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let pendingQuote = false; // saw a '"' while inQuotes — could be end-quote or escaped

  function endField() { fields.push(field); field = ""; }
  function endRow(): DatasetRow | null {
    endField();
    const row = fields.splice(0, fields.length);
    if (row.length === 1 && row[0] === "") return null; // blank line
    if (!header) { header = row; return null; }
    const data: Record<string, unknown> = {};
    header.forEach((h, i) => { data[h || `col${i}`] = row[i] ?? ""; });
    return { index: index++, data };
  }

  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') { field += '"'; continue; } // escaped quote
        inQuotes = false; // the quote closed the field; fall through to handle c
      }
      if (inQuotes) {
        if (c === '"') pendingQuote = true;
        else field += c;
        continue;
      }
      if (c === '"') { inQuotes = true; }
      else if (c === ",") endField();
      else if (c === "\n") { const r = endRow(); if (r) yield r; }
      else if (c === "\r") { /* skip; handled with \n */ }
      else field += c;
    }
  }
  // flush trailing row (no final newline)
  if (pendingQuote) inQuotes = false;
  if (field !== "" || fields.length > 0) { const r = endRow(); if (r) yield r; }
}

// --- JSON array (streaming top-level element extractor) ---------------------
export async function* jsonArrayRows(chunks: AsyncIterable<string>): AsyncGenerator<DatasetRow> {
  let started = false;
  let depth = 0;
  let inString = false;
  let escape = false;
  let buf = "";
  let index = 0;

  function flush(): DatasetRow | null {
    const s = buf.trim();
    buf = "";
    if (!s) return null;
    return { index: index++, data: asData(JSON.parse(s)) };
  }

  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (!started) { if (c === "[") started = true; continue; }
      if (inString) {
        buf += c;
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; buf += c; }
      else if (c === "{" || c === "[") { depth++; buf += c; }
      else if (c === "}") { depth--; buf += c; }
      else if (c === "]") {
        if (depth === 0) { const r = flush(); if (r) yield r; return; }
        depth--; buf += c;
      }
      else if (c === "," && depth === 0) { const r = flush(); if (r) yield r; }
      else buf += c;
    }
  }
}

export function parseDataset(format: DatasetFormat, chunks: AsyncIterable<string>): AsyncGenerator<DatasetRow> {
  if (format === "jsonl") return jsonlRows(chunks);
  if (format === "csv") return csvRows(chunks);
  return jsonArrayRows(chunks);
}
