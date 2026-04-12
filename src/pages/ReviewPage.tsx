import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 30;

export default function ReviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["review-queue", page],
    queryFn: async () => {
      const countQuery = supabase
        .from("transfer_screenshots")
        .select("id", { count: "exact", head: true })
        .or("accounting_status.in.(pending,duplicate_review),extraction_status.eq.error");

      const query = supabase
        .from("transfer_screenshots")
        .select("*, people!matched_person_id(id, full_name)")
        .or("accounting_status.in.(pending,duplicate_review),extraction_status.eq.error")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const [{ data: rows, error }, { count }] = await Promise.all([query, countQuery]);
      if (error) throw error;
      return { rows: rows || [], total: count || 0 };
    },
  });

  const items = data?.rows || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">{totalCount} items awaiting review</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="metric-card space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-40" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No items in the review queue 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">All caught up!</p>
          </div>
        ) : (
          items.map(item => (
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
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {selectedId && (
        <TransactionDetailModal
          screenshotId={selectedId}
          onClose={() => { setSelectedId(null); refetch(); }}
        />
      )}
    </div>
  );
}
