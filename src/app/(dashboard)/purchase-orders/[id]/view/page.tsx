"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatDateDMY, formatDateTime } from "@/lib/locales";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { FormRow, FormSection } from "@/components/common/app-form";
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

function formatDateMaybe(v?: string | Date | null) {
  if (!v) return "—";
  try {
    return formatDateDMY(v);
  } catch {
    return "—";
  }
}

function FieldAny({
  label,
  value,
}: {
  label: string;
  value?: unknown;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium whitespace-normal break-words">
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </div>
    </div>
  );
}

function prettyPOStatus(s?: string | null) {
  switch ((s || "OPEN").toUpperCase()) {
    case "ORDER_PLACED":
      return "Order Placed";
    case "IN_TRANSIT":
      return "In Transit";
    case "RECEIVED":
      return "Received";
    case "HOLD":
      return "Hold";
    default:
      return "Open";
  }
}

function POStatusBadge({ status }: { status?: string | null }) {
  const value = (status || "OPEN").toUpperCase();
  const cls =
    value === "HOLD"
      ? "bg-rose-600"
      : value === "RECEIVED"
        ? "bg-emerald-600"
        : value === "IN_TRANSIT"
          ? "bg-sky-600"
          : value === "ORDER_PLACED"
            ? "bg-amber-600"
            : "bg-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
    >
      {prettyPOStatus(value)}
    </span>
  );
}

