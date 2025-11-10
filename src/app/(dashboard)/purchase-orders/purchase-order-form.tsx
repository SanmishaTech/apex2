"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import type { Resolver, DeepPartial } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { FormSection, FormRow } from "@/components/common/app-form";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { Plus, Trash2 } from "lucide-react";
// import { formatCurrency } from "@/lib/format";

type Site = {
  id: number;
  site: string;
};

type SiteDeliveryAddress = {
  id: number;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: {
    id: number;
    city: string;
  } | null;
  state?: {
    id: number;
    state: string;
  } | null;
  pinCode?: string | null;
};

type Vendor = {
  id: number;
  vendorName: string;
};

type BillingAddress = {
  id: number;
  companyName: string;
  city: string;
};

type PaymentTerm = {
  id: number;
  paymentTerm: string;
  description: string;
};

type Item = {
  id: number;
  itemCode: string;
  item: string;
  unit: {
    id: number;
    unitName: string;
  };
};

type PurchaseOrderItem = {
  id?: number;
  itemId: number;
  item?: Item;
  remark?: string;
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

type PurchaseOrderFormInitialData = {
  id?: number;
  purchaseOrderNo?: string;
  purchaseOrderDate?: string;
  deliveryDate?: string;
  siteId?: number | null;
  vendorId?: number | null;
  billingAddressId?: number | null;
  siteDeliveryAddressId?: number | null;
  paymentTermId?: number | null;
  quotationNo?: string;
  quotationDate?: string;
  transport?: string | null;
  note?: string | null;
  terms?: string | null;
  poStatus?: "HOLD" | null;
  paymentTermsInDays?: number | null;
  deliverySchedule?: string | null;
  transitInsuranceStatus?: "EXCLUSIVE" | "INCLUSIVE" | "NOT_APPLICABLE" | null;
  transitInsuranceAmount?: string | null;
  pfStatus?: "EXCLUSIVE" | "INCLUSIVE" | "NOT_APPLICABLE" | null;
  pfCharges?: string | null;
  gstReverseStatus?: "EXCLUSIVE" | "INCLUSIVE" | "NOT_APPLICABLE" | null;
  gstReverseAmount?: string | null;
  purchaseOrderItems?: PurchaseOrderItem[];
};

export interface PurchaseOrderFormProps {
  mode: "create" | "edit" | "approval1" | "approval2";
  initial?: PurchaseOrderFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/purchase-orders'
}

const purchaseOrderItemSchema = z.object({
  itemId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Item is required"
    )
    .transform((val) => parseInt(val)),
  remark: z.string().optional(),
  qty: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(z.number().min(0.0001, "Quantity must be greater than 0")),
  approved1Qty: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(z.number().min(0.0001, "Approved quantity must be greater than 0"))
    .optional(),
  rate: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(z.number().min(0, "Rate must be non-negative")),
  discountPercent: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(
      z
        .number()
        .min(0, "Discount % must be non-negative")
        .max(100, "Discount % must be <= 100")
    ),
  cgstPercent: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(
      z
        .number()
        .min(0, "CGST % must be non-negative")
        .max(100, "CGST % must be <= 100")
    ),
  sgstPercent: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(
      z
        .number()
        .min(0, "SGST % must be non-negative")
        .max(100, "SGST % must be <= 100")
    ),
  igstPercent: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val))
    .pipe(
      z
        .number()
        .min(0, "IGST % must be non-negative")
        .max(100, "IGST % must be <= 100")
    ),
});

const createInputSchema = z.object({
  purchaseOrderDate: z.string().min(1, "PO date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  siteId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Site is required"
    )
    .transform((val) => parseInt(val)),
  vendorId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Vendor is required"
    )
    .transform((val) => parseInt(val)),
  billingAddressId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Billing address is required"
    )
    .transform((val) => parseInt(val)),
  siteDeliveryAddressId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Delivery address is required"
    )
    .transform((val) => parseInt(val)),
  paymentTermId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (!val || val === "__none" || val === "") return undefined;
      return typeof val === "string" ? parseInt(val) : val;
    }),
  quotationNo: z.string().min(1, "Quotation No. is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().optional(),
  poStatus: z.union([z.literal("HOLD"), z.null()]).optional(),
  paymentTermsInDays: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (!val || val === "") return undefined;
      return typeof val === "string" ? parseInt(val) : val;
    }),
  deliverySchedule: z.string().optional(),
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
  purchaseOrderItems: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one item is required"),
});

