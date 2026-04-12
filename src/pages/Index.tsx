import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, CheckCircle, DollarSign, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold font-mono">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="mt-2 h-8 w-16" />
    </div>
  );
}

export default function Index() {
  const { data: screenshots, isLoading: loadingScreenshots } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_screenshots")
        .select("id, extracted_amount, matched_person_id, accounting_status, created_at, extracted_phone_normalized, approved_amount");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: people, isLoading: loadingPeople } = useQuery({
    queryKey: ["dashboard-people"],
    queryFn: async () => {
      const { data } = await supabase.from("people").select("id, full_name").limit(5);
      return data || [];
    },
  });

  const total = screenshots?.length || 0;
  const matched = screenshots?.filter(s => s.matched_person_id).length || 0;
  const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0;
  const activeVolume = screenshots?.filter(s => s.accounting_status !== 'rejected').reduce((sum, s) => sum + (Number(s.approved_amount || s.extracted_amount) || 0), 0) || 0;
  const approvedVolume = screenshots?.filter(s => s.accounting_status === 'approved').reduce((sum, s) => sum + (Number(s.approved_amount || s.extracted_amount) || 0), 0) || 0;

  const recent = (screenshots || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Finance operations overview</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {loadingScreenshots ? (
          <>
            <MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Total Screenshots" value={String(total)} icon={LayoutDashboard} />
            <MetricCard label="Matched" value={String(matched)} icon={CheckCircle} />
            <MetricCard label="Active Volume (EGP)" value={activeVolume.toLocaleString()} icon={DollarSign} sub="Excludes rejected" />
            <MetricCard label="Approved Volume (EGP)" value={approvedVolume.toLocaleString()} icon={CheckCircle} sub="Approved only" />
            <MetricCard label="Match Rate" value={`${matchRate}%`} icon={Target} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="table-container">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {loadingScreenshots ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : recent.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No screenshots yet. <Link to="/upload" className="text-accent underline">Upload some</Link>.</p>
            ) : (
              recent.map(s => (
                <div key={s.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <span className="font-mono text-xs">{s.extracted_phone_normalized || "—"}</span>
                    <span className="ml-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{s.extracted_amount ? `${Number(s.extracted_amount).toLocaleString()} EGP` : "—"}</span>
                    <span className={`status-badge ${s.accounting_status === 'approved' ? 'status-approved' : s.accounting_status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
                      {s.accounting_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="table-container">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">People Directory</h2>
          </div>
          <div className="divide-y">
            {loadingPeople ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            ) : people?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No people added. <Link to="/people" className="text-accent underline">Add people</Link>.</p>
            ) : (
              people?.map(p => (
                <Link key={p.id} to={`/people/${p.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-foreground">
                    {p.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{p.full_name}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
