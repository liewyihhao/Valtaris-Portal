import { describe, it, expect } from "vitest";
import { detectFormat, parseDataset, type DatasetFormat, type DatasetRow } from "../dataset-parse";

// Feed a string as small chunks to exercise chunk-boundary handling.
async function* chunked(s: string, size = 3): AsyncGenerator<string> {
  for (let i = 0; i < s.length; i += size) yield s.slice(i, i + size);
}
async function collect(format: DatasetFormat, s: string): Promise<DatasetRow[]> {
  const out: DatasetRow[] = [];
  for await (const r of parseDataset(format, chunked(s))) out.push(r);
  return out;
}

describe("detectFormat", () => {
  it("maps extensions", () => {
    expect(detectFormat("data.jsonl")).toBe("jsonl");
    expect(detectFormat("x.ndjson")).toBe("jsonl");
    expect(detectFormat("CUSTOMER.CSV")).toBe("csv");
    expect(detectFormat("a.b.json")).toBe("json");
    expect(detectFormat("notes.txt")).toBeNull();
  });
});

describe("jsonl", () => {
  it("parses one object per line, skips blanks, handles no trailing newline", async () => {
    const rows = await collect("jsonl", '{"a":1}\n\n{"a":2}\r\n{"a":3}');
    expect(rows.map((r) => r.data)).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });
  it("wraps non-object values", async () => {
    const rows = await collect("jsonl", '"hello"\n42');
    expect(rows.map((r) => r.data)).toEqual([{ value: "hello" }, { value: 42 }]);
  });
});

describe("csv", () => {
  it("uses the header row and maps columns", async () => {
    const rows = await collect("csv", "name,lang\nSiti,Malay\nAli,Tamil\n");
    expect(rows.map((r) => r.data)).toEqual([
      { name: "Siti", lang: "Malay" },
      { name: "Ali", lang: "Tamil" },
    ]);
  });
  it("handles quoted fields with commas, embedded newlines, and escaped quotes", async () => {
    const csv = 'text,label\n"Hello, world",pos\n"line1\nline2",neg\n"He said ""hi""",neutral\n';
    const rows = await collect("csv", csv);
    expect(rows.map((r) => r.data)).toEqual([
      { text: "Hello, world", label: "pos" },
      { text: "line1\nline2", label: "neg" },
      { text: 'He said "hi"', label: "neutral" },
    ]);
  });
  it("handles a final row with no trailing newline", async () => {
    const rows = await collect("csv", "a,b\n1,2");
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ a: "1", b: "2" });
  });
});

describe("json array", () => {
  it("streams top-level elements, ignoring commas inside nested objects/strings", async () => {
    const json = '[{"a":1,"nested":{"b":[1,2,3]}}, {"a":2,"s":"x, y, z"}, {"a":3}]';
    const rows = await collect("json", json);
    expect(rows.map((r) => r.data)).toEqual([
      { a: 1, nested: { b: [1, 2, 3] } },
      { a: 2, s: "x, y, z" },
      { a: 3 },
    ]);
  });
  it("handles whitespace/newlines between elements and an empty array", async () => {
    expect(await collect("json", "[\n  {\"a\":1},\n  {\"a\":2}\n]")).toHaveLength(2);
    expect(await collect("json", "[]")).toEqual([]);
  });
});
