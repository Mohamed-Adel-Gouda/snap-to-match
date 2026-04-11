import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

export default function ProcessedPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: screenshots, refetch } = useQuery({
    queryKey: ["processed", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("transfer_screenshots")
        .select("*, people!matched_person_id(id, full_name)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("accounting_status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (screenshots || []).filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.filename?.toLowerCase().includes(q) ||
      s.transaction_code?.toLowerCase().includes(q) ||
      s.extracted_phone_normalized?.includes(q) ||
      (s.people as any)?.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Processed Screenshots</h1>
        <p className="text-muted-foreground">{filtered.length} records</p>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Search filename, code, phone, person…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="duplicate_review">Duplicate Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Filename</th>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedId(s.id)}>
                <td className="px-4 py-3 font-mono text-xs">{s.transaction_code}</td>
                <td className="px-4 py-3 max-w-[200px] truncate">{s.filename}</td>
                <td className="px-4 py-3">
                  {(s.people as any)?.full_name ? (
                    <Link to={`/people/${(s.people as any).id}`} className="text-accent hover:underline" onClick={e => e.stopPropagation()}>
                      {(s.people as any).full_name}
                    </Link>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{s.extracted_phone_normalized || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{s.extracted_amount ? `${Number(s.extracted_amount).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">
                  {s.match_confidence != null && (
                    <span className={`status-badge ${s.match_confidence >= 90 ? 'status-matched' : s.match_confidence >= 70 ? 'status-pending' : 'status-error'}`}>
                      {s.match_confidence}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${
                    s.accounting_status === 'approved' ? 'status-approved' :
                    s.accounting_status === 'rejected' ? 'status-rejected' :
                    s.accounting_status === 'duplicate_review' ? 'status-duplicate' : 'status-pending'
                  }`}>
                    {s.accounting_status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <TransactionDetailModal
          screenshotId={selectedId}
          onClose={() => { setSelectedId(null); refetch(); }}
        />
      )}
    </div>
  );
}