// Update the FormData type to match your schema
type FormData = z.infer<typeof createInputSchema> & {
  purchaseOrderNo?: string;
};
export function PurchaseOrderForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/purchase-orders",
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mode flags
  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isApproval1 = mode === "approval1";
  const isApproval2 = mode === "approval2";
  const isApprovalMode = isApproval1 || isApproval2;
  const isReadOnly = isApprovalMode;

  type ApiListResponse<T> = {
    data: T[];
  };

  // Fetch data for dropdowns using shared API client
  const { data: sitesData } = useSWR<ApiListResponse<Site>>(
    "/api/sites?perPage=1000",
    apiGet
  );

  const { data: vendorsData } = useSWR<ApiListResponse<Vendor>>(
    "/api/vendors?perPage=1000",
    apiGet
  );

  const { data: billingAddressesData } = useSWR<
    ApiListResponse<BillingAddress>
  >("/api/billing-addresses?perPage=1000", apiGet);

  const { data: paymentTermsData } = useSWR<ApiListResponse<PaymentTerm>>(
    "/api/payment-terms?perPage=1000",
    apiGet
  );

  const { data: itemsData } = useSWR<ApiListResponse<Item>>(
    "/api/items?perPage=1000&include=unit",
    apiGet
  );

  // Initialize form with proper types
  const defaultValues: DeepPartial<FormData> = {
    purchaseOrderNo: initial?.purchaseOrderNo || "",
    purchaseOrderDate:
      initial?.purchaseOrderDate || format(new Date(), "yyyy-MM-dd"),
    deliveryDate: initial?.deliveryDate || "",
    siteId: initial?.siteId ?? 0,
    vendorId: initial?.vendorId ?? 0,
    billingAddressId: initial?.billingAddressId ?? 0,
    siteDeliveryAddressId: initial?.siteDeliveryAddressId ?? 0,
    paymentTermId: initial?.paymentTermId ?? 0,
    quotationNo: initial?.quotationNo || "",
    quotationDate: initial?.quotationDate || format(new Date(), "yyyy-MM-dd"),
    transport: initial?.transport || "",
    note: initial?.note || "",
    terms: initial?.terms || "",
    poStatus: initial?.poStatus ?? null,
    paymentTermsInDays: initial?.paymentTermsInDays ?? 0,
    deliverySchedule: initial?.deliverySchedule || "",
    transitInsuranceStatus: initial?.transitInsuranceStatus ?? null,
    transitInsuranceAmount: initial?.transitInsuranceAmount ?? null,
    pfStatus: initial?.pfStatus ?? null,
    pfCharges: initial?.pfCharges ?? null,
    gstReverseStatus: initial?.gstReverseStatus ?? null,
    gstReverseAmount: initial?.gstReverseAmount ?? null,
    purchaseOrderItems: initial?.purchaseOrderItems?.map((item) => ({
      ...item,
      approved1Qty: isApprovalMode
        ? item.approved1Qty ?? item.qty
        : item.approved1Qty,
      disAmt: item.disAmt || 0,
      cgstAmt: item.cgstAmt || 0,
      sgstAmt: item.sgstAmt || 0,
      igstAmt: item.igstAmt || 0,
      amount: item.amount || 0,
    })) || [
      {
        itemId: 0,
        qty: 1,
        rate: 0,
        discountPercent: 0,
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0,
        amount: 0,
        disAmt: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        igstAmt: 0,
      },
    ],
  };

  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema) as unknown as Resolver<FormData>,
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "purchaseOrderItems",
    keyName: "fieldId",
  });

  const siteValue = form.watch("siteId");
  const items = form.watch("purchaseOrderItems");
  const vendorValue = form.watch("vendorId");
  const billingAddressValue = form.watch("billingAddressId");
  const siteDeliveryAddressValue = form.watch("siteDeliveryAddressId");
  const paymentTermValue = form.watch("paymentTermId");
  const poStatusValue = form.watch("poStatus");
  const transitInsuranceStatus = form.watch("transitInsuranceStatus");
  const transitInsuranceAmount = form.watch("transitInsuranceAmount");
  const pfStatus = form.watch("pfStatus");
  const pfCharges = form.watch("pfCharges");
  const gstReverseStatus = form.watch("gstReverseStatus");
  const gstReverseAmount = form.watch("gstReverseAmount");
  const { errors } = form.formState;

  const { data: siteDetailData } = useSWR<
    (Site & { siteDeliveryAddresses?: SiteDeliveryAddress[] }) | null
  >(
    siteValue && siteValue > 0 ? `/api/sites/${siteValue}` : null,
    siteValue && siteValue > 0 ? apiGet : null
  );

  const sites = sitesData?.data ?? [];
  const vendors = vendorsData?.data ?? [];
  const billingAddresses = billingAddressesData?.data ?? [];
  const siteDeliveryAddresses = siteDetailData?.siteDeliveryAddresses ?? [];
  const paymentTerms = paymentTermsData?.data ?? [];
  const itemOptions = itemsData?.data ?? [];

  type PurchaseOrderItemFormValue = FormData["purchaseOrderItems"][number];

  const toNumber = (value: string | number | undefined): number => {
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
    if (!Number.isFinite(value)) {
      return 0;
    }

    return parseFloat(value.toFixed(2));
  };

  const formatAmount = (value: number | undefined | null): string => {
    const amount = Number.isFinite(value as number) ? (value as number) : 0;
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const computeItemMetrics = (item: PurchaseOrderItemFormValue) => {
    // In approval mode, use approved1Qty for calculations, otherwise use qty
    const qty = isApprovalMode
      ? toNumber(item.approved1Qty)
      : toNumber(item.qty);
    const rate = toNumber(item.rate);
    const discountPercent = toNumber(item.discountPercent);
    const cgstPercent = toNumber(item.cgstPercent);
    const sgstPercent = toNumber(item.sgstPercent);
    const igstPercent = toNumber(item.igstPercent);

    const baseAmount = qty * rate;
    const disAmt = roundTo2((baseAmount * discountPercent) / 100);
    const taxableAmount = roundTo2(baseAmount - disAmt);
    const cgstAmt = roundTo2((taxableAmount * cgstPercent) / 100);
    const sgstAmt = roundTo2((taxableAmount * sgstPercent) / 100);
    const igstAmt = roundTo2((taxableAmount * igstPercent) / 100);
    const amount = roundTo2(taxableAmount + cgstAmt + sgstAmt + igstAmt);

    return {
      qty,
      rate,
      discountPercent,
      cgstPercent,
      sgstPercent,
      igstPercent,
      disAmt,
      taxableAmount,
      cgstAmt,
      sgstAmt,
      igstAmt,
      amount,
    };
  };

  const computedItems = items.map((item) => computeItemMetrics(item));

  // Calculate totals with proper type safety and number formatting
  const itemTotals = computedItems.reduce(
    (acc, item) => ({
      amount: roundTo2(acc.amount + item.amount),
      cgstAmt: roundTo2(acc.cgstAmt + item.cgstAmt),
      sgstAmt: roundTo2(acc.sgstAmt + item.sgstAmt),
      igstAmt: roundTo2(acc.igstAmt + item.igstAmt),
      disAmt: roundTo2(acc.disAmt + item.disAmt),
      taxableAmount: roundTo2(acc.taxableAmount + item.taxableAmount),
    }),
    {
      amount: 0,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 0,
      disAmt: 0,
      taxableAmount: 0,
    }
  );

  // Calculate additional charges to add to total
  const transitInsuranceNumericAmount =
    transitInsuranceStatus === null && transitInsuranceAmount
      ? toNumber(transitInsuranceAmount)
      : 0;

  const pfChargesNumericAmount =
    pfStatus === null && pfCharges ? toNumber(pfCharges) : 0;

  const gstReverseNumericAmount =
    gstReverseStatus === null && gstReverseAmount
      ? toNumber(gstReverseAmount)
      : 0;

  // Final totals including all additional charges
  const totals = {
    ...itemTotals,
    transitInsuranceAmount: transitInsuranceNumericAmount,
    pfChargesAmount: pfChargesNumericAmount,
    gstReverseAmount: gstReverseNumericAmount,
    amount: roundTo2(
      itemTotals.amount +
        transitInsuranceNumericAmount +
        pfChargesNumericAmount +
        gstReverseNumericAmount
    ),
  };

  // Handle vendor change to update billing addresses
  // Add a new empty item row
  const addItem = () => {
    append({
      itemId: 0,
      qty: 1,
      rate: 0,
      discountPercent: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      amount: 0,
      disAmt: 0,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 0,
    });
  };

  // Remove an item row
  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Prepare the payload
      const normalizedItems = data.purchaseOrderItems.map((item, index) => {
        const metrics = computeItemMetrics(item);
        const originalItem = initial?.purchaseOrderItems?.[index];

        const baseItem = {
          itemId: Number(item.itemId),
          remark: item.remark?.trim() ? item.remark.trim() : null,
          qty: isApprovalMode ? originalItem?.qty ?? item.qty : metrics.qty,
          rate: metrics.rate,
          discountPercent: metrics.discountPercent,
          cgstPercent: metrics.cgstPercent,
          sgstPercent: metrics.sgstPercent,
          igstPercent: metrics.igstPercent,
          disAmt: metrics.disAmt,
          cgstAmt: metrics.cgstAmt,
          sgstAmt: metrics.sgstAmt,
          igstAmt: metrics.igstAmt,
          amount: metrics.amount,
        };

        // Add approval-specific fields
        if (isApprovalMode) {
          return {
            ...baseItem,
            id: originalItem?.id,
            orderedQty: originalItem?.qty ?? item.qty,
            approved1Qty: item.approved1Qty,
          };
        }

        return baseItem;
      });

      const headerTotals = normalizedItems.reduce(
        (acc, item) => ({
          amount: roundTo2(acc.amount + item.amount),
          totalCgstAmount: roundTo2(acc.totalCgstAmount + item.cgstAmt),
          totalSgstAmount: roundTo2(acc.totalSgstAmount + item.sgstAmt),
          totalIgstAmount: roundTo2(acc.totalIgstAmount + item.igstAmt),
        }),
        {
          amount: 0,
          totalCgstAmount: 0,
          totalSgstAmount: 0,
          totalIgstAmount: 0,
        }
      );

      // Add additional charges to total if they are numeric values
      const transitInsuranceNumeric =
        data.transitInsuranceStatus === null && data.transitInsuranceAmount
          ? toNumber(data.transitInsuranceAmount)
          : 0;

      const pfChargesNumeric =
        data.pfStatus === null && data.pfCharges ? toNumber(data.pfCharges) : 0;

      const gstReverseNumeric =
        data.gstReverseStatus === null && data.gstReverseAmount
          ? toNumber(data.gstReverseAmount)
          : 0;

      const finalAmount = roundTo2(
        headerTotals.amount +
          transitInsuranceNumeric +
          pfChargesNumeric +
          gstReverseNumeric
      );

      const payload: any = {
        ...data,
        siteId: data.siteId ? Number(data.siteId) : null,
        vendorId: data.vendorId ? Number(data.vendorId) : null,
        billingAddressId: data.billingAddressId
          ? Number(data.billingAddressId)
          : null,
        siteDeliveryAddressId: data.siteDeliveryAddressId
          ? Number(data.siteDeliveryAddressId)
          : null,
        paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
        paymentTermsInDays: data.paymentTermsInDays
          ? Number(data.paymentTermsInDays)
          : null,
        poStatus: data.poStatus ?? null,
        transitInsuranceStatus: data.transitInsuranceStatus || null,
        transitInsuranceAmount: data.transitInsuranceAmount || null,
        pfStatus: data.pfStatus || null,
        pfCharges: data.pfCharges || null,
        gstReverseStatus: data.gstReverseStatus || null,
        gstReverseAmount: data.gstReverseAmount || null,
        amount: finalAmount,
        totalCgstAmount: headerTotals.totalCgstAmount,
        totalSgstAmount: headerTotals.totalSgstAmount,
        totalIgstAmount: headerTotals.totalIgstAmount,
        purchaseOrderItems: normalizedItems,
      };

      // Add statusAction for approval modes
      if (isApproval1) {
        payload.statusAction = "approve1";
      } else if (isApproval2) {
        payload.statusAction = "approve2";
      }

      // Submit the form
      const result =
        mode === "create"
          ? await apiPost("/api/purchase-orders", payload)
          : await apiPatch(`/api/purchase-orders/${initial?.id}`, payload);

      // Show success message
      const successMessage = isApproval1
        ? "Purchase Order approved (Level 1) successfully"
        : isApproval2
        ? "Purchase Order approved (Level 2) successfully"
        : `Purchase Order ${
            mode === "create" ? "created" : "updated"
          } successfully`;

      toast.success(successMessage);

      // Handle success
      if (onSuccess) {
        onSuccess(result);
      } else if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (error) {
      console.error("Error submitting purchase order:", error);
      toast.error(`Failed to ${mode} purchase order. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle transit insurance status change
  useEffect(() => {
    if (
      transitInsuranceStatus === "EXCLUSIVE" ||
      transitInsuranceStatus === "INCLUSIVE" ||
      transitInsuranceStatus === "NOT_APPLICABLE"
    ) {
      form.setValue("transitInsuranceAmount", transitInsuranceStatus);
    } else if (
      transitInsuranceStatus === null &&
      transitInsuranceAmount &&
      ["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"].includes(
        transitInsuranceAmount
      )
    ) {
      form.setValue("transitInsuranceAmount", null);
    }
  }, [transitInsuranceStatus, form]);

  // Handle pf status change
  useEffect(() => {
    if (
      pfStatus === "EXCLUSIVE" ||
      pfStatus === "INCLUSIVE" ||
      pfStatus === "NOT_APPLICABLE"
    ) {
      form.setValue("pfCharges", pfStatus);
    } else if (
      pfStatus === null &&
      pfCharges &&
      ["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"].includes(pfCharges)
    ) {
      form.setValue("pfCharges", null);
    }
  }, [pfStatus, form]);

  // Handle gst reverse status change
  useEffect(() => {
    if (
      gstReverseStatus === "EXCLUSIVE" ||
      gstReverseStatus === "INCLUSIVE" ||
      gstReverseStatus === "NOT_APPLICABLE"
    ) {
      form.setValue("gstReverseAmount", gstReverseStatus);
    } else if (
      gstReverseStatus === null &&
      gstReverseAmount &&
      ["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"].includes(gstReverseAmount)
    ) {
      form.setValue("gstReverseAmount", null);
    }
  }, [gstReverseStatus, form]);

  // Handle vendor change
  const onVendorChange = (value: string) => {
    const nextVendor = value === "__none" ? 0 : parseInt(value, 10);
    form.setValue("vendorId", nextVendor);
    form.setValue("billingAddressId", 0);
  };

  // Format number input
  return (
    <Form {...form}>
      <AppCard className="max-w-6xl mx-auto">
        <AppCard.Header>
          <AppCard.Title>
            {isCreate
              ? "Create Purchase Order"
              : isEdit
              ? "Edit Purchase Order"
              : isApproval1
              ? "Approve Purchase Order (Level 1)"
              : "Approve Purchase Order (Level 2)"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Create a new purchase order."
              : isEdit
              ? "Update purchase order details."
              : isApproval1
              ? "Review and approve purchase order items and quantities."
              : "Final approval of purchase order."}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            <FormSection legend="Purchase Order Details">
              <FormRow cols={4}>
                <TextInput
                  control={form.control}
                  name="purchaseOrderNo"
                  label="PO No."
                  placeholder="Auto-generated"
                  disabled
                />
                <TextInput
                  control={form.control}
                  name="purchaseOrderDate"
                  label="PO Date"
                  type="date"
                  required={!isApprovalMode}
                  disabled={isApprovalMode}
                />
                <TextInput
                  control={form.control}
                  name="deliveryDate"
                  label="Delivery Date"
                  type="date"
                  required={!isApprovalMode}
                  disabled={isApprovalMode}
                />
                <div>
                  <label className="block text-sm font-medium mb-2">
                    PO Status
                  </label>
                  <AppSelect
                    value={poStatusValue === "HOLD" ? "HOLD" : "__none"}
                    onValueChange={(value) => {
                      const next = value === "HOLD" ? "HOLD" : null;
                      form.setValue("poStatus", next);
                    }}
                    placeholder="Select PO Status"
                  >
                    <AppSelect.Item key="po-status-none" value="__none">
                      No Status
                    </AppSelect.Item>
                    <AppSelect.Item key="po-status-hold" value="HOLD">
                      Hold
                    </AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Vendor & Billing">
              <FormRow cols={3}>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Site<span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <AppSelect
                    value={
                      siteValue && siteValue > 0
                        ? siteValue.toString()
                        : "__none"
                    }
                    onValueChange={(value) => {
                      const next = value === "__none" ? 0 : parseInt(value, 10);
                      form.setValue("siteId", next);
                      form.setValue("siteDeliveryAddressId", 0);
                    }}
                    placeholder="Select Site"
                    disabled={isApprovalMode}
                  >
                    <AppSelect.Item key="site-none" value="__none">
                      Select Site
                    </AppSelect.Item>
                    {sites.map((site) => (
                      <AppSelect.Item key={site.id} value={site.id.toString()}>
                        {site.site}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  {errors.siteId ? (
                    <p className="text-sm text-destructive mt-2">
                      {errors.siteId.message as string}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vendor<span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <AppSelect
                    value={
                      vendorValue && vendorValue > 0
                        ? vendorValue.toString()
                        : "__none"
                    }
                    onValueChange={(value) => {
                      const next = value === "__none" ? 0 : Number(value);
                      form.setValue("vendorId", next);
                      onVendorChange(value);
                    }}
                    placeholder="Select Vendor"
                    disabled={isApprovalMode}
                  >
                    <AppSelect.Item key="vendor-none" value="__none">
                      Select Vendor
                    </AppSelect.Item>
                    {vendors.map((vendor) => (
                      <AppSelect.Item
                        key={vendor.id}
                        value={vendor.id.toString()}
                      >
                        {vendor.vendorName}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  {errors.vendorId ? (
                    <p className="text-sm text-destructive mt-2">
                      {errors.vendorId.message as string}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Billing Address
                    <span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <AppSelect
                    value={
                      billingAddressValue && billingAddressValue > 0
                        ? billingAddressValue.toString()
                        : "__none"
                    }
                    onValueChange={(value) => {
                      const next = value === "__none" ? 0 : parseInt(value, 10);
                      form.setValue("billingAddressId", next);
                    }}
                    placeholder="Select Billing Address"
                  >
                    <AppSelect.Item key="billing-none" value="__none">
                      Select Billing Address
                    </AppSelect.Item>
                    {billingAddresses.map((address) => (
                      <AppSelect.Item
                        key={address.id}
                        value={address.id.toString()}
                      >
                        {`${address.companyName}, ${address.city}`}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  {errors.billingAddressId ? (
                    <p className="text-sm text-destructive mt-2">
                      {errors.billingAddressId.message as string}
                    </p>
                  ) : null}
                </div>
              </FormRow>

              <FormRow cols={3}>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Delivery Address
                    <span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <AppSelect
                    value={
                      siteDeliveryAddressValue && siteDeliveryAddressValue > 0
                        ? siteDeliveryAddressValue.toString()
                        : "__none"
                    }
                    onValueChange={(value) => {
                      const next = value === "__none" ? 0 : parseInt(value, 10);
                      form.setValue("siteDeliveryAddressId", next);
                    }}
                    placeholder="Select Delivery Address"
                    disabled={!siteValue || siteValue <= 0}
                  >
                    <AppSelect.Item key="delivery-none" value="__none">
                      {siteValue
                        ? siteDeliveryAddresses.length
                          ? "Select Delivery Address"
                          : "No Delivery Addresses"
                        : "Select a Site first"}
                    </AppSelect.Item>
                    {siteDeliveryAddresses.map((address) => (
                      <AppSelect.Item
                        key={address.id}
                        value={address.id.toString()}
                      >
                        {address.addressLine1 || address.addressLine2
                          ? `${address.addressLine1 ?? ""}$${
                              address.addressLine2
                                ? `, ${address.addressLine2}`
                                : ""
                            }`
                              .replace("$", "")
                              .trim()
                          : `Address ${address.id}`}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  {errors.siteDeliveryAddressId ? (
                    <p className="text-sm text-destructive mt-2">
                      {errors.siteDeliveryAddressId.message as string}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Payment Term
                  </label>
                  <AppSelect
                    value={
                      paymentTermValue && paymentTermValue > 0
                        ? paymentTermValue.toString()
                        : "__none"
                    }
                    onValueChange={(value) => {
                      const next = value === "__none" ? 0 : parseInt(value, 10);
                      form.setValue("paymentTermId", next);
                    }}
                    placeholder="Select Payment Term"
                  >
                    <AppSelect.Item key="payment-term-none" value="__none">
                      Select Payment Term
                    </AppSelect.Item>
                    {paymentTerms.map((term) => (
                      <AppSelect.Item key={term.id} value={term.id.toString()}>
                        {term.paymentTerm}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>

                <TextInput
                  control={form.control}
                  name="quotationNo"
                  label="Quotation No."
                  placeholder="Enter quotation number"
                  required
                />
                <TextInput
                  control={form.control}
                  name="quotationDate"
                  label="Quotation Date"
                  type="date"
                  required
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Logistics & Terms">
              <FormRow cols={3}>
                <TextInput
                  control={form.control}
                  name="transport"
                  label="Transport"
                  placeholder="Enter transport"
                />
                <TextInput
                  control={form.control}
                  name="paymentTermsInDays"
                  label="Payment Terms (Days)"
                  type="number"
                />
                <TextareaInput
                  control={form.control}
                  name="deliverySchedule"
                  label="Delivery Schedule"
                  rows={2}
                  span={1}
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Notes">
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
                  rows={4}
                  span={2}
                />
              </FormRow>
            </FormSection>

            {/* Items Table */}
            <FormSection legend="Items">
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      {isApprovalMode && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ordered Qty
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {isApprovalMode ? "Approved Qty" : "Qty"}
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
                      {!isApprovalMode && (
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {fields.map((field, index) => (
                      <tr key={field.fieldId ?? index}>
                        <td className="px-4 py-3 align-top">
                          {isApprovalMode ? (
                            <>
                              <div className="font-medium">
                                {initial?.purchaseOrderItems?.[index]?.item
                                  ?.itemCode
                                  ? `${initial.purchaseOrderItems[index].item.itemCode} - ${initial.purchaseOrderItems[index].item.item}`
                                  : initial?.purchaseOrderItems?.[index]?.item
                                      ?.item || ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Unit:{" "}
                                {initial?.purchaseOrderItems?.[index]?.item
                                  ?.unit?.unitName || ""}
                              </div>
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.remark`}
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
                            </>
                          ) : (
                            <>
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.itemId`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <AppSelect
                                        value={
                                          field.value && field.value > 0
                                            ? field.value.toString()
                                            : "__none"
                                        }
                                        onValueChange={(value) => {
                                          if (value === "__none") {
                                            field.onChange(0);
                                            return;
                                          }

                                          const parsedValue = parseInt(
                                            value,
                                            10
                                          );
                                          field.onChange(
                                            Number.isNaN(parsedValue)
                                              ? 0
                                              : parsedValue
                                          );

                                          // Update rate if item is selected
                                          if (
                                            value !== "__none" &&
                                            itemOptions.length
                                          ) {
                                            const selectedItem =
                                              itemOptions.find(
                                                (item) =>
                                                  item.id.toString() === value
                                              );
                                            if (selectedItem) {
                                              // You might want to fetch the item's standard rate here
                                              // For now, we'll just set a default rate of 0
                                              form.setValue(
                                                `purchaseOrderItems.${index}.rate`,
                                                0
                                              );
                                            }
                                          }
                                        }}
                                        placeholder="Select Item"
                                      >
                                        <AppSelect.Item
                                          key={`item-placeholder-${
                                            field.fieldId ?? index
                                          }`}
                                          value="__none"
                                        >
                                          Select Item
                                        </AppSelect.Item>
                                        {itemOptions.map((item) => (
                                          <AppSelect.Item
                                            key={item.id}
                                            value={item.id.toString()}
                                          >
                                            {item.itemCode
                                              ? `${item.itemCode} - ${item.item}`
                                              : item.item}
                                          </AppSelect.Item>
                                        ))}
                                      </AppSelect>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.remark`}
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
                            </>
                          )}
                        </td>
                        {isApprovalMode && (
                          <td className="px-4 py-3 text-right font-medium align-top">
                            {formatAmount(
                              initial?.purchaseOrderItems?.[index]
                                ?.orderedQty ??
                                initial?.purchaseOrderItems?.[index]?.qty ??
                                0
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 align-top">
                          {isApprovalMode ? (
                            <FormField
                              control={form.control}
                              name={`purchaseOrderItems.${index}.approved1Qty`}
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
                          ) : (
                            <FormField
                              control={form.control}
                              name={`purchaseOrderItems.${index}.qty`}
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
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <FormField
                            control={form.control}
                            name={`purchaseOrderItems.${index}.rate`}
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
                            name={`purchaseOrderItems.${index}.discountPercent`}
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
                            name={`purchaseOrderItems.${index}.cgstPercent`}
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
                            name={`purchaseOrderItems.${index}.sgstPercent`}
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
                            name={`purchaseOrderItems.${index}.igstPercent`}
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
                        {!isApprovalMode && (
                          <td className="px-3 py-3 text-right text-sm font-medium align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="text-right px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100"
                      >
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {formatAmount(totals.taxableAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="px-4 py-3"
                      >
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            Transit Insurance
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={
                              transitInsuranceStatus
                                ? transitInsuranceStatus
                                : "__none"
                            }
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
                            <AppSelect.Item
                              key="transit-insurance-none"
                              value="__none"
                            >
                              None
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="transit-insurance-exclusive"
                              value="EXCLUSIVE"
                            >
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="transit-insurance-inclusive"
                              value="INCLUSIVE"
                            >
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="transit-insurance-not-applicable"
                              value="NOT_APPLICABLE"
                            >
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
                                    type={
                                      transitInsuranceStatus === null
                                        ? "number"
                                        : "text"
                                    }
                                    placeholder={
                                      transitInsuranceStatus === null
                                        ? "Enter amount"
                                        : "Auto-filled"
                                    }
                                    disabled={transitInsuranceStatus !== null}
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
                        {formatAmount(totals.transitInsuranceAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="px-4 py-3"
                      >
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            Transport Charges
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={pfStatus ? pfStatus : "__none"}
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
                            <AppSelect.Item key="pf-none" value="__none">
                              None
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="pf-exclusive"
                              value="EXCLUSIVE"
                            >
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="pf-inclusive"
                              value="INCLUSIVE"
                            >
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="pf-not-applicable"
                              value="NOT_APPLICABLE"
                            >
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
                                    type={pfStatus === null ? "number" : "text"}
                                    placeholder={
                                      pfStatus === null
                                        ? "Enter amount"
                                        : "Auto-filled"
                                    }
                                    disabled={pfStatus !== null}
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
                        {formatAmount(totals.pfChargesAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="text-right px-4 py-1 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        Discount
                      </td>
                      <td className="px-4 py-1 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.disAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
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
                        colSpan={isApprovalMode ? 8 : 7}
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
                        colSpan={isApprovalMode ? 8 : 7}
                        className="text-right px-4 py-1 text-sm font-medium text-gray-700 dark:text-slate-200"
                      >
                        IGST
                      </td>
                      <td className="px-4 py-1 text-right text-sm font-medium text-gray-700 dark:text-slate-100">
                        {formatAmount(totals.igstAmt)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="px-4 py-3"
                      >
                        <div className="flex justify-end items-center gap-4">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            GST Reverse Charge
                          </span>
                          <AppSelect
                            className="w-44"
                            triggerClassName="h-9"
                            value={
                              gstReverseStatus ? gstReverseStatus : "__none"
                            }
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
                            <AppSelect.Item
                              key="gst-reverse-none"
                              value="__none"
                            >
                              None
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="gst-reverse-exclusive"
                              value="EXCLUSIVE"
                            >
                              Exclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="gst-reverse-inclusive"
                              value="INCLUSIVE"
                            >
                              Inclusive
                            </AppSelect.Item>
                            <AppSelect.Item
                              key="gst-reverse-not-applicable"
                              value="NOT_APPLICABLE"
                            >
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
                                    type={
                                      gstReverseStatus === null
                                        ? "number"
                                        : "text"
                                    }
                                    placeholder={
                                      gstReverseStatus === null
                                        ? "Enter amount"
                                        : "Auto-filled"
                                    }
                                    disabled={gstReverseStatus !== null}
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
                        {formatAmount(totals.gstReverseAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={isApprovalMode ? 8 : 7}
                        className="text-right px-4 py-3 text-base font-bold text-gray-900 dark:text-slate-100 border-t border-gray-200"
                      >
                        Total Amount
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-gray-900 dark:text-slate-100 border-t border-gray-200">
                        {formatAmount(totals.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!isApprovalMode && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              )}
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end gap-3">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={isSubmitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName={isCreate ? "Plus" : isApprovalMode ? "Check" : "Save"}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="min-w-[180px]"
            >
              {isCreate
                ? "Create Purchase Order"
                : isApproval1
                ? "Approve Purchase Order"
                : isApproval2
                ? "Final Approve"
                : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
