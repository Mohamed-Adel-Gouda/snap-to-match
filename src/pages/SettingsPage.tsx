import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "auto_approve_enabled")
      .single()
      .then(({ data }) => {
        if (data) setAutoApprove(data.value === true);
        setLoading(false);
      });
  }, []);

  const handleToggle = async (checked: boolean) => {
    setAutoApprove(checked);
    const { error } = await supabase
      .from("app_settings")
      .update({ value: checked as any, updated_at: new Date().toISOString() })
      .eq("key", "auto_approve_enabled");

    if (error) {
      setAutoApprove(!checked);
      toast.error("Failed to update setting — you may not have admin access");
    } else {
      toast.success(`Auto-Approve ${checked ? "enabled" : "disabled"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">System configuration</p>
      </div>

      <div className="metric-card max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-approve">Auto-Approve</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically approve transactions with 80%+ match confidence instead of sending them to the Review Queue.
            </p>
          </div>
          <Switch
            id="auto-approve"
            checked={autoApprove}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>
      </div>

      <div className="metric-card max-w-md space-y-4">
        <div>
          <Label>Extraction Engine</Label>
          <p className="text-xs text-muted-foreground mt-1">AI-powered data extraction from transfer screenshots</p>
        </div>
        <div className="status-badge bg-info/10 text-info">Gemini 2.5 Flash — Active</div>
      </div>

      <div className="metric-card max-w-md space-y-4">
        <div>
          <Label>Match Confidence</Label>
          <p className="text-xs text-muted-foreground mt-1">Auto-match threshold is 80%. Transactions below this threshold are sent to the Review Queue.</p>
        </div>
        <div className="status-badge bg-accent/10 text-accent-foreground">80% threshold</div>
      </div>
    </div>
  );
}
