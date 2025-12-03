"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/locales";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// Types for the single challan fetch
type IDCDetail = {
  id: number;
  inwardChallanNo: string;
  inwardChallanDate: string;
  challanNo: string;
  challanDate: string;
  billNo: string | null;
  billDate: string | null;
  billAmount: number | string | null;
  dueDays?: number | null;
  dueDate: string | null;
  totalPaidAmount: number | string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
};

export default function EditInwardBillPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const { data, error, isLoading, mutate } = useSWR<{ data: IDCDetail } | IDCDetail>(
    isFinite(id) ? `/api/inward-delivery-challans/${id}` : null,
    apiGet
  );

  // Form state
  const todayIso = useMemo(() => new Date().toISOString(), []);
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState<string>(todayIso);
  const [billAmount, setBillAmount] = useState<number>(0);
  const [dueDays, setDueDays] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(todayIso);
  const [status, setStatus] = useState<"UNPAID" | "PARTIALLY_PAID" | "PAID">(
    "UNPAID"
  );

  const challan = (data as any)?.data ?? (data as any);
  const totalPaid = Number(challan?.totalPaidAmount || 0);

  // dd/mm/yyyy
  const fmtDMY = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB") : "";

  useEffect(() => {
    if (!challan) return;
    setBillNo(challan.billNo || "");
    setBillDate(challan.billDate || todayIso);
    setBillAmount(Number(challan.billAmount || 0));
    setDueDays(Number(challan.dueDays || 0));
    setDueDate(challan.dueDate || todayIso);
    setStatus(challan.status);
  }, [challan, todayIso]);

  // Auto update dueDate when billDate or dueDays changes
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
      if (!id) return;
      if (!(Number(billAmount) > 0)) {
        toast.error("Bill amount must be greater than 0");
        return;
      }
      const payload = {
        billNo: billNo.trim(),
        billDate,
        billAmount: Number(billAmount || 0),
        dueDays: Number(dueDays || 0),
        dueDate,
        status,
      };
      await apiPost(`/api/inward-delivery-challans/${id}/bill`, payload);
      toast.success("Bill updated");
      await mutate();
      router.push("/inward-bills");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update bill");
    }
  }

  function handleCancel() {
    router.push("/inward-bills");
  }

  if (error) return <div className="p-4">Failed to load</div>;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Edit Bill</AppCard.Title>
        <AppCard.Description>Update bill details</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        {/* Display-only challan fields (plain text) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Inward Challan No.</div>
            <div className="text-base font-medium">{challan?.inwardChallanNo || ""}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Inward Challan Date</div>
            <div className="text-base font-medium">{fmtDMY(challan?.inwardChallanDate)}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Challan No.</div>
            <div className="text-base font-medium">{challan?.challanNo || ""}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Challan Date</div>
            <div className="text-base font-medium">{fmtDMY(challan?.challanDate)}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Total Paid Amount</div>
            <div className="text-base font-medium">{totalPaid.toFixed(2)}</div>
          </div>
        </div>

        {/* Editable bill fields */}
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
              setBillDate(
                new Date(
                  Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())
                ).toISOString()
              );
            }}
          />
          <NonFormTextInput
            label="Bill Amount"
            type="number"
            min={0.01}
            step={0.01}
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
              const iso = new Date(
                Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())
              ).toISOString();
              setDueDate(iso);
              // also update dueDays = (dueDate - billDate) in days
              try {
                const bd = new Date(billDate);
                const diffMs = new Date(iso).getTime() - new Date(
                  Date.UTC(bd.getFullYear(), bd.getMonth(), bd.getDate())
                ).getTime();
                const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
                setDueDays(days);
              } catch {}
            }}
          />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">PARTIALLY PAID</SelectItem>
                  <SelectItem value="UNPAID">UNPAID</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <AppButton variant="secondary" type="button" onClick={handleCancel}>
          Cancel
        </AppButton>
        <AppButton type="button" onClick={handleSave}>
          Save
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
