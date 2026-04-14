import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phone-utils";
import { linkOrphanedUploads } from "@/lib/link-orphaned-uploads";
import { toast } from "sonner";

interface CsvRow {
  name: string;
  phones: { phone: string; type: string }[];
  lineNumber: number;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  linked: number;
  errors: string[];
}

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["File is empty or has no data rows"] };

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map(h => h.trim());

  const nameIdx = headers.findIndex(h => ["name", "full_name", "الاسم"].includes(h));
  if (nameIdx === -1) return { rows: [], errors: ["Missing 'name' or 'full_name' column in header"] };

  // Find phone columns
  const phoneIndices: { idx: number; type: string }[] = [];
  headers.forEach((h, i) => {
    if (i === nameIdx) return;
    if (["phone", "primary_phone", "رقم التليفون", "الرقم"].includes(h)) {
      phoneIndices.push({ idx: i, type: "primary_phone" });
    } else if (["alternate_phone", "alt_phone", "رقم بديل"].includes(h)) {
      phoneIndices.push({ idx: i, type: "alternate_phone" });
    } else if (["wallet", "المحفظة"].includes(h)) {
      phoneIndices.push({ idx: i, type: "wallet" });
    } else if (["bank_account", "حساب بنكي"].includes(h)) {
      phoneIndices.push({ idx: i, type: "bank_account" });
    } else if (h.includes("phone") || h.includes("رقم")) {
      phoneIndices.push({ idx: i, type: "primary_phone" });
    }
  });

  if (phoneIndices.length === 0) {
    return { rows: [], errors: ["No phone columns found. Use headers like 'phone', 'alternate_phone', 'wallet'"] };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    const name = cols[nameIdx]?.trim();
    if (!name) {
      errors.push(`Row ${i + 1}: Missing name, skipped`);
      continue;
    }

    const phones: { phone: string; type: string }[] = [];
    for (const { idx, type } of phoneIndices) {
      const val = cols[idx]?.trim();
      if (val) phones.push({ phone: val.replace(/[^\d+]/g, ""), type });
    }

    rows.push({ name, phones, lineNumber: i + 1 });
  }

  return { rows, errors };
}

export default function CsvImportDialog({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CsvRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setParseErrors([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCsv(text);
      setPreview(rows);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setProgress(0);

    const res: ImportResult = { total: preview.length, success: 0, failed: 0, linked: 0, errors: [] };

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i];
      try {
        const { data: person, error } = await supabase
          .from("people")
          .insert({ full_name: row.name })
          .select()
          .single();
        if (error) throw error;

        const validPhones = row.phones.filter(p => p.phone);
        if (validPhones.length > 0) {
          const { error: idError } = await supabase.from("person_identifiers").insert(
            validPhones.map((p, idx) => ({
              person_id: person.id,
              identifier_type: p.type,
              raw_value: p.phone,
              normalized_value: normalizePhone(p.phone),
              is_primary: idx === 0,
            }))
          );
          if (idError) throw idError;
        }

        const normalizedPhones = validPhones.map(p => normalizePhone(p.phone)).filter(Boolean);
        const linked = await linkOrphanedUploads(person.id, normalizedPhones);
        res.linked += linked;
        res.success++;
      } catch (err: any) {
        res.failed++;
        res.errors.push(`Row ${row.lineNumber} (${row.name}): ${err.message}`);
      }
      setProgress(Math.round(((i + 1) / preview.length) * 100));
    }

    setResult(res);
    setImporting(false);
    if (res.success > 0) onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import People from CSV</DialogTitle></DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV with columns: <code className="text-xs bg-muted px-1 rounded">name</code>, <code className="text-xs bg-muted px-1 rounded">phone</code>
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0"
                  onClick={() => {
                    const csv = "name,phone,alternate_phone,wallet\nأحمد محمد,01012345678,01112345678,01212345678\nسارة علي,01098765432,,\nمحمد حسن,01551234567,01021234567,";
                    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "people_template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="mr-1 h-3 w-3" />Download template
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{e}
                  </p>
                ))}
              </div>
            )}

            {preview && preview.length > 0 && (
              <>
                <div className="border rounded-md max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Phones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 font-mono">
                            {r.phones.map(p => p.phone).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      …and {preview.length - 50} more rows
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{preview.length} people ready to import</p>
                  <Button onClick={handleImport} disabled={importing}>
                    {importing ? "Importing…" : (
                      <><Upload className="mr-2 h-4 w-4" />Import {preview.length}</>
                    )}
                  </Button>
                </div>
                {importing && <Progress value={progress} className="h-2" />}
              </>
            )}

            {preview && preview.length === 0 && parseErrors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No valid rows found in the file</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {result.success} added, {result.failed} failed
                  {result.linked > 0 && `, ${result.linked} uploads auto-linked`}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 max-h-32 overflow-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { reset(); setOpen(false); }}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
