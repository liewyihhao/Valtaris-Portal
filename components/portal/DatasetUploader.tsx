"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";

type Upload = { id: string; filename: string; format: string; status: string; importedRows: number; lastError: string | null };

const intent = (s: string) => (s === "completed" ? "success" : s === "failed" ? "danger" : s === "importing" ? "warning" : "info");

export function DatasetUploader({ projectId, uploads }: { projectId: string; uploads: Upload[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Choose a file first."); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/dataset?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file, // streamed as the request body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? "Upload failed."); return; }
      setOk("Uploaded — importing into Studio now. Refresh to watch progress.");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(uploadId: string) {
    setBusy(true);
    await fetch(`/api/admin/projects/${projectId}/dataset/${uploadId}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {err && <Alert tone="danger">{err}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".jsonl,.ndjson,.csv,.json" className="text-sm text-p-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-p-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-p-primary" />
        <Button size="sm" disabled={busy} onClick={upload}>{busy ? "Uploading…" : "Upload dataset"}</Button>
      </div>
      <p className="text-xs text-p-secondary">JSONL / NDJSON, CSV, or JSON array. Streamed to Studio in batches — large files import in the background.</p>

      <Table>
        <THead><TH>File</TH><TH>Format</TH><TH>Imported</TH><TH>Status</TH><TH></TH></THead>
        <TBody>
          {uploads.length === 0 && <EmptyRow colSpan={5}>No datasets uploaded yet.</EmptyRow>}
          {uploads.map((u) => (
            <TR key={u.id}>
              <TD className="text-p-primary">{u.filename}</TD>
              <TD className="text-p-secondary">{u.format}</TD>
              <TD className="tabular-nums text-p-secondary">{u.importedRows.toLocaleString()}</TD>
              <TD>
                <Badge intent={intent(u.status)} icon={false}>{u.status}</Badge>
                {u.lastError && <div className="mt-1 max-w-xs truncate text-xs text-danger" title={u.lastError}>{u.lastError}</div>}
              </TD>
              <TD className="text-right">
                {(u.status === "failed" || u.status === "uploaded") && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => retry(u.id)}>Retry</Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
