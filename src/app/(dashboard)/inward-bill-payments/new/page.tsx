"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { DataTable, Column } from "@/components/common/data-table";
import { formatDate } from "@/lib/locales";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

const PAYMENT_MODES = [
  "CASH",
  "UPI",
  "RTGS",
  "NEFT",
  "CHEQUE",
  "NET_BANKING",
] as const;

type ChallanInfo = {
  id: number;
  challanNo: string;
  inwardChallanNo: string;
  billNo: string | null;
  dueAmount?: number | string | null;
  billAmount?: number | string | null;
  totalPaidAmount?: number | string | null;
};

export default function NewInwardBillPaymentPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const challanId = Number(sp.get("challanId"));
  const { can } = usePermissions();
  const canDeletePayment = can(PERMISSIONS.DELETE_INWARD_BILL_PAYMENT);

  const { data, mutate: mutateChallan } = useSWR<
    ChallanInfo | { data: ChallanInfo }
  >(
    Number.isFinite(challanId)
      ? `/api/inward-delivery-challans/${challanId}`
      : null,
    apiGet
  );
  const challan = (data as any)?.data ?? (data as any);

  // Payments list for this challan
  const { data: payments, mutate: mutatePayments } = useSWR<
    | Array<{
        id: number;
        paymentDate: string;
        paymentMode: string;
        chequeNo: string | null;
        chequeDate: string | null;
        utrNo: string | null;
        rtgsDate: string | null;
        neftDate: string | null;
        transactionNo: string | null;
        transactionDate: string | null;
        bankName: string | null;
        paidAmount: string | number;
        createdAt: string;
      }>
    | { data: any[] }
  >(
    Number.isFinite(challanId)
      ? `/api/inward-bill-details?challanId=${challanId}`
      : null,
    apiGet
  );
  const paymentsList: any[] = Array.isArray((payments as any)?.data)
    ? (payments as any).data
    : Array.isArray(payments)
    ? (payments as any)
    : [];

  type PaymentRow = {
    id: number;
    paymentDate: string;
    paymentMode: string;
    paidAmount: number | string;
    bankName?: string | null;
    chequeNo?: string | null;
    chequeDate?: string | null;
    utrNo?: string | null;
    rtgsDate?: string | null;
    neftDate?: string | null;
    transactionNo?: string | null;
    transactionDate?: string | null;
    createdAt: string;
  };

  const paymentColumns: Column<PaymentRow>[] = [
    {
      key: "paymentDate",
      header: "Payment Date",
      sortable: false,
      accessor: (r) => new Date(r.paymentDate).toLocaleDateString("en-GB"),
      className: "whitespace-nowrap",
    },
    {
      key: "paymentMode",
      header: "Mode",
      sortable: false,
      accessor: (r) =>
        r.paymentMode === "NET_BANKING" ? "Net Banking" : r.paymentMode,
      className: "whitespace-nowrap",
    },
    {
      key: "paidAmount",
      header: "Paid Amount",
      sortable: false,
      accessor: (r) => String(r.paidAmount),
      className: "whitespace-nowrap",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "bankName",
      header: "Bank Name",
      sortable: false,
      accessor: (r) => r.bankName || "-",
      className: "whitespace-nowrap",
    },
    {
      key: "utrNo",
      header: "UTR No",
      sortable: false,
      accessor: (r) => r.utrNo || "-",
      className: "whitespace-nowrap",
    },
    {
      key: "transactionNo",
      header: "Txn No",
      sortable: false,
      accessor: (r) => r.transactionNo || "-",
      className: "whitespace-nowrap",
    },
    {
      key: "chequeNo",
      header: "Cheque No",
      sortable: false,
      accessor: (r) => r.chequeNo || "-",
      className: "whitespace-nowrap",
    },
    {
      key: "chequeDate",
      header: "Cheque Date",
      sortable: false,
      accessor: (r) =>
        r.chequeDate ? new Date(r.chequeDate).toLocaleDateString("en-GB") : "-",
      className: "whitespace-nowrap",
    },
    {
      key: "rtgsDate",
      header: "RTGS Date",
      sortable: false,
      accessor: (r) =>
        r.rtgsDate ? new Date(r.rtgsDate).toLocaleDateString("en-GB") : "-",
      className: "whitespace-nowrap",
    },
    {
      key: "neftDate",
      header: "NEFT Date",
      sortable: false,
      accessor: (r) =>
        r.neftDate ? new Date(r.neftDate).toLocaleDateString("en-GB") : "-",
      className: "whitespace-nowrap",
    },
    {
      key: "transactionDate",
      header: "Txn Date",
      sortable: false,
      accessor: (r) =>
        r.transactionDate
          ? new Date(r.transactionDate).toLocaleDateString("en-GB")
          : "-",
      className: "whitespace-nowrap",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: false,
      accessor: (r) => new Date(r.createdAt).toLocaleDateString("en-GB"),
      className: "whitespace-nowrap",
    },
  ];

  // Form state
  const todayIsoDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [paymentDate, setPaymentDate] = useState<string>(todayIsoDate);
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [utrNo, setUtrNo] = useState<string>("");
  const [rtgsDate, setRtgsDate] = useState<string>(todayIsoDate);
  const [neftDate, setNeftDate] = useState<string>(todayIsoDate);
  const [chequeNo, setChequeNo] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(todayIsoDate);
  const [transactionNo, setTransactionNo] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(todayIsoDate);
  const [bankName, setBankName] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // Reset conditional fields when payment mode changes
  useEffect(() => {
    setUtrNo("");
    setChequeNo("");
    setBankName("");
    setTransactionNo("");
  }, [paymentMode]);

  // Prefill paid amount with dueAmount when challan loads (only if amount is 0)
  useEffect(() => {
    if (challan && Number(paidAmount) === 0) {
      setPaidAmount(Number(challan.dueAmount || 0));
    }
  }, [challan]);

  function needs(field: "utr" | "rtgs" | "neft" | "cheque" | "netbank") {
    switch (field) {
      case "utr":
        return (
          paymentMode === "UPI" ||
          paymentMode === "RTGS" ||
          paymentMode === "NEFT"
        );
      case "rtgs":
        return paymentMode === "RTGS";
      case "neft":
        return paymentMode === "NEFT";
      case "cheque":
        return paymentMode === "CHEQUE";
      case "netbank":
        return paymentMode === "NET_BANKING";
    }
  }

  function toIsoWithCurrentTime(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const base = new Date(dateStr);
    if (isNaN(base.getTime())) return null;
    const now = new Date();
    const d = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );
    return d.toISOString();
  }

  async function handleSave() {
    if (saving) return;
    try {
      setSaving(true);
      if (!Number.isFinite(challanId)) {
        toast.error("Invalid challan");
        return;
      }
      if (!paymentDate) {
        toast.error("Payment date is required");
        return;
      }
      if (!paymentMode) {
        toast.error("Payment mode is required");
        return;
      }
      if (!(Number(paidAmount) > 0)) {
        toast.error("Paid amount must be greater than 0");
        return;
      }
      // Enforce paidAmount <= due
      const due = Number(
        (challan?.dueAmount ??
          Number(challan?.billAmount || 0) -
            Number(challan?.totalPaidAmount || 0)) ||
          0
      );
      if (Number(paidAmount) > Math.max(0, due)) {
        toast.error("Paid amount cannot exceed outstanding due");
        return;
      }
      // Conditional mandatory fields
      if (needs("utr") && !utrNo.trim()) {
        toast.error("UTR Number is required");
        return;
      }
      if (needs("rtgs") && (!rtgsDate || !bankName.trim())) {
        toast.error("RTGS Date and Bank Name are required");
        return;
      }
      if (needs("neft") && (!neftDate || !bankName.trim())) {
        toast.error("NEFT Date and Bank Name are required");
        return;
      }
      if (
        needs("cheque") &&
        (!chequeNo.trim() || !chequeDate || !bankName.trim())
      ) {
        toast.error("Cheque Number, Cheque Date and Bank Name are required");
        return;
      }
      if (
        needs("netbank") &&
        (!transactionNo.trim() || !transactionDate || !bankName.trim())
      ) {
        toast.error(
          "Transaction Number, Transaction Date and Bank Name are required"
        );
        return;
      }

      const payload = {
        inwardDeliveryChallanId: challanId,
        paymentDate: toIsoWithCurrentTime(paymentDate),
        paymentMode,
        paidAmount: Number(paidAmount),
        utrNo: needs("utr") ? utrNo.trim() : null,
        rtgsDate: needs("rtgs") ? toIsoWithCurrentTime(rtgsDate) : null,
        neftDate: needs("neft") ? toIsoWithCurrentTime(neftDate) : null,
        chequeNo: needs("cheque") ? chequeNo.trim() : null,
        chequeDate: needs("cheque") ? toIsoWithCurrentTime(chequeDate) : null,
        transactionNo: needs("netbank") ? transactionNo.trim() : null,
        transactionDate: needs("netbank")
          ? toIsoWithCurrentTime(transactionDate)
          : null,
        bankName:
          needs("rtgs") || needs("neft") || needs("cheque") || needs("netbank")
            ? bankName.trim()
            : null,
      };

      await apiPost("/api/inward-bill-details", payload);
      toast.success("Payment added");
      // Revalidate challan and payments, then redirect to bills list
      await Promise.all([mutateChallan(), mutatePayments()]);
      router.push(`/inward-bills`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add payment");
    } finally {
      // In case redirect doesn't happen, ensure UI re-enables
      setSaving(false);
    }
  }

  function handleCancel() {
    router.back();
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          Add Payment for Bill No. {challan?.billNo || "—"} of Challan{" "}
          {challan?.challanNo || "—"}
        </AppCard.Title>
        <AppCard.Description>
          Record a payment for this inward bill.
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NonFormTextInput
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Payment Mode
            </label>
            <Select
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v)}
            >
              <SelectTrigger className="h-8 w-82">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m === "NET_BANKING" ? "Net Banking" : m}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <NonFormTextInput
            label="Paid Amount"
            type="number"
            min={0.01}
            step={0.01}
            max={Math.max(
              0,
              Number(
                challan?.dueAmount ??
                  Number(challan?.billAmount || 0) -
                    Number(challan?.totalPaidAmount || 0)
              ) || 0
            )}
            value={String(paidAmount)}
            onChange={(e) => setPaidAmount(Number(e.target.value || 0))}
          />

          {/* Conditional fields */}
          {(paymentMode === "UPI" ||
            paymentMode === "RTGS" ||
            paymentMode === "NEFT") && (
            <NonFormTextInput
              label="UTR Number"
              value={utrNo}
              onChange={(e) => setUtrNo(e.target.value)}
            />
          )}

          {paymentMode === "RTGS" && (
            <>
              <NonFormTextInput
                label="RTGS Date"
                type="date"
                value={rtgsDate}
                onChange={(e) => setRtgsDate(e.target.value)}
              />
              <NonFormTextInput
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </>
          )}

          {paymentMode === "NEFT" && (
            <>
              <NonFormTextInput
                label="NEFT Date"
                type="date"
                value={neftDate}
                onChange={(e) => setNeftDate(e.target.value)}
              />
              <NonFormTextInput
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </>
          )}

          {paymentMode === "CHEQUE" && (
            <>
              <NonFormTextInput
                label="Cheque Number"
                value={chequeNo}
                onChange={(e) => setChequeNo(e.target.value)}
              />
              <NonFormTextInput
                label="Cheque Date"
                type="date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
              <NonFormTextInput
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </>
          )}

          {paymentMode === "NET_BANKING" && (
            <>
              <NonFormTextInput
                label="Transaction Number"
                value={transactionNo}
                onChange={(e) => setTransactionNo(e.target.value)}
              />
              <NonFormTextInput
                label="Transaction Date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
              <NonFormTextInput
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </>
          )}
        </div>
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <AppButton variant="secondary" type="button" onClick={handleCancel}>
          Cancel
        </AppButton>
        <AppButton type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Payment"}
        </AppButton>
      </AppCard.Footer>

      {/* Existing Payments List */}
      <div className="m-6">
        <div className="text-sm font-medium mb-2">Existing Payments</div>
        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            <DataTable
              columns={paymentColumns}
              data={paymentsList as PaymentRow[]}
              loading={false}
              stickyColumns={0}
              renderRowActions={(row: any) =>
                canDeletePayment ? (
                  <AppButton
                    size="icon"
                    variant="destructive"
                    type="button"
                    className="sticky right-0"
                    onClick={async () => {
                      if (!confirm("Delete this payment?")) return;
                      try {
                        await apiDelete(`/api/inward-bill-details/${row.id}`);
                        toast.success("Payment deleted");
                        await Promise.all([mutatePayments(), mutateChallan()]);
                        router.push(`/inward-bills`);
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to delete");
                      }
                    }}
                    aria-label="Delete payment"
                    title="Delete payment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </AppButton>
                ) : null
              }
            />
          </div>
        </div>
      </div>
    </AppCard>
  );
}
