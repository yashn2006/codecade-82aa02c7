import { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Minimal RFC4180-ish CSV parser (handles quoted fields, commas, escaped quotes, \n in quotes)
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }
  return out.filter((r) => r.length && r.some((c) => c.trim() !== ""));
}

export type CsvColumn<T> = {
  key: keyof T;
  label: string;          // header expected in CSV (case-insensitive)
  required?: boolean;
  transform?: (v: string) => unknown;
};

type Props<T> = {
  title: string;
  description?: string;
  templateName: string;
  columns: CsvColumn<T>[];
  onImport: (rows: Partial<T>[]) => Promise<{ ok: number; failed: number }>;
  trigger?: React.ReactNode;
};

export function CsvImporter<T>({ title, description, templateName, columns, onImport, trigger }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Partial<T>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) { setErrors(["CSV needs a header row and at least one data row."]); return; }
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const errs: string[] = [];

    for (const col of columns) {
      if (col.required && !header.includes(col.label.toLowerCase())) {
        errs.push(`Missing required column: ${col.label}`);
      }
    }
    if (errs.length) { setErrors(errs); setRows([]); return; }

    const parsed: Partial<T>[] = [];
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      const obj: Record<string, unknown> = {};
      for (const col of columns) {
        const idx = header.indexOf(col.label.toLowerCase());
        if (idx < 0) continue;
        const raw = (row[idx] ?? "").trim();
        if (raw === "") continue;
        try { obj[col.key as string] = col.transform ? col.transform(raw) : raw; }
        catch (e) { errs.push(`Row ${r + 1} · ${col.label}: ${e instanceof Error ? e.message : "invalid"}`); }
      }
      parsed.push(obj as Partial<T>);
    }
    setErrors(errs);
    setRows(parsed);
  };

  const downloadTemplate = () => {
    const csv = columns.map((c) => c.label).join(",") + "\n";
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = templateName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const runImport = async () => {
    if (!rows.length) return;
    setBusy(true);
    try {
      const { ok, failed } = await onImport(rows);
      toast.success(`Imported ${ok}${failed ? ` · ${failed} failed` : ""}`);
      setOpen(false); setRows([]); setErrors([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm" className="gap-2"><Upload className="h-4 w-4" />Import CSV</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Columns: {columns.map((c) => c.label + (c.required ? "*" : "")).join(", ")}</span>
            <Button size="sm" variant="link" className="h-auto p-0" onClick={downloadTemplate}>Download template</Button>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/5 px-4 py-8 cursor-pointer hover:border-primary/40 transition">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm">Click to select a .csv file</span>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>

          {errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {errors.length} issue{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="mt-1 list-disc pl-5 text-amber-200/80">
                {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 5 && <li>…and {errors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {rows.length > 0 && errors.length === 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {rows.length} row{rows.length > 1 ? "s" : ""} ready to import
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={runImport} disabled={busy || !rows.length || errors.length > 0}>
            {busy ? "Importing…" : `Import ${rows.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
