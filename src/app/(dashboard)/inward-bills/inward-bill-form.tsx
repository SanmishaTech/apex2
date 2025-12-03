"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/common/app-button";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { toast } from "@/lib/toast";
import { apiPost } from "@/lib/api-client";
import { formatDate } from "@/lib/locales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type InwardBillEditPayload = {
  billNo: string;
  billDate: string; // ISO
  billAmount: number;
  dueDays: number;
  dueDate: string | null; // ISO
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
};

export type InwardBillFormProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  challanId: number | null;
  display: {
    inwardChallanNo: string;
    inwardChallanDate: string;
    challanNo: string;
    challanDate: string;
    totalPaidAmount: number | string | null;
  } | null;
  defaults: {
    billNo?: string | null;
    billDate?: string | null;
    billAmount?: number | string | null;
    dueDays?: number | null;
    dueDate?: string | null;
    status?: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  } | null;
  onSaved?: () => void;
};

export function InwardBillForm(props: InwardBillFormProps) {
  const { open, onOpenChange, challanId, display, defaults, onSaved } = props;

  const todayIso = useMemo(() => new Date().toISOString(), []);

  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState<string>(todayIso);
  const [billAmount, setBillAmount] = useState<number>(0);
  const [dueDays, setDueDays] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(todayIso);
  const [status, setStatus] = useState<"UNPAID" | "PARTIALLY_PAID" | "PAID">(
    "UNPAID"
  );
  const totalPaid = Number(display?.totalPaidAmount || 0);

  useEffect(() => {
    if (!open) return;
    setBillNo((defaults?.billNo || "").toString());
    setBillDate(defaults?.billDate || todayIso);
    setBillAmount(Number(defaults?.billAmount || 0));
    setDueDays(Number(defaults?.dueDays || 0));
    setDueDate(defaults?.dueDate || todayIso);
    setStatus(defaults?.status || "UNPAID");
  }, [open, defaults, todayIso]);

  // Adjust due date when bill date or dueDays changes
  useEffect(() => {
    try {
      const base = new Date(billDate);
      if (Number.isFinite(dueDays)) {
        const d = new Date(base);
        d.setDate(d.getDate() + Number(dueDays || 0));
        setDueDate(d.toISOString());
      }
    } catch {}
  }, [billDate, dueDays]);

  async function handleSave() {
    try {
      if (!challanId) return;
      if (!billNo || billNo.trim().length === 0) {
        toast.error("Bill number is required");
        return;
      }
      const payload: InwardBillEditPayload = {
        billNo: billNo.trim(),
        billDate,
        billAmount: Number(billAmount || 0),
        dueDays: Number(dueDays || 0),
        dueDate,
        status,
      };
      await apiPost(`/api/inward-delivery-challans/${challanId}/bill`, payload);
      toast.success("Bill updated");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update bill");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Bill</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <NonFormTextInput
              label="Inward Challan No."
              value={display?.inwardChallanNo || ""}
              readOnly
            />
            <NonFormTextInput
              label="Inward Challan Date"
              value={display?.inwardChallanDate ? formatDate(display.inwardChallanDate) : ""}
              readOnly
            />
            <NonFormTextInput
              label="Challan No."
              value={display?.challanNo || ""}
              readOnly
            />
            <NonFormTextInput
              label="Challan Date"
              value={display?.challanDate ? formatDate(display.challanDate) : ""}
              readOnly
            />
            <NonFormTextInput
              label="Total Paid Amount"
              value={totalPaid.toFixed(2)}
              readOnly
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NonFormTextInput
              label="Bill Number"
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
            />
            <NonFormTextInput
              label="Bill Date"
              type="date"
              value={new Date(billDate).toISOString().slice(0, 10)}
              onChange={(e) => {
                const s = e.target.value;
                const dt = new Date(s);
                setBillDate(new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString());
              }}
            />
            <NonFormTextInput
              label="Bill Amount"
              type="number"
              value={String(billAmount)}
              onChange={(e) => setBillAmount(Number(e.target.value || 0))}
            />
            <NonFormTextInput
              label="Due Days"
              type="number"
              value={String(dueDays)}
              onChange={(e) => setDueDays(Number(e.target.value || 0))}
            />
            <NonFormTextInput
              label="Due Date"
              type="date"
              value={new Date(dueDate).toISOString().slice(0, 10)}
              onChange={(e) => {
                const s = e.target.value;
                const dt = new Date(s);
                setDueDate(new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString());
              }}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="border rounded px-3 py-2 h-10"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="PAID">PAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="UNPAID">UNPAID</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <AppButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </AppButton>
          <AppButton type="button" onClick={handleSave}>
            Save
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