function StatusBadge({
  status,
  suspended,
}: {
  status?: string;
  suspended?: boolean;
}) {
  const label = suspended ? "Suspended" : prettyStatus(status);
  const cls = suspended
    ? "bg-rose-600"
    : status === "APPROVED_LEVEL_1"
      ? "bg-amber-600"
      : status === "APPROVED_LEVEL_2"
        ? "bg-sky-600"
        : status === "COMPLETED"
          ? "bg-emerald-600"
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
  const router = useRouter();
  const id = params?.id ? parseInt(params.id as string, 10) : null;

  const { data, error, isLoading } = useSWR<PurchaseOrder>(
    id ? `/api/purchase-orders/${id}` : null,
    apiGet
  );

  async function handlePrint() {
    if (!data) return;
    try {
      const res = await fetch(`/api/purchase-orders/${data.id}/print`);
      if (!res.ok) {
        throw new Error("Failed to download purchase order PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `purchase-order-${data.purchaseOrderNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Failed to download purchase order PDF");
    }
  }

  if (error) {
    toast.error((error as Error).message || "Failed to load purchase order");
  }

  const header = useMemo(() => {
    if (!data) return null;
    return {
      poNo: data.purchaseOrderNo,
      poDate: data.purchaseOrderDate
        ? formatDateDMY(data.purchaseOrderDate)
        : "—",
      deliveryDate: data.deliveryDate ? formatDateDMY(data.deliveryDate) : "—",
      site: data.site?.site ?? "—",
      vendor: data.vendor?.vendorName ?? "—",
      status: data.approvalStatus,
      suspended: !!data.isSuspended,
      poStatus: (data as any).poStatus as string | null | undefined,
    };
  }, [data]);

  const paymentTermsDisplay = useMemo(() => {
    if (!data) return "—";
    const joined = Array.isArray((data as any).poPaymentTerms)
      ? (((data as any).poPaymentTerms as any[])
          .map((pt) =>
            String(
              pt?.paymentTerm?.description || pt?.paymentTerm?.paymentTerm || ""
            ).trim()
          )
          .filter((t) => t))
      : [];

    const primary = String((data as any).paymentTerm?.paymentTerm || "").trim();
    const combined = joined.length > 0 ? joined : primary ? [primary] : [];
    return combined.length > 0 ? combined.join(", ") : "—";
  }, [data]);

  return (
    <div className="print:p-8">
      <AppCard className="print:shadow-none print:border-0">
        <AppCard.Header className="print:pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AppCard.Title>Purchase Order View</AppCard.Title>
              <AppCard.Description className="whitespace-normal break-words">
                {header?.poNo ?? ""}
              </AppCard.Description>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Status</div>
                <StatusBadge
                  status={header?.status}
                  suspended={header?.suspended}
                />
              </div>

              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">PO Status</div>
                <POStatusBadge status={header?.poStatus ?? null} />
              </div>

              <AppButton
                onClick={handlePrint}
                className="print:hidden"
                variant="secondary"
                iconName="Printer"
                disabled={isLoading || !data}
              >
                Print
              </AppButton>

              <AppButton
                onClick={() => router.back()}
                className="print:hidden"
                variant="secondary"
                iconName="ArrowLeft"
              >
                Back
              </AppButton>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {isLoading || !data ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <FormSection legend="Purchase Order Details">
                <FormRow cols={3}>
                  <Field label="PO No." value={data.purchaseOrderNo ?? "—"} />
                  <Field label="PO Date" value={header?.poDate ?? "—"} />
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Approval Status</div>
                    <div className="text-sm font-medium whitespace-normal break-words">
                      <StatusBadge
                        status={header?.status}
                        suspended={header?.suspended}
                      />
                    </div>
                  </div>
                  <Field label="Delivery Date" value={header?.deliveryDate ?? "—"} />
                  <Field label="Site" value={data.site?.site ?? "—"} />
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-muted-foreground">PO Status</div>
                    <div className="text-sm font-medium whitespace-normal break-words">
                      <POStatusBadge status={header?.poStatus ?? null} />
                    </div>
                  </div>
                </FormRow>
              </FormSection>

              <FormSection legend="Vendor & Billing">
                <FormRow cols={3}>
                  <Field label="Vendor" value={data.vendor?.vendorName ?? "—"} />
                  <Field label="Payment Terms" value={paymentTermsDisplay} />
                  <Field
                    label="Payment Terms (Days)"
                    value={
                      (data as any).paymentTermsInDays === null ||
                      (data as any).paymentTermsInDays === undefined
                        ? "—"
                        : String((data as any).paymentTermsInDays)
                    }
                  />
                </FormRow>

                <FormRow cols={2}>
                  <div className="space-y-3 min-w-0">
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

                  <div className="space-y-3 min-w-0">
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
                </FormRow>
              </FormSection>

              <FormSection legend="Other Details">
                <FormRow cols={3}>
                  <Field label="Quotation Number" value={data.quotationNo ?? "—"} />
                  <Field
                    label="Quotation Date"
                    value={formatDateMaybe((data as any).quotationDate ?? null)}
                  />
                  <Field label="Transport" value={(data as any).transport ?? "—"} />
                  <Field
                    label="Delivery Schedule"
                    value={(data as any).deliverySchedule ?? "—"}
                  />
                  <Field label="Bill Status" value={(data as any).billStatus ?? "—"} />
                  <FieldAny label="Remarks" value={(data as any).remarks ?? "—"} />
                </FormRow>
              </FormSection>

              <FormSection legend="Notes">
                <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
                  {data.note?.trim() ? data.note : "—"}
                </div>
              </FormSection>

              <FormSection legend="Items">
                <div className="w-full overflow-x-hidden rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <table className="w-full table-fixed border-collapse bg-transparent text-[11px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left w-[56px]">
                          S.No
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left">
                          Item
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left hidden md:table-cell">
                          Unit
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right">
                          Qty
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right hidden lg:table-cell">
                          Appr 1
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right hidden lg:table-cell">
                          Appr 2
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right hidden xl:table-cell">
                          Received
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right">
                          Rate
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right hidden xl:table-cell">
                          Disc
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right hidden 2xl:table-cell">
                          Taxes
                        </th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.purchaseOrderDetails || []).map((d: any, idx: number) => (
                        <tr
                          key={d.id}
                          className={
                            idx % 2 === 0
                              ? "bg-slate-50/60 dark:bg-slate-950/30 hover:bg-sky-50/60 dark:hover:bg-slate-800/40"
                              : "bg-white dark:bg-slate-900 hover:bg-sky-50/60 dark:hover:bg-slate-800/40"
                          }
                        >
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 align-top">
                            {d.serialNo ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 align-top min-w-0">
                            <div className="font-medium whitespace-normal break-words">
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
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 align-top hidden md:table-cell whitespace-normal break-words">
                            {d.item?.unit?.unitName ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top">
                            {typeof d.qty === "number" ? d.qty.toFixed(2) : d.qty ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top hidden lg:table-cell">
                            {typeof d.approved1Qty === "number"
                              ? d.approved1Qty.toFixed(2)
                              : d.approved1Qty ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top hidden lg:table-cell">
                            {typeof d.approved2Qty === "number"
                              ? d.approved2Qty.toFixed(2)
                              : d.approved2Qty ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top hidden xl:table-cell">
                            {typeof d.receivedQty === "number"
                              ? d.receivedQty.toFixed(2)
                              : d.receivedQty ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top">
                            {typeof d.rate === "number" ? d.rate.toFixed(2) : d.rate ?? "—"}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top hidden xl:table-cell">
                            <div>
                              {typeof d.discountPercent === "number"
                                ? d.discountPercent.toFixed(2)
                                : d.discountPercent ?? "—"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {typeof d.disAmt === "number"
                                ? d.disAmt.toFixed(2)
                                : d.disAmt ?? "—"}
                            </div>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top hidden 2xl:table-cell">
                            <div className="text-[10px]">
                              CGST {typeof d.cgstPercent === "number" ? d.cgstPercent.toFixed(2) : d.cgstPercent ?? "—"}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {typeof d.cgstAmt === "number" ? d.cgstAmt.toFixed(2) : d.cgstAmt ?? "—"}
                            </div>
                            <div className="mt-1 text-[10px]">
                              SGST {typeof d.sgstPercent === "number" ? d.sgstPercent.toFixed(2) : d.sgstPercent ?? "—"}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {typeof d.sgstAmt === "number" ? d.sgstAmt.toFixed(2) : d.sgstAmt ?? "—"}
                            </div>
                            <div className="mt-1 text-[10px]">
                              IGST {typeof d.igstPercent === "number" ? d.igstPercent.toFixed(2) : d.igstPercent ?? "—"}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {typeof d.igstAmt === "number" ? d.igstAmt.toFixed(2) : d.igstAmt ?? "—"}
                            </div>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right align-top">
                            {typeof d.amount === "number"
                              ? d.amount.toFixed(2)
                              : d.amount ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FormSection>

                <div className="space-y-3">
                <h3 className="font-semibold text-lg dark:text-white">
                  Approval Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg print:border print:border-gray-300">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Created
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {(data as any).createdBy?.name || "—"}</div>
                      <div>
                        Date: {data.createdAt ? formatDateTime(data.createdAt) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 dark:border dark:border-blue-800 rounded-lg print:border print:border-blue-200">
                    <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      First Approval
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {(data as any).approved1By?.name || "—"}</div>
                      <div>
                        Date:{" "}
                        {(data as any).approved1At
                          ? formatDateTime((data as any).approved1At)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-900/20 dark:border dark:border-green-800 rounded-lg print:border print:border-green-200">
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Second Approval
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {(data as any).approved2By?.name || "—"}</div>
                      <div>
                        Date:{" "}
                        {(data as any).approved2At
                          ? formatDateTime((data as any).approved2At)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 dark:border dark:border-rose-800 rounded-lg print:border print:border-rose-200">
                    <div className="text-sm text-rose-600 dark:text-rose-400 font-medium">
                      Suspended
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {(data as any).suspendedBy?.name || "—"}</div>
                      <div>
                        Date:{" "}
                        {(data as any).suspendedAt
                          ? formatDateTime((data as any).suspendedAt)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 dark:border dark:border-emerald-800 rounded-lg print:border print:border-emerald-200">
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      Completed
                    </div>
                    <div className="mt-1 text-sm dark:text-gray-300">
                      <div>By: {(data as any).completedBy?.name || "—"}</div>
                      <div>
                        Date:{" "}
                        {(data as any).completedAt
                          ? formatDateTime((data as any).completedAt)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
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
            </>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
