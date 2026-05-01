"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export default function PayslipsPage() {
  const [period, setPeriod] = useState("");
  const [paySlipDate, setPaySlipDate] = useState<string>(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [showConfirm, setShowConfirm] = useState(false);
  const [checking, setChecking] = useState(false);

  const periodOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    // last 24 months (including current)
    for (let i = 0; i < 24; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      opts.push(`${mm}-${yyyy}`);
    }
    return opts;
  }, []);

  async function handleGenerate() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }

    try {
      setChecking(true);
      const res = await fetch(`/api/payslips?period=${period}`);
      const j = await res.json();
      if (j?.data && j.data.length > 0) {
        setShowConfirm(true);
        return;
      }
    } catch (err) {
      console.error("Error checking existing payslips:", err);
    } finally {
      setChecking(false);
    }

    await executeGenerate();
  }

  async function executeGenerate() {
    const body: any = { period, paySlipDate };
    const res = await fetch("/api/payslips", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const j = await res.json();
    if (!res.ok || j?.ok === false) {
      toast.error(j?.error || "Failed to generate payslips");
      return;
    }
    toast.success("Payslips generated");
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-md overflow-hidden">
        <div className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Pay Slips</div>
        <div className="p-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
              <label className="block text-sm mb-1">Period</label>
              <Select value={period} onValueChange={(v) => setPeriod(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Pay Slip Date</label>
              <Input type="date" value={paySlipDate} onChange={(e) => setPaySlipDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleGenerate} disabled={!/^\d{2}-\d{4}$/.test(period) || checking}>
              {checking ? "Checking..." : "Generate"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Payslip Already Generated"
        description="Payslips for this month have already been generated. If you generate them again, manpower wages will be updated according to the current wage settings for this month. Are you sure you want to proceed?"
        confirmText="Generate"
        cancelText="Cancel"
        onConfirm={executeGenerate}
      />
    </div>
  );
}
