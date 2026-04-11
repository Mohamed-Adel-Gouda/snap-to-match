import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock } from "lucide-react";
import { useState } from "react";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

export default function ReviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: items, refetch } = useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_screenshots")
        .select("*, people!matched_person_id(id, full_name)")
        .or("accounting_status.in.(pending,duplicate_review),extraction_status.eq.error")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">{items?.length || 0} items awaiting review</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map(item => (
          <div
            key={item.id}
            className="metric-card cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all"
            onClick={() => setSelectedId(item.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs">{item.transaction_code}</span>
              <span className={`status-badge ${
                item.accounting_status === 'duplicate_review' ? 'status-duplicate' :
                item.extraction_status === 'error' ? 'status-error' : 'status-pending'
              }`}>
                {item.accounting_status === 'duplicate_review' ? 'Duplicate' :
                 item.extraction_status === 'error' ? 'Error' : 'Pending'}
              </span>
            </div>

            {item.accounting_status === 'duplicate_review' && (
              <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-destructive font-medium">Possible duplicate detected</span>
              </div>
            )}

            <p className="text-sm truncate">{item.filename}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{item.extracted_phone_normalized || "No phone"}</span>
              <span className="font-mono font-medium text-foreground">
                {item.extracted_amount ? `${Number(item.extracted_amount).toLocaleString()} EGP` : "—"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(item.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
        {items?.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No items in the review queue 🎉
          </div>
        )}
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
