import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, CreditCard, Hash, Upload, CalendarIcon, Images, Download, Loader2, Copy, Check, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import JSZip from "jszip";
import { toast } from "sonner";

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();
  const [selectedScreenshot, setSelectedScreenshot] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: person, isLoading: loadingPerson } = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*, person_identifiers(*)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: screenshots, isLoading: loadingScreenshots } = useQuery({
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

  const filteredScreenshots = useMemo(() => {
    if (!screenshots) return [];
    return screenshots.filter(s => {
      const d = new Date(s.created_at!);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [screenshots, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("transfer-screenshots").getPublicUrl(storagePath);
    return data?.publicUrl || "";
  };

  const downloadAllImages = async () => {
    if (filteredScreenshots.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const results = await Promise.all(
        filteredScreenshots.map(async (s, idx) => {
          const url = getImageUrl(s.storage_path);
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = s.filename?.split('.').pop() || 'jpg';
          return { name: `${idx + 1}_${s.transaction_code}.${ext}`, blob };
        })
      );
      results.forEach(r => zip.file(r.name, r.blob));
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${person?.full_name || "screenshots"}_${filteredScreenshots.length}_images.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Downloaded ${filteredScreenshots.length} screenshots`);
    } catch (err) {
      toast.error("Failed to download images");
    } finally {
      setDownloading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLImageElement>, s: any) => {
    const url = getImageUrl(s.storage_path);
    const ext = s.filename?.split('.').pop() || 'jpg';
    const name = `${s.transaction_code}.${ext}`;
    // Standard drag data — most chat apps & file managers accept these
    e.dataTransfer.setData("text/uri-list", url);
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.setData("DownloadURL", `image/${ext}:${name}:${url}`);
    e.dataTransfer.effectAllowed = "copy";
  };

  const copyImageToClipboard = async (s: any) => {
    try {
      const url = getImageUrl(s.storage_path);
      const res = await fetch(url);
      const blob = await res.blob();
      // Clipboard API requires PNG in most browsers — convert if needed
      let finalBlob = blob;
      if (blob.type !== "image/png") {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bitmap, 0, 0);
        finalBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png")
        );
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": finalBlob }),
      ]);
      setCopiedId(s.id);
      toast.success("Image copied — paste it anywhere");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Couldn't copy image. Try dragging it instead.");
    }
  };

  if (loadingPerson) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="metric-card"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-12" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (!person) return <div className="p-8 text-muted-foreground">Person not found.</div>;

  const identifiers = (person.person_identifiers || []) as any[];
  const primaryPhone = identifiers.find((i: any) => i.identifier_type === "primary_phone");
  const totalMatched = filteredScreenshots.length;
  const autoMatched = filteredScreenshots.filter(s => s.auto_matched).length;
  const manualMatched = totalMatched - autoMatched;
  const activeVolume = filteredScreenshots.filter(s => s.accounting_status !== 'rejected').reduce((sum, s) => sum + (Number(s.approved_amount || s.extracted_amount) || 0), 0);
  const approvedVolume = filteredScreenshots.filter(s => s.accounting_status === 'approved').reduce((sum, s) => sum + (Number(s.approved_amount || s.extracted_amount) || 0), 0);

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

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasDateFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            Clear
          </Button>
        )}
        {hasDateFilter && (
          <span className="text-sm text-muted-foreground ml-2">
            Showing {filteredScreenshots.length} of {screenshots?.length || 0} screenshots
          </span>
        )}
        {filteredScreenshots.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setGalleryOpen(true)} className="ml-auto">
            <Images className="mr-2 h-4 w-4" />
            View All Images ({filteredScreenshots.length})
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="metric-card"><p className="text-xs text-muted-foreground">Total Screenshots</p><p className="text-2xl font-bold font-mono mt-1">{totalMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Matched</p><p className="text-2xl font-bold font-mono mt-1">{totalMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Auto-matched</p><p className="text-2xl font-bold font-mono mt-1">{autoMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Manual</p><p className="text-2xl font-bold font-mono mt-1">{manualMatched}</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Active Volume (EGP)</p><p className="text-2xl font-bold font-mono mt-1">{activeVolume.toLocaleString()}</p><p className="text-[10px] text-muted-foreground mt-0.5">Excludes rejected</p></div>
        <div className="metric-card"><p className="text-xs text-muted-foreground">Approved Volume (EGP)</p><p className="text-2xl font-bold font-mono mt-1">{approvedVolume.toLocaleString()}</p><p className="text-[10px] text-muted-foreground mt-0.5">Approved only</p></div>
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
            {identifiers.length === 0 && (
              <div className="px-6 py-6 text-center">
                <p className="text-sm text-muted-foreground">No linked accounts yet.</p>
                <Link to="/people" className="text-xs text-accent hover:underline mt-1 inline-block">Edit this person to add phone numbers</Link>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 table-container overflow-x-auto">
          <div className="border-b px-6 py-4"><h2 className="font-semibold">Linked Screenshots</h2></div>
          {loadingScreenshots ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredScreenshots.length > 0 ? (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Match</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredScreenshots.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedScreenshot(s)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{s.transaction_code}</td>
                    <td className="px-4 py-3 text-xs">{new Date(s.created_at!).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs hidden sm:table-cell">{s.extracted_phone_normalized}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
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
          ) : (
            <div className="px-6 py-12 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{hasDateFilter ? "No screenshots in this date range." : "No transactions yet."}</p>
              {!hasDateFilter && <Link to="/upload" className="text-xs text-accent hover:underline mt-1 inline-block">Upload screenshots to get started</Link>}
            </div>
          )}
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
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                <img
                  src={getImageUrl(selectedScreenshot.storage_path)}
                  alt="Transfer screenshot"
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>
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

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                All Screenshots ({filteredScreenshots.length})
                {hasDateFilter && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "..."} — {dateTo ? format(dateTo, "dd/MM/yyyy") : "..."}
                  </span>
                )}
              </DialogTitle>
              <Button size="sm" onClick={downloadAllImages} disabled={downloading} className="mr-6">
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {downloading ? "Downloading..." : "Download All as ZIP"}
              </Button>
            </div>
          </DialogHeader>
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
            <GripVertical className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Tip:</strong> Drag any image directly into WhatsApp, Telegram, or your file explorer.
              You can also click the copy icon to paste it anywhere.
            </span>
          </div>
          <div className="space-y-4">
            {filteredScreenshots.map((s, idx) => (
              <div key={s.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-xs">
                  <span className="font-mono">{s.transaction_code}</span>
                  <div className="flex items-center gap-3">
                    <span>{new Date(s.created_at!).toLocaleDateString()}</span>
                    <span className="font-mono font-medium">
                      {s.approved_amount || s.extracted_amount ? `${Number(s.approved_amount || s.extracted_amount).toLocaleString()} EGP` : "—"}
                    </span>
                    <span className={`status-badge ${s.accounting_status === 'approved' ? 'status-approved' : s.accounting_status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
                      {s.accounting_status}
                    </span>
                  </div>
                </div>
                <div className="relative group">
                  <img
                    src={getImageUrl(s.storage_path)}
                    alt={`Screenshot ${idx + 1}`}
                    className="w-full h-auto cursor-grab active:cursor-grabbing"
                    loading="lazy"
                    draggable
                    onDragStart={(e) => handleDragStart(e, s)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyImageToClipboard(s)}
                    className="absolute top-2 right-2 h-8 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedId === s.id ? (
                      <><Check className="mr-1 h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="mr-1 h-3 w-3" /> Copy</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
