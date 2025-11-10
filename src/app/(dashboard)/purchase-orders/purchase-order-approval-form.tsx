"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { FormSection, FormRow } from "@/components/common/app-form";
import { TextareaInput } from "@/components/common/textarea-input";
import { TextInput } from "@/components/common/text-input";
import { AppSelect } from "@/components/common/app-select";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import { apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";

type PurchaseOrderDetail = {
  id: number;
  serialNo: number;
  itemId: number;
  item: {
    id: number;
    itemCode: string;
    item: string;
    unit: {
      id: number;
      unitName: string;
    };
  };
  remark?: string | null;
  qty: number;
  orderedQty?: number | null;
  approved1Qty?: number | null;
  rate: number;
  discountPercent: number;
  disAmt: number;
  cgstPercent: number;
  cgstAmt: number;
  sgstPercent: number;
  sgstAmt: number;
  igstPercent: number;
  igstAmt: number;
  amount: number;
};

type PurchaseOrder = {
  id: number;
  purchaseOrderNo: string;
  purchaseOrderDate: string;
  deliveryDate: string;
  quotationNo: string;
  quotationDate: string;
  transport?: string | null;
  note?: string | null;
  terms?: string | null;
  deliverySchedule?: string | null;
  poStatus?: string | null;
  amount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  site: {
    id: number;
    site: string;
  };
  vendor: {
    id: number;
    vendorName: string;
  };
  billingAddress: {
    id: number;
    companyName: string;
    city: string;
  };
  paymentTerm?: {
    id: number;
    paymentTerm: string;
  } | null;
  purchaseOrderDetails: PurchaseOrderDetail[];
};

interface PurchaseOrderApprovalFormProps {
  purchaseOrder: PurchaseOrder;
  approvalLevel: 1 | 2;
  onSuccess?: () => void;
}

const approvalItemSchema = z.object({
  id: z.number(),
  itemId: z.number(),
  remark: z.string().optional(),
  approved1Qty: z.coerce
    .number()
    .min(0.0001, "Approved quantity must be greater than 0")
    .max(9999999999.9999, "Approved quantity must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discountPercent: z.coerce
    .number()
    .min(0, "Discount % must be non-negative")
    .max(100, "Discount % must be <= 100")
    .default(0),
  cgstPercent: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .default(0),
  sgstPercent: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .default(0),
  igstPercent: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .default(0),
});

const approvalSchema = z.object({
  note: z.string().optional(),
  transport: z.string().optional(),
  deliverySchedule: z.string().optional(),
  terms: z.string().optional(),
  poStatus: z.enum(["HOLD"]).optional().nullable(),
  transitInsuranceStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  transitInsuranceAmount: z.string().nullable().optional(),
  pfStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  pfCharges: z.string().nullable().optional(),
  gstReverseStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  gstReverseAmount: z.string().nullable().optional(),
  items: z.array(approvalItemSchema).min(1),
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

export default function PurchaseOrderApprovalForm({
  purchaseOrder,
  approvalLevel,
  onSuccess,
}: PurchaseOrderApprovalFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const billingCityName =
    typeof purchaseOrder.billingAddress.city === "object" &&
    purchaseOrder.billingAddress.city !== null
      ? purchaseOrder.billingAddress.city.city
      : (purchaseOrder.billingAddress.city as string | undefined) || "";

  const defaultValues: ApprovalFormData = {
    note: purchaseOrder.note || "",
    transport: purchaseOrder.transport || "",
    deliverySchedule: purchaseOrder.deliverySchedule || "",
    terms: purchaseOrder.terms || "",
    poStatus: (purchaseOrder.poStatus as "HOLD" | null) || null,
    transitInsuranceStatus:
      (purchaseOrder.transitInsuranceStatus as
        | "EXCLUSIVE"
        | "INCLUSIVE"
        | "NOT_APPLICABLE"
        | null) || null,
    transitInsuranceAmount: purchaseOrder.transitInsuranceAmount || null,
    pfStatus:
      (purchaseOrder.pfStatus as
        | "EXCLUSIVE"
        | "INCLUSIVE"
        | "NOT_APPLICABLE"
        | null) || null,
    pfCharges: purchaseOrder.pfCharges || null,
    gstReverseStatus:
      (purchaseOrder.gstReverseStatus as
        | "EXCLUSIVE"
        | "INCLUSIVE"
        | "NOT_APPLICABLE"
        | null) || null,
    gstReverseAmount: purchaseOrder.gstReverseAmount || null,
    items: purchaseOrder.purchaseOrderDetails.map((detail) => ({
      id: detail.id,
      itemId: detail.itemId,
      remark: detail.remark || "",
      approved1Qty: Number(detail.qty) || 0,
      rate: Number(detail.rate) || 0,
      discountPercent: Number(detail.discountPercent) || 0,
      cgstPercent: Number(detail.cgstPercent) || 0,
      sgstPercent: Number(detail.sgstPercent) || 0,
      igstPercent: Number(detail.igstPercent) || 0,
    })),
  };

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues,
  });

  const watchedItems = form.watch("items");
  const watchedPoStatus = form.watch("poStatus");
  const watchedTransitInsuranceStatus = form.watch("transitInsuranceStatus");
  const watchedTransitInsuranceAmount = form.watch("transitInsuranceAmount");
  const watchedPfStatus = form.watch("pfStatus");
  const watchedPfCharges = form.watch("pfCharges");
  const watchedGstReverseStatus = form.watch("gstReverseStatus");
  const watchedGstReverseAmount = form.watch("gstReverseAmount");

  // Calculation helpers
  const toNumber = (value: string | number | undefined | null): number => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const roundTo2 = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return parseFloat(value.toFixed(2));
  };

  const formatAmount = (value: number | undefined | null): string => {
    const amount = Number.isFinite(value as number) ? (value as number) : 0;
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Compute item metrics based on approved quantities and editable fields
  const computedItems = useMemo(() => {
    return watchedItems.map((watchedItem, index) => {
      const detail = purchaseOrder.purchaseOrderDetails[index];
      const approved1Qty = toNumber(watchedItem.approved1Qty);
      const rate = toNumber(watchedItem.rate);
      const discountPercent = toNumber(watchedItem.discountPercent);
      const cgstPercent = toNumber(watchedItem.cgstPercent);
      const sgstPercent = toNumber(watchedItem.sgstPercent);
      const igstPercent = toNumber(watchedItem.igstPercent);

      const baseAmount = approved1Qty * rate;
      const disAmt = roundTo2((baseAmount * discountPercent) / 100);
      const taxableAmount = roundTo2(baseAmount - disAmt);
      const cgstAmt = roundTo2((taxableAmount * cgstPercent) / 100);
      const sgstAmt = roundTo2((taxableAmount * sgstPercent) / 100);
      const igstAmt = roundTo2((taxableAmount * igstPercent) / 100);
      const amount = roundTo2(taxableAmount + cgstAmt + sgstAmt + igstAmt);

      return {
        ...detail,
        approved1Qty,
        rate,
        discountPercent,
        cgstPercent,
        sgstPercent,
        igstPercent,
        disAmt,
        cgstAmt,
        sgstAmt,
        igstAmt,
        amount,
      };
    });
  }, [watchedItems, purchaseOrder.purchaseOrderDetails]);

  // Calculate totals including additional charges
  const totals = useMemo(() => {
    const itemTotals = computedItems.reduce(
      (acc, item) => ({
        amount: roundTo2(acc.amount + item.amount),
        cgstAmt: roundTo2(acc.cgstAmt + item.cgstAmt),
        sgstAmt: roundTo2(acc.sgstAmt + item.sgstAmt),
        igstAmt: roundTo2(acc.igstAmt + item.igstAmt),
        disAmt: roundTo2(acc.disAmt + item.disAmt),
      }),
      {
        amount: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        igstAmt: 0,
        disAmt: 0,
      }
    );

    // Calculate individual additional charges
    const transitInsuranceAmount =
      watchedTransitInsuranceStatus === "EXCLUSIVE"
        ? toNumber(watchedTransitInsuranceAmount)
        : 0;

    const pfAmount =
      watchedPfStatus === "EXCLUSIVE" ? toNumber(watchedPfCharges) : 0;

    const gstReverseAmount =
      watchedGstReverseStatus === "EXCLUSIVE"
        ? toNumber(watchedGstReverseAmount)
        : 0;

    // Calculate final amount
    const finalAmount = roundTo2(
      itemTotals.amount + transitInsuranceAmount + pfAmount + gstReverseAmount
    );

    return {
      ...itemTotals,
      transitInsuranceAmount,
      pfAmount,
      gstReverseAmount,
      finalAmount,
    };
  }, [
    computedItems,
    watchedTransitInsuranceStatus,
    watchedTransitInsuranceAmount,
    watchedPfStatus,
    watchedPfCharges,
    watchedGstReverseStatus,
    watchedGstReverseAmount,
  ]);

  const onSubmit = async (data: ApprovalFormData) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Prepare items with updated approved quantities and editable fields
      const updatedItems = data.items.map((item, index) => {
        const detail = purchaseOrder.purchaseOrderDetails[index];
        const computed = computedItems[index];

        return {
          id: detail.id,
          itemId: item.itemId,
          remark: item.remark?.trim() || null,
          qty: detail.qty,
          orderedQty: detail.qty, // Set orderedQty to original qty
          approved1Qty: item.approved1Qty,
          rate: item.rate,
          discountPercent: item.discountPercent,
          cgstPercent: item.cgstPercent,
          sgstPercent: item.sgstPercent,
          igstPercent: item.igstPercent,
          disAmt: computed.disAmt,
          cgstAmt: computed.cgstAmt,
          sgstAmt: computed.sgstAmt,
          igstAmt: computed.igstAmt,
          amount: computed.amount,
        };
      });

      const payload = {
        note: data.note?.trim() || null,
        transport: data.transport?.trim() || null,
        deliverySchedule: data.deliverySchedule?.trim() || null,
        terms: data.terms?.trim() || null,
        poStatus: data.poStatus,
        transitInsuranceStatus: data.transitInsuranceStatus,
        transitInsuranceAmount: data.transitInsuranceAmount,
        pfStatus: data.pfStatus,
        pfCharges: data.pfCharges,
        gstReverseStatus: data.gstReverseStatus,
        gstReverseAmount: data.gstReverseAmount,
        purchaseOrderItems: updatedItems,
        amount: totals.finalAmount,
        totalCgstAmount: totals.cgstAmt,
        totalSgstAmount: totals.sgstAmt,
        totalIgstAmount: totals.igstAmt,
        statusAction: "approve1",
      };

      await apiPatch(`/api/purchase-orders/${purchaseOrder.id}`, payload);

      toast.success("Purchase order approved successfully");

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/purchase-orders");
      }
    } catch (error: any) {
      console.error("Approval error:", error);
      toast.error(error.message || "Failed to approve purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <AppCard>
          <AppCard.Content>
            {/* Header Information - Read Only */}
            <FormSection legend="Purchase Order Details">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Purchase Order No.
                  </label>
                  <div className="text-base font-semibold">
                    {purchaseOrder.purchaseOrderNo}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Purchase Order Date
                  </label>
                  <div className="text-base">
                    {format(
                      new Date(purchaseOrder.purchaseOrderDate),
                      "dd/MM/yyyy"
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Delivery Date
                  </label>
                  <div className="text-base">
                    {format(new Date(purchaseOrder.deliveryDate), "dd/MM/yyyy")}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quotation No.
                  </label>
                  <div className="text-base">{purchaseOrder.quotationNo}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quotation Date
                  </label>
                  <div className="text-base">
                    {format(
                      new Date(purchaseOrder.quotationDate),
                      "dd/MM/yyyy"
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vendor
                  </label>
                  <div className="text-base">
                    {purchaseOrder.vendor.vendorName}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Site</label>
                  <div className="text-base">{purchaseOrder.site.site}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Billing Address
                  </label>
                  <div className="text-base">
                    {purchaseOrder.billingAddress.companyName}
                    {billingCityName ? `, ${billingCityName}` : ""}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Payment Terms
                  </label>
                  <div className="text-base">
                    {purchaseOrder.paymentTerm?.paymentTerm || "N/A"}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Editable Fields */}
            <FormSection legend="Additional Information">
              <FormRow cols={3}>
                <TextareaInput
                  control={form.control}
                  name="transport"
                  label="Transport"
                  rows={2}
                />
                <TextareaInput
                  control={form.control}
                  name="deliverySchedule"
                  label="Delivery Schedule"
                  rows={2}
                />
                <div>
                  <label className="block text-sm font-medium mb-2">
                    PO Status
                  </label>
                  <AppSelect
                    value={watchedPoStatus || "__none"}
                    onValueChange={(value) => {
                      const next =
                        value === "__none" ? null : (value as "HOLD");
                      form.setValue("poStatus", next);
                    }}
                    placeholder="Select Status"
                  >
                    <AppSelect.Item value="__none">None</AppSelect.Item>
                    <AppSelect.Item value="HOLD">Hold</AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>

              <FormRow cols={2}>
                <TextareaInput
                  control={form.control}
                  name="note"
                  label="Note"
                  rows={3}
                />
                <TextareaInput
                  control={form.control}
                  name="terms"
                  label="Terms & Conditions"
                  rows={3}
                />
              </FormRow>
            </FormSection>

            {/* Items Table */}
            <FormSection legend="Items for Approval">
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ordered Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Disc. %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CGST %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SGST %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IGST %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {purchaseOrder.purchaseOrderDetails.map((detail, index) => (
                      <tr key={detail.id}>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">
                            {detail.item.itemCode
                              ? `${detail.item.itemCode} - ${detail.item.item}`
                              : detail.item.item}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Unit: {detail.item.unit.unitName}
                          </div>
                          <FormField
                            control={form.control}
                            name={`items.${index}.remark`}
                            render={({ field }) => (
                              <FormItem className="mt-2">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Remark"
                                    value={field.value || ""}
                                    className="text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium align-top">
                          {formatAmount(detail.orderedQty ?? detail.qty)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.approved1Qty`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    {...field}
                                    value={field.value?.toString() || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? ""
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-24"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.rate`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    {...field}
                                    value={field.value?.toString() || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? ""
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-28"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.discountPercent`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    {...field}
                                    value={field.value?.toString() || "0"}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? "0"
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-20"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.cgstPercent`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    {...field}
                                    value={field.value?.toString() || "0"}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? "0"
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-20"
                                  />
                                </FormControl>
                                <div className="text-xs text-muted-foreground text-right">
                                  CGST Amt:{" "}
                                  {formatAmount(computedItems[index]?.cgstAmt)}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.sgstPercent`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    {...field}
                                    value={field.value?.toString() || "0"}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? "0"
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-20"
                                  />
                                </FormControl>
                                <div className="text-xs text-muted-foreground text-right">
                                  SGST Amt:{" "}
                                  {formatAmount(computedItems[index]?.sgstAmt)}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`items.${index}.igstPercent`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    {...field}
                                    value={field.value?.toString() || "0"}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ""
                                          ? "0"
                                          : parseFloat(value) || 0
                                      );
                                    }}
                                    className="text-right w-20"
                                  />
                                </FormControl>
                                <div className="text-xs text-muted-foreground text-right">
                                  IGST Amt:{" "}
                                  {formatAmount(computedItems[index]?.igstAmt)}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium align-top">
                          {formatAmount(computedItems[index]?.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100"
                      >
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {formatAmount(totals.amount)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            Transit Insurance
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={watchedTransitInsuranceStatus || "__none"}
                            onValueChange={(value) => {
                              const next =
                                value === "__none"
                                  ? null
                                  : (value as
                                      | "EXCLUSIVE"
                                      | "INCLUSIVE"
                                      | "NOT_APPLICABLE");
                              form.setValue("transitInsuranceStatus", next);
                            }}
                            placeholder="Select Status"
                          >
                            <AppSelect.Item value="__none">None</AppSelect.Item>
                            <AppSelect.Item value="EXCLUSIVE">
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="INCLUSIVE">
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="NOT_APPLICABLE">
                              Not Applicable
                            </AppSelect.Item>
                          </AppSelect>
                          <FormField
                            control={form.control}
                            name="transitInsuranceAmount"
                            render={({ field }) => (
                              <FormItem className="w-40">
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={
                                      field.value === null ||
                                      field.value === undefined
                                        ? ""
                                        : String(field.value)
                                    }
                                    onChange={(event) => {
                                      field.onChange(event.target.value);
                                    }}
                                    type="number"
                                    placeholder="Enter amount"
                                    disabled={
                                      watchedTransitInsuranceStatus !==
                                      "EXCLUSIVE"
                                    }
                                    className="h-9 text-right"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {formatAmount(totals.transitInsuranceAmount || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            Transport Charges
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={watchedPfStatus || "__none"}
                            onValueChange={(value) => {
                              const next =
                                value === "__none"
                                  ? null
                                  : (value as
                                      | "EXCLUSIVE"
                                      | "INCLUSIVE"
                                      | "NOT_APPLICABLE");
                              form.setValue("pfStatus", next);
                            }}
                            placeholder="Select Status"
                          >
                            <AppSelect.Item value="__none">None</AppSelect.Item>
                            <AppSelect.Item value="EXCLUSIVE">
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="INCLUSIVE">
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="NOT_APPLICABLE">
                              Not Applicable
                            </AppSelect.Item>
                          </AppSelect>
                          <FormField
                            control={form.control}
                            name="pfCharges"
                            render={({ field }) => (
                              <FormItem className="w-40">
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={
                                      field.value === null ||
                                      field.value === undefined
                                        ? ""
                                        : String(field.value)
                                    }
                                    onChange={(event) => {
                                      field.onChange(event.target.value);
                                    }}
                                    type="number"
                                    placeholder="Enter amount"
                                    disabled={watchedPfStatus !== "EXCLUSIVE"}
                                    className="h-9 text-right"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {formatAmount(totals.pfAmount || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        Discount
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.disAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-1 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        CGST
                      </td>
                      <td className="px-4 py-1 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.cgstAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-1 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        SGST
                      </td>
                      <td className="px-4 py-1 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.sgstAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-1 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        IGST
                      </td>
                      <td className="px-4 py-1 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.igstAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            GST Reverse Charge
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={watchedGstReverseStatus || "__none"}
                            onValueChange={(value) => {
                              const next =
                                value === "__none"
                                  ? null
                                  : (value as
                                      | "EXCLUSIVE"
                                      | "INCLUSIVE"
                                      | "NOT_APPLICABLE");
                              form.setValue("gstReverseStatus", next);
                            }}
                            placeholder="Select Status"
                          >
                            <AppSelect.Item value="__none">None</AppSelect.Item>
                            <AppSelect.Item value="EXCLUSIVE">
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="INCLUSIVE">
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item value="NOT_APPLICABLE">
                              Not Applicable
                            </AppSelect.Item>
                          </AppSelect>
                          <FormField
                            control={form.control}
                            name="gstReverseAmount"
                            render={({ field }) => (
                              <FormItem className="w-40">
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={
                                      field.value === null ||
                                      field.value === undefined
                                        ? ""
                                        : String(field.value)
                                    }
                                    onChange={(event) => {
                                      field.onChange(event.target.value);
                                    }}
                                    type="number"
                                    placeholder="Enter amount"
                                    disabled={
                                      watchedGstReverseStatus !== "EXCLUSIVE"
                                    }
                                    className="h-9 text-right"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {formatAmount(totals.gstReverseAmount || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={8}
                        className="text-right px-4 py-3 text-base font-bold text-gray-900 dark:text-slate-100 border-t border-gray-200"
                      >
                        Total Amount
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-gray-900 dark:text-slate-100 border-t border-gray-200">
                        {formatAmount(totals.finalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className="justify-end gap-3">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push("/purchase-orders")}
              disabled={isSubmitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName="Check"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="min-w-[180px]"
            >
              Approve Purchase Order
            </AppButton>
          </AppCard.Footer>
        </AppCard>
      </form>
    </Form>
  );
}
