import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

function downloadCSV(data: any[], filename: string) {
  if (!data.length) { toast.error("No data to export"); return; }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      const str = val == null ? "" : String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}

export default function ReportsPage() {
  const exportAll = async () => {
    const { data } = await supabase.from("transfer_screenshots").select("*").order("created_at", { ascending: false });
    downloadCSV(data || [], `all-processed-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportUnmatched = async () => {
    const { data } = await supabase.from("transfer_screenshots").select("*").is("matched_person_id", null).order("created_at", { ascending: false });
    downloadCSV(data || [], `unmatched-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportPeople = async () => {
    const { data } = await supabase.from("people").select("*, person_identifiers(*)").order("full_name");
    const flat = (data || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      status: p.status,
      identifiers: (p.person_identifiers as any[])?.map((i: any) => `${i.identifier_type}:${i.normalized_value}`).join("; ") || "",
      created_at: p.created_at,
    }));
    downloadCSV(flat, `people-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Export data for accounting reconciliation</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card space-y-3">
          <h3 className="font-semibold">All Processed</h3>
          <p className="text-sm text-muted-foreground">Full export of all processed screenshots with all fields</p>
          <Button onClick={exportAll} variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
        <div className="metric-card space-y-3">
          <h3 className="font-semibold">Unmatched / Review</h3>
          <p className="text-sm text-muted-foreground">Screenshots without a matched person</p>
          <Button onClick={exportUnmatched} variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
        <div className="metric-card space-y-3">
          <h3 className="font-semibold">People Database</h3>
          <p className="text-sm text-muted-foreground">Complete people directory with identifiers</p>
          <Button onClick={exportPeople} variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>
    </div>
  );
}
