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

function FieldAny({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium whitespace-normal break-words">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </div>
    </div>
  );
}

function formatMoney(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatAddressLine(addr?: any) {
  if (!addr) return "—";
  const parts = [
    addr.addressLine1,
    addr.addressLine2,
    addr.city?.city,
    addr.state?.state,
    addr.pincode,
    addr.pinCode,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(", ") || addr.companyName || "—";
}

export default function WorkOrderViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? parseInt(params?.id as string, 10) : null;

  const { data, error, isLoading } = useSWR<any>(
    id ? `/api/work-orders/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load work order");
  }

  const header = useMemo(() => {
    if (!data) return null;
    return {
      woNo: data.workOrderNo ?? "—",
      woDate: formatDateMaybe(data.workOrderDate),
      deliveryDate: formatDateMaybe(data.deliveryDate),
      vendor: data.vendor?.vendorName ?? "—",
      site: data.site?.site ?? "—",
      status: prettyStatus(data.approvalStatus),
      createdAt: data.createdAt ? formatDateTime(data.createdAt) : "—",
      updatedAt: data.updatedAt ? formatDateTime(data.updatedAt) : "—",
    };
  }, [data]);

  return (
    <div className="print:p-8">
      <AppCard className="print:shadow-none print:border-0">
        <AppCard.Header className="print:pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AppCard.Title>Work Order View</AppCard.Title>
              <AppCard.Description className="whitespace-normal break-words">
                {header?.woNo ?? ""}
              </AppCard.Description>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="text-sm font-medium">{header?.status ?? "—"}</div>
              </div>

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
              <FormSection legend="Work Order Details">
                <FormRow cols={3}>
                  <FieldAny label="WO No." value={data.workOrderNo} />
                  <FieldAny label="WO Date" value={formatDateMaybe(data.workOrderDate)} />
                  <FieldAny
                    label="Delivery Date"
                    value={formatDateMaybe(data.deliveryDate)}
                  />
                </FormRow>

                <FormRow cols={3}>
                  <FieldAny label="Site" value={data.site?.site} />
                  <FieldAny label="Purchase Order" value={data.purchaseOrder?.purchaseOrderNo} />
                  <FieldAny label="BOQ" value={data.boq?.boqName ?? data.boq?.boqNo} />
                </FormRow>

                <FormRow cols={3}>
                  <FieldAny label="Type" value={data.type} />
                  <FieldAny label="WO Status" value={data.woStatus ?? "—"} />
                </FormRow>
              </FormSection>

              <FormSection legend="Vendor & Billing">
                <FormRow cols={3}>
                  <FieldAny label="Vendor" value={data.vendor?.vendorName} />
                  <FieldAny label="Billing Address" value={formatAddressLine(data.billingAddress)} />
                  <FieldAny
                    label="Delivery Address"
                    value={formatAddressLine(data.siteDeliveryAddress)}
                  />
                </FormRow>

                <FormRow cols={3}>
                  <FieldAny
                    label="Payment Terms"
                    value={Array.isArray(data.WOPaymentTerms)
                      ? data.WOPaymentTerms.map((t: any) => t.paymentTerm?.paymentTerm).filter(Boolean).join(", ")
                      : "—"}
                  />
                  <FieldAny label="Quotation No." value={data.quotationNo} />
                  <FieldAny
                    label="Quotation Date"
                    value={formatDateMaybe(data.quotationDate)}
                  />
                </FormRow>
              </FormSection>

              <FormSection legend="Logistics & Terms">
                <FormRow cols={3}>
                  <FieldAny label="Transport" value={data.transport} />
                  <FieldAny
                    label="Payment Terms (Days)"
                    value={data.paymentTermsInDays ?? "—"}
                  />
                  <FieldAny label="Amount" value={formatMoney(data.amount)} />
                </FormRow>

                <FormRow cols={3}>
                  <FieldAny label="Delivery Schedule" value={data.deliverySchedule} />
                </FormRow>
              </FormSection>

              <FormSection legend="Items">
                <div className="w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <th className="text-left p-2">Sr</th>
                        <th className="text-left p-2">Item</th>
                        <th className="text-left p-2">Unit</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Rate</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.workOrderDetails ?? []).map((d: any, idx: number) => (
                        <tr key={d.id ?? idx} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="p-2">{d.serialNo ?? idx + 1}</td>
                          <td className="p-2 whitespace-normal break-words">{d.Item ?? "—"}</td>
                          <td className="p-2">{d.unit?.unitName ?? "—"}</td>
                          <td className="p-2 text-right">{d.qty ?? "—"}</td>
                          <td className="p-2 text-right">{d.rate ?? "—"}</td>
                          <td className="p-2 text-right">{formatMoney(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FormSection>

              <FormSection legend="Meta">
                <FormRow cols={3}>
                  <FieldAny label="Created By" value={data.createdBy?.name} />
                  <FieldAny label="Approved 1 By" value={data.approved1By?.name} />
                  <FieldAny label="Approved 2 By" value={data.approved2By?.name} />
                </FormRow>
                <FormRow cols={3}>
                  <FieldAny label="Created At" value={header?.createdAt} />
                  <FieldAny label="Updated At" value={header?.updatedAt} />
                </FormRow>
              </FormSection>
            </>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
