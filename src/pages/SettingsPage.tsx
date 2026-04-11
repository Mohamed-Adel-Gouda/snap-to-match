import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [threshold, setThreshold] = useState(80);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure matching and extraction settings</p>
      </div>

      <div className="metric-card max-w-md space-y-4">
        <div>
          <Label>Match Confidence Threshold</Label>
          <p className="text-xs text-muted-foreground mt-1">Auto-match only when confidence is above this value</p>
        </div>
        <Slider value={[threshold]} onValueChange={v => setThreshold(v[0])} min={50} max={100} step={5} />
        <p className="text-sm font-mono">{threshold}%</p>
      </div>

      <div className="metric-card max-w-md space-y-4">
        <div>
          <Label>Extraction Engine</Label>
          <p className="text-xs text-muted-foreground mt-1">Currently using Claude Vision (claude-sonnet-4-20250514)</p>
        </div>
        <div className="status-badge bg-info/10 text-info">Claude Vision — Active</div>
      </div>
    </div>
  );
}
