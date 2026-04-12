import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">System configuration</p>
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
