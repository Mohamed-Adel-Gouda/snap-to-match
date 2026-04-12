import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type DatePreset = "all" | "today" | "week" | "month" | "custom";

export default function ProcessedPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>();

  const getDateRange = (): { from?: string; to?: string } => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case "week":
        return { from: startOfWeek(now, { weekStartsOn: 6 }).toISOString(), to: endOfDay(now).toISOString() };
      case "month":
        return { from: startOfMonth(now).toISOString(), to: endOfDay(now).toISOString() };
      case "custom":
        if (customDate) return { from: startOfDay(customDate).toISOString(), to: endOfDay(customDate).toISOString() };
        return {};
      default:
        return {};
    }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["processed", statusFilter, page, datePreset, customDate?.toISOString()],
    queryFn: async () => {
      let countQuery = supabase
        .from("transfer_screenshots")
        .select("id", { count: "exact", head: true });

      let query = supabase
        .from("transfer_screenshots")
        .select("*, people!matched_person_id(id, full_name)")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("accounting_status", statusFilter);
        countQuery = countQuery.eq("accounting_status", statusFilter);
      }

      const { from, to } = getDateRange();
      if (from) {
        query = query.gte("created_at", from);
        countQuery = countQuery.gte("created_at", from);
      }
      if (to) {
        query = query.lte("created_at", to);
        countQuery = countQuery.lte("created_at", to);
      }

      const [{ data: rows, error }, { count }] = await Promise.all([query, countQuery]);
      if (error) throw error;
      return { rows: rows || [], total: count || 0 };
    },
  });

  const screenshots = data?.rows || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filtered = screenshots.filter(s => {
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
        <p className="text-muted-foreground">{totalCount} records total</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search filename, code, phone, person…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
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
        <Select value={datePreset} onValueChange={v => { setDatePreset(v as DatePreset); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="custom">Pick date</SelectItem>
          </SelectContent>
        </Select>
        {datePreset === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !customDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customDate ? format(customDate, "PP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customDate} onSelect={d => { setCustomDate(d); setPage(0); }} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Filename</th>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Confidence</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No records found</td></tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedId(s.id)}>
                  <td className="px-4 py-3 font-mono text-xs">{s.transaction_code}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate hidden md:table-cell">{s.filename}</td>
                  <td className="px-4 py-3">
                    {(s.people as any)?.full_name ? (
                      <Link to={`/people/${(s.people as any).id}`} className="text-accent hover:underline" onClick={e => e.stopPropagation()}>
                        {(s.people as any).full_name}
                      </Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.extracted_phone_normalized || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.extracted_amount ? `${Number(s.extracted_amount).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
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
              ))
            )}
          </tbody>
        </table>
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
