import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, CreditCard, Hash, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();
  const [selectedScreenshot, setSelectedScreenshot] = useState<any>(null);

  const { data: person } = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*, person_identifiers(*)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: screenshots } = useQuery({
    queryKey: ["person-screenshots", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_screenshots")
        .select("*")
        .eq("matched_person_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("transfer-screenshots").getPublicUrl(storagePath);
    return data?.publicUrl || "";
  };

  if (!person) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const identifiers = (person.person_identifiers || []) as any[];
  const primaryPhone = identifiers.find((i: any) => i.identifier_type === "primary_phone");
  const totalMatched = screenshots?.length || 0;
  const autoMatched = screenshots?.filter(s => s.auto_matched).length || 0;
  const manualMatched = totalMatched - autoMatched;
  const totalVolume = screenshots?.reduce((sum, s) => sum + (Number(s.approved_amount || s.extracted_amount) || 0), 0) || 0;

  const iconForType = (type: string) => {
    if (type.includes("phone")) return Phone;
    if (type === "wallet") return CreditCard;
    return Hash;
  };

  return (
    <div className="space-y-6">
      <Link to="/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to People
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent-foreground">
          {person.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{person.full_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`status-badge ${person.status === 'active' ? 'status-matched' : 'status-error'}`}>{person.status}</span>
            {primaryPhone && <span className="font-mono text-sm text-muted-foreground">{primaryPhone.normalized_value}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="metric-card"><p className="text-xs text-muted-foreground">Total Screenshots</p><p className="text-2xl font-bold font-mono mt-1">{totalMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Matched</p><p className="text-2xl font-bold font-mono mt-1">{totalMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Auto-matched</p><p className="text-2xl font-bold font-mono mt-1">{autoMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Manual</p><p className="text-2xl font-bold font-mono mt-1">{manualMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Volume (EGP)</p><p className="text-2xl font-bold font-mono mt-1">{totalVolume.toLocaleString()}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="table-container">
          <div className="border-b px-6 py-4"><h2 className="font-semibold">Linked Accounts</h2></div>
          <div className="divide-y">
            {identifiers.map((ident: any) => {
              const Icon = iconForType(ident.identifier_type);
              return (
                <div key={ident.id} className="px-6 py-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium capitalize">{ident.identifier_type.replace("_", " ")}</p>
                    <p className="font-mono text-xs text-muted-foreground">{ident.normalized_value}</p>
                  </div>
                </div>
              );
            })}
            {identifiers.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">No identifiers</p>}
          </div>
        </div>

        <div className="lg:col-span-2 table-container overflow-x-auto">
          <div className="border-b px-6 py-4"><h2 className="font-semibold">Linked Screenshots</h2></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {screenshots?.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedScreenshot(s)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{s.transaction_code}</td>
                  <td className="px-4 py-3 text-xs">{new Date(s.created_at!).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.extracted_phone_normalized}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${s.auto_matched ? 'status-matched' : 'status-pending'}`}>
                      {s.auto_matched ? "Auto" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.approved_amount || s.extracted_amount ? Number(s.approved_amount || s.extracted_amount).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${s.accounting_status === 'approved' ? 'status-approved' : s.accounting_status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
                      {s.accounting_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screenshot Viewer Modal */}
      <Dialog open={!!selectedScreenshot} onOpenChange={open => !open && setSelectedScreenshot(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Transaction: {selectedScreenshot?.transaction_code}
            </DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <div className="space-y-4">
              {/* Screenshot Image */}
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                <img
                  src={getImageUrl(selectedScreenshot.storage_path)}
                  alt="Transfer screenshot"
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Amount</p>
                  <p className="font-mono font-medium">
                    {Number(selectedScreenshot.approved_amount || selectedScreenshot.extracted_amount || 0).toLocaleString()} {selectedScreenshot.currency || "EGP"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Service Fee</p>
                  <p className="font-mono font-medium">{selectedScreenshot.service_fee ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="font-mono font-medium">{selectedScreenshot.extracted_phone_normalized || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <span className={`status-badge ${selectedScreenshot.accounting_status === 'approved' ? 'status-approved' : selectedScreenshot.accounting_status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
                    {selectedScreenshot.accounting_status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Match Type</p>
                  <p className="font-medium">{selectedScreenshot.auto_matched ? "Auto" : "Manual"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Confidence</p>
                  <p className="font-mono font-medium">{selectedScreenshot.match_confidence ?? "—"}%</p>
                </div>
              </div>

              {/* Cleaned Message */}
              {selectedScreenshot.cleaned_visible_message && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Extracted Message</p>
                  <p className="text-sm bg-muted/50 rounded-md p-3 font-mono leading-relaxed" dir="auto">
                    {selectedScreenshot.cleaned_visible_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
