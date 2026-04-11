import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateImageFingerprint, generateTransactionCode } from "@/lib/phone-utils";
import { toast } from "sonner";

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  progress: string;
  error?: string;
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);

  const updateItem = (idx: number, update: Partial<UploadItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...update } : it)));
  };

  const processFile = async (file: File, idx: number) => {
    try {
      updateItem(idx, { status: "uploading", progress: "Uploading image…" });

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const fingerprint = generateImageFingerprint(base64);

      // Check duplicates
      const { data: dupes } = await supabase
        .from("transfer_screenshots")
        .select("id, transaction_code")
        .eq("image_fingerprint", fingerprint);

      // Upload to storage
      const storagePath = `uploads/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("transfer-screenshots")
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      // Generate transaction code
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { count } = await supabase
        .from("transfer_screenshots")
        .select("id", { count: "exact", head: true })
        .like("transaction_code", `TX-${today}-%`);
      const txCode = generateTransactionCode(count || 0);

      // Insert record
      const { data: user } = await supabase.auth.getUser();
      const { data: record, error: insertError } = await supabase
        .from("transfer_screenshots")
        .insert({
          transaction_code: txCode,
          filename: file.name,
          storage_path: storagePath,
          image_fingerprint: fingerprint,
          uploaded_by: user.user?.id,
          extraction_status: "processing",
          accounting_status: dupes && dupes.length > 0 ? "duplicate_review" : "pending",
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Insert duplicate records
      if (dupes && dupes.length > 0) {
        for (const dupe of dupes) {
          await supabase.from("screenshot_duplicates").insert({
            screenshot_id: record.id,
            duplicate_of_id: dupe.id,
            reason: "identical_image",
          });
        }
      }

      // Call extraction
      updateItem(idx, { status: "extracting", progress: "Extracting with Claude Vision…" });
      const { data: extractionResult, error: fnError } = await supabase.functions.invoke("extract-transfer", {
        body: { imageBase64: base64, mediaType: file.type || "image/jpeg", screenshotId: record.id },
      });

      if (fnError) throw fnError;

      updateItem(idx, { status: "done", progress: `Done — ${extractionResult?.transferSummaryText || txCode}` });
    } catch (err: any) {
      updateItem(idx, { status: "error", progress: "Failed", error: err.message });
      toast.error(`${file.name}: ${err.message}`);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: UploadItem[] = acceptedFiles.map(f => ({
      file: f,
      status: "pending" as const,
      progress: "Queued",
    }));
    setItems(prev => [...prev, ...newItems]);
    const startIdx = items.length;
    acceptedFiles.forEach((file, i) => {
      setTimeout(() => processFile(file, startIdx + i), i * 500);
    });
  }, [items.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Screenshots</h1>
        <p className="text-muted-foreground">Upload transfer confirmation screenshots for extraction</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="status-badge bg-info/10 text-info">Claude Vision</span>
        <span className="text-xs text-muted-foreground">Extraction engine</span>
      </div>

      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
          isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Drop screenshots here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP supported</p>
      </div>

      {items.length > 0 && (
        <div className="table-container divide-y">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3">
              <div className="shrink-0">
                {item.status === "done" ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : item.status === "error" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 text-accent animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">{item.progress}</p>
                {item.error && <p className="text-xs text-destructive mt-0.5">{item.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
