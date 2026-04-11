import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, XCircle, Link as LinkIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/phone-utils";

interface Props {
  screenshotId: string;
  onClose: () => void;
}

export function TransactionDetailModal({ screenshotId, onClose }: Props) {
  const queryClient = useQueryClient();

  const { data: screenshot } = useQuery({
    queryKey: ["screenshot", screenshotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_screenshots")
        .select("*, people!matched_person_id(id, full_name)")
        .eq("id", screenshotId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: duplicates } = useQuery({
    queryKey: ["duplicates", screenshotId],
    queryFn: async () => {
      const { data } = await supabase
        .from("screenshot_duplicates")
        .select("*, transfer_screenshots!duplicate_of_id(transaction_code)")
        .eq("screenshot_id", screenshotId);
      return data || [];
    },
  });

  const { data: possibleMatches } = useQuery({
    queryKey: ["possible-matches", screenshot?.extracted_phone_normalized],
    queryFn: async () => {
      if (!screenshot?.extracted_phone_normalized) return [];
      const { data } = await supabase
        .from("person_identifiers")
        .select("*, people(*)")
        .eq("normalized_value", screenshot.extracted_phone_normalized);
      return data || [];
    },
    enabled: !!screenshot?.extracted_phone_normalized,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-log", screenshotId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .eq("entity_id", screenshotId)
        .order("performed_at", { ascending: false });
      return data || [];
    },
  });

  const [approvedAmount, setApprovedAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  useEffect(() => {
    if (screenshot) {
      setApprovedAmount(screenshot.approved_amount?.toString() || screenshot.extracted_amount?.toString() || "");
      setRejectReason(screenshot.reject_reason || "");
      setReviewerNotes(screenshot.reviewer_notes || "");
    }
  }, [screenshot]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("transfer_screenshots").update({
        ...updates,
        reviewed_by: user.user?.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", screenshotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screenshot", screenshotId] });
      queryClient.invalidateQueries({ queryKey: ["audit-log", screenshotId] });
      toast.success("Updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleApprove = () => {
    updateMutation.mutate({
      accounting_status: "approved",
      approved_amount: parseFloat(approvedAmount) || null,
      reviewer_notes: reviewerNotes,
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error("Rejection reason is required"); return; }
    updateMutation.mutate({
      accounting_status: "rejected",
      reject_reason: rejectReason,
      reviewer_notes: reviewerNotes,
    });
  };

  const handleManualSave = async () => {
    const norm = normalizePhone(manualPhone);
    const amt = parseFloat(manualAmount);
    const updates: Record<string, any> = {
      extraction_provider: "manual",
      extraction_status: "extracted",
    };
    if (norm) {
      updates.extracted_phone_raw = manualPhone;
      updates.extracted_phone_normalized = norm;
    }
    if (!isNaN(amt)) updates.extracted_amount = amt;

    // Try to match
    if (norm) {
      const { data: matches } = await supabase
        .from("person_identifiers")
        .select("id, person_id, identifier_type")
        .eq("normalized_value", norm)
        .limit(1);
      if (matches && matches.length === 1) {
        updates.matched_person_id = matches[0].person_id;
        updates.matched_identifier_id = matches[0].id;
        updates.matched_identifier_type = matches[0].identifier_type;
        updates.match_confidence = 100;
        updates.match_type = "manual";
        updates.auto_matched = false;
      }
    }
    updateMutation.mutate(updates);
  };

  const handleAssignPerson = (personId: string, identId: string, identType: string) => {
    updateMutation.mutate({
      matched_person_id: personId,
      matched_identifier_id: identId,
      matched_identifier_type: identType,
      match_confidence: 100,
      match_type: "manual",
      auto_matched: false,
    });
  };

  if (!screenshot) return null;

  const imageUrl = screenshot.storage_path
    ? supabase.storage.from("transfer-screenshots").getPublicUrl(screenshot.storage_path).data.publicUrl
    : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{screenshot.transaction_code}</span>
            <span className="text-muted-foreground">·</span>
            <span>{screenshot.filename}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Image */}
          <div>
            {imageUrl && <img src={imageUrl} alt={screenshot.filename} className="rounded-lg border w-full" />}
          </div>

          {/* Right: Fields */}
          <div className="space-y-4">
            {/* Duplicate warning */}
            {duplicates && duplicates.length > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Possible Duplicate</p>
                  <p className="text-xs text-destructive/80">
                    Matches: {duplicates.map(d => (d.transfer_screenshots as any)?.transaction_code).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Matched person */}
            {(screenshot.people as any)?.full_name && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Matched: {(screenshot.people as any).full_name}</span>
                </div>
                <Link to={`/people/${(screenshot.people as any).id}`} className="text-xs text-accent hover:underline flex items-center gap-1" onClick={onClose}>
                  View Profile <LinkIcon className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Phone + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-primary p-3">
                <p className="text-xs text-primary-foreground/70">Phone</p>
                <p className="font-mono text-lg text-primary-foreground">{screenshot.extracted_phone_normalized || "—"}</p>
              </div>
              <div className="rounded-lg bg-accent p-3">
                <p className="text-xs text-accent-foreground/70">Amount</p>
                <p className="font-mono text-lg text-accent-foreground">{screenshot.extracted_amount ? `${Number(screenshot.extracted_amount).toLocaleString()} EGP` : "—"}</p>
              </div>
            </div>

            {/* Transfer summary */}
            {screenshot.transfer_summary_text && (
              <div className="rounded-lg bg-success/5 border border-success/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">Transfer Summary</p>
                <p className="text-sm">{screenshot.transfer_summary_text}</p>
              </div>
            )}

            {/* Visible message */}
            {screenshot.cleaned_visible_message && (
              <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">Visible Message</p>
                <p className="text-sm" dir="auto">{screenshot.cleaned_visible_message}</p>
              </div>
            )}

            {/* Possible matches */}
            {possibleMatches && possibleMatches.length > 0 && !(screenshot.people as any)?.full_name && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Possible Matches</p>
                {possibleMatches.map((m: any) => (
                  <button
                    key={m.id}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    onClick={() => handleAssignPerson(m.person_id, m.id, m.identifier_type)}
                  >
                    <span className="font-medium">{m.people?.full_name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{m.normalized_value}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Finance review */}
            <div className="rounded-lg bg-info/5 border border-info/20 p-4 space-y-3">
              <p className="text-sm font-semibold">Finance Review</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <span className={`status-badge ${
                  screenshot.accounting_status === 'approved' ? 'status-approved' :
                  screenshot.accounting_status === 'rejected' ? 'status-rejected' :
                  screenshot.accounting_status === 'duplicate_review' ? 'status-duplicate' : 'status-pending'
                }`}>
                  {screenshot.accounting_status}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Approved Amount (EGP)</Label>
                <Input value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} className="font-mono" placeholder="0.00" />
                {approvedAmount && screenshot.extracted_amount && parseFloat(approvedAmount) !== Number(screenshot.extracted_amount) && (
                  <p className="text-xs text-warning">⚠ Differs from extracted amount ({Number(screenshot.extracted_amount).toLocaleString()})</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reviewer Notes</Label>
                <Textarea value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)} rows={2} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Rejection Reason</Label>
                <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Required for rejection" />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleApprove} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                  <CheckCircle className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button onClick={handleReject} variant="destructive" className="flex-1" disabled={!rejectReason.trim()}>
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>

            {/* Manual entry */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold">Manual Entry</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="font-mono" placeholder="01012345678" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (EGP)</Label>
                  <Input value={manualAmount} onChange={e => setManualAmount(e.target.value)} className="font-mono" placeholder="0.00" />
                </div>
              </div>
              <Button onClick={handleManualSave} variant="outline" className="w-full" disabled={!manualPhone && !manualAmount}>
                Save & Match
              </Button>
            </div>

            {/* Raw OCR */}
            {screenshot.raw_ocr_text && (
              <details className="rounded-lg border p-3">
                <summary className="text-sm font-medium cursor-pointer">OCR Raw Text</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-muted-foreground" dir="auto">{screenshot.raw_ocr_text}</pre>
              </details>
            )}

            {/* Audit log */}
            {auditLogs && auditLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Audit History</p>
                <div className="space-y-1">
                  {auditLogs.map(log => (
                    <div key={log.id} className="text-xs text-muted-foreground border-l-2 border-border pl-3 py-1">
                      <span className="font-medium">{log.action}</span> — {new Date(log.performed_at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
