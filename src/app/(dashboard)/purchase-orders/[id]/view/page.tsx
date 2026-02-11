"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

import { AppCard } from "@/components/common/app-card";
import type { PurchaseOrder } from "@/types/purchase-orders";

function prettyStatus(s?: string) {
  switch (s) {
    case "APPROVED_LEVEL_1":
      return "Approved 1";
    case "APPROVED_LEVEL_2":
      return "Approved 2";
    case "COMPLETED":
      return "Completed";
    case "SUSPENDED":
      return "Suspended";
    default:
      return "Draft";
  }
}

function StatusBadge({
  status,
  suspended,
  completed,
}: {
  status?: string;
  suspended?: boolean;
  completed?: boolean;
}) {
  const label = suspended ? "Suspended" : prettyStatus(status);
  const cls = suspended
    ? "bg-rose-600"
    : completed
      ? "bg-emerald-600"
      : status === "APPROVED_LEVEL_1"
        ? "bg-amber-600"
        : status === "APPROVED_LEVEL_2"
          ? "bg-sky-600"
          : "bg-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
    >
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium whitespace-normal break-words">
        {value && value.trim() ? value : "—"}
      </div>
    </div>
  );
}

export default function PurchaseOrderViewPage() {
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string, 10) : null;

  const { data, error, isLoading } = useSWR<PurchaseOrder>(
    id ? `/api/purchase-orders/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load purchase order");
  }

  const header = useMemo(() => {
    if (!data) return null;
    return {
      poNo: data.purchaseOrderNo,
      poDate: data.purchaseOrderDate ? formatDate(data.purchaseOrderDate) : "—",
      deliveryDate: data.deliveryDate ? formatDate(data.deliveryDate) : "—",
      site: data.site?.site ?? "—",
      vendor: data.vendor?.vendorName ?? "—",
      status: data.approvalStatus,
      suspended: !!data.isSuspended,
      completed: !!data.isComplete,
    };
  }, [data]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl space-y-4">
        <AppCard>
          <AppCard.Header>
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <AppCard.Title className="whitespace-normal break-words">
                  Purchase Order
                </AppCard.Title>
                <AppCard.Description className="whitespace-normal break-words">
                  {header?.poNo ?? ""}
                </AppCard.Description>
              </div>
              <div className="shrink-0">
                <StatusBadge
                  status={header?.status}
                  suspended={header?.suspended}
                  completed={header?.completed}
                />
              </div>
            </div>
          </AppCard.Header>

          <AppCard.Content>
            {isLoading || !data ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="PO No" value={data.purchaseOrderNo} />
                  <Field label="PO Date" value={header?.poDate ?? "—"} />
                  <Field
                    label="Delivery Date"
                    value={header?.deliveryDate ?? "—"}
                  />
                  <Field label="Site" value={data.site?.site ?? "—"} />
                  <Field label="Vendor" value={data.vendor?.vendorName ?? "—"} />
                  <Field label="Quotation No" value={data.quotationNo ?? "—"} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Billing Address</div>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {data.billingAddress?.companyName ?? "—"}
                      {data.billingAddress?.addressLine1
                        ? `\n${data.billingAddress.addressLine1}`
                        : ""}
                      {data.billingAddress?.addressLine2
                        ? `\n${data.billingAddress.addressLine2}`
                        : ""}
                      {data.billingAddress?.city?.city
                        ? `\n${data.billingAddress.city.city}`
                        : ""}
                      {data.billingAddress?.pincode
                        ? ` - ${data.billingAddress.pincode}`
                        : ""}
                      {data.billingAddress?.gstNumber
                        ? `\nGST: ${data.billingAddress.gstNumber}`
                        : ""}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Delivery Address</div>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {data.siteDeliveryAddress?.addressLine1 ?? "—"}
                      {data.siteDeliveryAddress?.addressLine2
                        ? `\n${data.siteDeliveryAddress.addressLine2}`
                        : ""}
                      {(data.siteDeliveryAddress as any)?.city?.city
                        ? `\n${(data.siteDeliveryAddress as any).city.city}`
                        : ""}
                      {(data.siteDeliveryAddress as any)?.state?.state
                        ? `\n${(data.siteDeliveryAddress as any).state.state}`
                        : ""}
                      {data.siteDeliveryAddress?.pinCode
                        ? ` - ${data.siteDeliveryAddress.pinCode}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Note</div>
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
                    {data.note?.trim() ? data.note : "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Terms</div>
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
                    {data.terms?.trim() ? data.terms : "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Items</div>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-3 text-left w-[64px]">S.No</th>
                          <th className="p-3 text-left">Item</th>
                          <th className="p-3 text-left w-[120px]">Unit</th>
                          <th className="p-3 text-right w-[120px]">Qty</th>
                          <th className="p-3 text-right w-[120px]">Rate</th>
                          <th className="p-3 text-right w-[140px]">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.purchaseOrderDetails || []).map((d: any) => (
                          <tr key={d.id} className="border-t align-top">
                            <td className="p-3 whitespace-nowrap">
                              {d.serialNo ?? "—"}
                            </td>
                            <td className="p-3">
                              <div className="whitespace-normal break-words">
                                {d.item?.item ?? "—"}
                              </div>
                              {d.item?.itemCode ? (
                                <div className="text-xs text-muted-foreground whitespace-normal break-words">
                                  {d.item.itemCode}
                                </div>
                              ) : null}
                              {d.remark ? (
                                <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-1">
                                  {d.remark}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-3 whitespace-normal break-words">
                              {d.item?.unit?.unitName ?? "—"}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {typeof d.qty === "number" ? d.qty.toFixed(4) : d.qty ?? "—"}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {typeof d.rate === "number" ? d.rate.toFixed(3) : d.rate ?? "—"}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {typeof d.amount === "number" ? d.amount.toFixed(2) : d.amount ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field
                    label="Total CGST"
                    value={
                      typeof (data as any).totalCgstAmount === "number"
                        ? (data as any).totalCgstAmount.toFixed(2)
                        : String((data as any).totalCgstAmount ?? "—")
                    }
                  />
                  <Field
                    label="Total SGST"
                    value={
                      typeof (data as any).totalSgstAmount === "number"
                        ? (data as any).totalSgstAmount.toFixed(2)
                        : String((data as any).totalSgstAmount ?? "—")
                    }
                  />
                  <Field
                    label="Total IGST"
                    value={
                      typeof (data as any).totalIgstAmount === "number"
                        ? (data as any).totalIgstAmount.toFixed(2)
                        : String((data as any).totalIgstAmount ?? "—")
                    }
                  />
                </div>

                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Grand Total</div>
                    <div className="text-lg font-bold whitespace-nowrap">
                      {typeof data.amount === "number" ? data.amount.toFixed(2) : data.amount}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {(data as any).amountInWords
                      ? String((data as any).amountInWords)
                      : ""}
                  </div>
                </div>
              </div>
            )}
          </AppCard.Content>
        </AppCard>
      </div>
    </div>
  );
}
