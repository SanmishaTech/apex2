"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
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
import { AppCombobox } from "@/components/common/app-combobox";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { Plus, Trash2, ArrowLeft, Minus } from "lucide-react";

type Site = {
  id: number;
  site: string;
};

type Boq = {
  id: number;
  workName: string;
  siteId?: number;
};

type BillingAddress = {
  id: number;
  companyName: string;
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
  pincode?: string | null;
  pinCode?: string | null;
  gstNumber?: string | null;
};

type BoqItem = {
  id: number;
  item: string;
  activityId: string;
  unit?: {
    id: number;
    unitName: string;
  } | null;
  qty: number;
  rate: number;
};

type SalesInvoiceDetail = {
  id?: number;
  boqItemId: number;
  boqItem?: BoqItem;
  particulars?: string;
  totalBoqQty: number;
  invoiceQty: number;
  rate: number;
  discount: number;
  discountAmount: number;
  cgst: number;
  cgstAmt: number;
  sgst: number;
  sgstAmt: number;
  igst: number;
  igstAmt: number;
  amount: number;
};

type SalesInvoiceFormInitialData = {
  id?: number;
  invoiceNumber?: string;
  revision?: string;
  invoiceDate?: string;
  fromDate?: string;
  toDate?: string;
  siteId?: number | null;
  boqId?: number | null;
  billingAddressId?: number | null;
  grossAmount?: number;
  tds?: number;
  wct?: number;
  lwf?: number;
  other?: number;
  totalAmount?: number;
  authorizedById?: number | null;
  salesInvoiceDetails?: SalesInvoiceDetail[];
};

export type SalesInvoiceFormMode = "create" | "edit" | "view" | "authorize";

export interface SalesInvoiceFormProps {
  mode: SalesInvoiceFormMode;
  id?: number;
  initial?: SalesInvoiceFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

function formatBillingAddressLabel(address: BillingAddress | null | undefined): string {
  if (!address) return "";
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.city?.city,
    address.state?.state,
    address.pincode || address.pinCode,
  ]
  .map((p) => (typeof p === "string" ? p.trim() : ""))
  .filter(Boolean);
  return parts.join(", ") || address.companyName || `Address ${address.id}`;
}

const twoDpNumberOrString = () => z.any().optional();

const salesInvoiceDetailSchema = z.object({
  boqItemId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "BOQ Item is required"
    )
    .transform((val) => parseInt(val)),
  particulars: z.string().optional(),
  totalBoqQty: twoDpNumberOrString(),
  invoiceQty: twoDpNumberOrString(),
  rate: twoDpNumberOrString(),
  discount: twoDpNumberOrString(),
  cgst: twoDpNumberOrString(),
  sgst: twoDpNumberOrString(),
  igst: twoDpNumberOrString(),
  amount: z.number().optional(),
});

const createInputSchema = z.object({
  invoiceDate: z.string().min(1, "Invoice date is required"),
  fromDate: z.string().min(1, "From date is required"),
  toDate: z.string().min(1, "To date is required"),
  siteId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "Site is required"
    )
    .transform((val) => parseInt(val)),
  boqId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine(
      (val) => val !== "__none" && val !== "0" && val !== "",
      "BOQ is required"
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
  tds: twoDpNumberOrString(),
  wct: twoDpNumberOrString(),
  lwf: twoDpNumberOrString(),
  other: twoDpNumberOrString(),
  salesInvoiceDetails: z
    .array(salesInvoiceDetailSchema)
    .min(1, "At least one item is required"),
});

type FormData = z.infer<typeof createInputSchema> & {
  invoiceNumber?: string;
  revision?: string;
};

export function SalesInvoiceForm({
  mode,
  id,
  initial,
  onSuccess,
  redirectOnSuccess = "/sales-invoices",
}: SalesInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const isAuthorize = mode === "authorize";
  const isReadOnly = isView || isAuthorize;

  // Fetch invoice data for edit/view mode
  const { data: invoiceData } = useSWR<any>(
    !isCreate && id ? `/api/sales-invoices/${id}` : null,
    !isCreate && id ? apiGet : null
  );

  // Fetch data for dropdowns
  const { data: sitesData } = useSWR<{ data: Site[] }>(
    "/api/sites?perPage=1000",
    apiGet
  );

  const { data: billingAddressesData } = useSWR<{ data: BillingAddress[] }>(
    "/api/billing-addresses?perPage=10000",
    apiGet
  );

  const sites = sitesData?.data ?? [];
  const billingAddresses = billingAddressesData?.data ?? [];


  // Get effective data (API may return either the object directly or a { data } wrapper)
  const effectiveData = useMemo(() => {
    if (!isCreate && invoiceData) {
      return (invoiceData as any).data ?? invoiceData;
    }
    return initial;
  }, [isCreate, invoiceData, initial]);

  // (removed debug logs)

  // Watch siteId for BOQ filtering
  // NOTE: `form` is initialized after `defaultValues` (below) to avoid reset timing issues.

  // BOQ and BOQ items are fetched after the form is initialized (see below)

  const formatDateField = (value?: string | null, fallback?: string): string => {
    if (!value) {
      return fallback ?? "";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "yyyy-MM-dd");
    }
    return value.slice(0, 10) || fallback || "";
  };

  const defaultValues = useMemo<DeepPartial<FormData>>(() => {
    const data = effectiveData;
    
    // Helper to convert Decimal/number to string
    const toStr = (val: unknown): string => {
      if (val == null) return "";
      if (typeof val === "string") return val;
      if (typeof val === "number") return val.toString();
      // Handle Decimal objects from Prisma
      return String(val);
    };

    // If no data yet, return the initial empty state (don't reset with empty object)
    if (!data) {
      return {
        invoiceDate: "",
        fromDate: "",
        toDate: "",
        siteId: 0,
        boqId: 0,
        billingAddressId: 0,
        tds: "",
        wct: "",
        lwf: "",
        other: "",
        salesInvoiceDetails: [],
      };
    }

    return {
      invoiceNumber: data?.invoiceNumber ?? "",
      revision: data?.revision ?? "",
      invoiceDate: formatDateField(data?.invoiceDate, ""),
      fromDate: formatDateField(data?.fromDate, ""),
      toDate: formatDateField(data?.toDate, ""),
      siteId: data?.siteId ?? 0,
      boqId: data?.boqId ?? 0,
      billingAddressId: data?.billingAddressId ?? 0,
      tds: toStr(data?.tds),
      wct: toStr(data?.wct),
      lwf: toStr(data?.lwf),
      other: toStr(data?.other),
      salesInvoiceDetails:
        data?.salesInvoiceDetails?.map((detail: any) => ({
          id: detail.id,
          boqItemId: detail.boqItemId ?? 0,
          particulars: detail.particulars ?? "",
          totalBoqQty: toStr(detail.totalBoqQty),
          invoiceQty: toStr(detail.invoiceQty),
          rate: toStr(detail.rate),
          discount: toStr(detail.discount),
          cgst: toStr(detail.cgst),
          sgst: toStr(detail.sgst),
          igst: toStr(detail.igst),
          amount: Number(detail.amount) || 0,
        })) || [],
    };
  }, [effectiveData]);

  // Initialize react-hook-form with computed defaults (prevents race where reset may miss registrations)
  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema) as unknown as Resolver<FormData>,
    defaultValues: defaultValues as any,
  });

  const watchedSiteId = form.watch("siteId");
  const watchedBoqId = form.watch("boqId");

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "salesInvoiceDetails",
    keyName: "fieldId",
  });

  // Only fetch BOQs when site is selected
  const { data: boqsData } = useSWR<{ data: Boq[] }>(
    watchedSiteId ? `/api/boqs?perPage=1000&siteId=${watchedSiteId}` : null,
    apiGet
  );
  const boqs = boqsData?.data ?? [];

  // Only fetch BOQ items when BOQ is selected
  const { data: boqDetail } = useSWR<any>(
    watchedBoqId ? `/api/boqs/${watchedBoqId}` : null,
    apiGet
  );
  const boqItems: BoqItem[] = boqDetail?.items || [];

  const boqsForSelect = useMemo(() => {
    const arr = boqs.map((b) => ({ value: String(b.id), label: b.workName }));
    if (effectiveData?.boq && !arr.find((a) => a.value === String(effectiveData.boq.id))) {
      arr.unshift({ value: String(effectiveData.boq.id), label: effectiveData.boq.workName });
    }
    return arr;
  }, [boqs, effectiveData]);

  const boqItemsForSelect = useMemo(() => {
    // Map currently loaded boqItems; if empty but effectiveData has details, include those items so activity shows
    const arr = (boqItems || []).map((b) => ({ value: String(b.id), label: b.activityId }));
    // include any selected items from invoice details that aren't present
    const detailItems = (effectiveData?.salesInvoiceDetails || []).map((d: any) => d.boqItem).filter(Boolean);
    for (const di of detailItems) {
      if (!arr.find((a) => a.value === String(di.id))) {
        arr.unshift({ value: String(di.id), label: di.activityId || di.item || String(di.id) });
      }
    }
    return arr;
  }, [boqItems, effectiveData]);

  // Defensive: ensure option lists include the invoice's own selected items so the Combobox can show them
  const sitesForSelect = useMemo(() => {
    const arr = sites.map((s) => ({ value: String(s.id), label: s.site }));
    if (effectiveData?.site && !arr.find((a) => a.value === String(effectiveData.site.id))) {
      arr.unshift({ value: String(effectiveData.site.id), label: effectiveData.site.site });
    }
    return arr;
  }, [sites, effectiveData]);

  const billingAddressesForSelect = useMemo(() => {
    const arr = billingAddresses.map((a) => ({ value: String(a.id), label: formatBillingAddressLabel(a) }));
    if (
      effectiveData?.billingAddress &&
      !arr.find((a) => a.value === String(effectiveData.billingAddress.id))
    ) {
      arr.unshift({ value: String(effectiveData.billingAddress.id), label: formatBillingAddressLabel(effectiveData.billingAddress) });
    }
    return arr;
  }, [billingAddresses, effectiveData]);

  // (removed debug logs)

  // When effectiveData becomes available (edit/view/authorize), reset form values so fields show loaded data.
  useEffect(() => {
    // Always reset whenever computed defaultValues change (mirrors PurchaseOrderForm behavior)
    form.reset(defaultValues);
  }, [effectiveData, defaultValues, form]);

  // Refetch BOQ items when BOQ changes in create mode
  useEffect(() => {
    if (isCreate && watchedBoqId && watchedBoqId > 0) {
      // Clear existing items when BOQ changes
      replace([
        {
          boqItemId: 0,
          particulars: "",
          totalBoqQty: "",
          invoiceQty: "",
          rate: "",
          discount: "",
          cgst: "",
          sgst: "",
          igst: "",
          amount: 0,
        },
      ]);
    }
  }, [watchedBoqId, isCreate, replace]);

  const items = form.watch("salesInvoiceDetails");
  const tds = form.watch("tds") || 0;
  const wct = form.watch("wct") || 0;
  const lwf = form.watch("lwf") || 0;
  const other = form.watch("other") || 0;

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

  const computeItemMetrics = (item: FormData["salesInvoiceDetails"][number]) => {
    const qty = toNumber(item.invoiceQty);
    const rate = toNumber(item.rate);
    const discountPercent = toNumber(item.discount);
    const cgstPercent = toNumber(item.cgst);
    const sgstPercent = toNumber(item.sgst);
    const igstPercent = toNumber(item.igst);

    const baseAmount = qty * rate;
    const discountAmount = roundTo2((baseAmount * discountPercent) / 100);
    const taxableAmount = roundTo2(baseAmount - discountAmount);
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
      discountAmount,
      taxableAmount,
      cgstAmt,
      sgstAmt,
      igstAmt,
      amount,
    };
  };

  const computedItems = items.map((item) => computeItemMetrics(item));

  const itemTotals = computedItems.reduce(
    (acc, item) => ({
      amount: roundTo2(acc.amount + item.amount),
      cgstAmt: roundTo2(acc.cgstAmt + item.cgstAmt),
      sgstAmt: roundTo2(acc.sgstAmt + item.sgstAmt),
      igstAmt: roundTo2(acc.igstAmt + item.igstAmt),
      discountAmount: roundTo2(acc.discountAmount + item.discountAmount),
      taxableAmount: roundTo2(acc.taxableAmount + item.taxableAmount),
    }),
    {
      amount: 0,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 0,
      discountAmount: 0,
      taxableAmount: 0,
    }
  );

  const grossAmount = itemTotals.amount;
  const deductionsTotal = roundTo2(toNumber(tds) + toNumber(wct) + toNumber(lwf) + toNumber(other));
  const totalAmount = roundTo2(grossAmount - deductionsTotal);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        grossAmount,
        totalAmount,
        salesInvoiceDetails: data.salesInvoiceDetails.map((detail, index) => {
          const computed = computedItems[index];
          // Normalize fields: send numbers or nulls (no empty strings)
          const norm = {
            boqItemId: typeof detail.boqItemId === "string" ? parseInt(detail.boqItemId, 10) : detail.boqItemId,
            particulars: detail.particulars ?? "",
            totalBoqQty: toNumber(detail.totalBoqQty as any),
            invoiceQty: toNumber(detail.invoiceQty as any),
            rate: toNumber(detail.rate as any),
            discount: detail.discount === "" || detail.discount == null ? null : toNumber(detail.discount as any),
            discountAmount: computed.discountAmount,
            cgst: detail.cgst === "" || detail.cgst == null ? null : toNumber(detail.cgst as any),
            cgstAmt: computed.cgstAmt,
            sgst: detail.sgst === "" || detail.sgst == null ? null : toNumber(detail.sgst as any),
            sgstAmt: computed.sgstAmt,
            igst: detail.igst === "" || detail.igst == null ? null : toNumber(detail.igst as any),
            igstAmt: computed.igstAmt,
            amount: computed.amount,
          } as any;

          return norm;
        }),
      };

      if (isCreate) {
        await apiPost("/api/sales-invoices", payload);
        toast.success("Sales invoice created successfully");
      } else if (isEdit && id) {
        await apiPatch(`/api/sales-invoices/${id}`, payload);
        toast.success("Sales invoice updated successfully");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save sales invoice");
    } finally {
      setIsSubmitting(false);
    }
  };


  const addItem = () => {
    append({
      boqItemId: 0,
      particulars: "",
      totalBoqQty: "",
      invoiceQty: "",
      rate: "",
      discount: "",
      cgst: "",
      sgst: "",
      igst: "",
      amount: 0,
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const formatAmount = (value: number | undefined | null): string => {
    const amount = Number.isFinite(value as number) ? (value as number) : 0;
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const decimalRegex2 = /^\d*(?:\.\d{0,2})?$/;
  const handleDecimalChange2 = (path: any) => (value: string) => {
    if (value === "" || decimalRegex2.test(value)) {
      form.setValue(path, value as any, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AppButton
            type="button"
            variant="outline"
            size="sm"
            iconName="ArrowLeft"
            onClick={() => router.push("/sales-invoices")}
            className="text-black dark:text-white"
          >
            Back
          </AppButton>
          <h1 className="text-2xl font-bold">
            {isCreate
              ? "New Sales Invoice"
              : isEdit
              ? `Edit Sales Invoice ${effectiveData?.invoiceNumber || ""}`
              : `View Sales Invoice ${effectiveData?.invoiceNumber || ""}`}
          </h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Invoice Details</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <FormRow smCols={3} mdCols={3}>
                <TextInput
                  control={form.control}
                  name="invoiceDate"
                  label="Invoice Date"
                  type="date"
                  disabled={isReadOnly}
                  itemClassName="w-full"
                />
                <TextInput
                  control={form.control}
                  name="fromDate"
                  label="From Date"
                  type="date"
                  disabled={isReadOnly}
                  itemClassName="w-full"
                />
                <TextInput
                  control={form.control}
                  name="toDate"
                  label="To Date"
                  type="date"
                  disabled={isReadOnly}
                  itemClassName="w-full"
                />
              </FormRow>

              <FormRow smCols={3} mdCols={3}>
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <label className="text-sm font-medium">Site</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value && field.value > 0 ? String(field.value) : "__none"}
                          onValueChange={(value) => {
                            const next = value === "__none" ? 0 : parseInt(value, 10);
                            field.onChange(next);
                            // Clear BOQ when site changes
                            form.setValue("boqId", 0);
                          }}
                          options={[{ value: "__none", label: "Select site" }, ...sitesForSelect]}
                          placeholder="Select site"
                          searchPlaceholder="Search site..."
                          emptyText="No site found."
                          disabled={isReadOnly}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="boqId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <label className="text-sm font-medium">BOQ</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value && field.value > 0 ? String(field.value) : "__none"}
                          onValueChange={(value) => {
                            const next = value === "__none" ? 0 : parseInt(value, 10);
                            field.onChange(next);
                          }}
                          options={watchedSiteId ? [{ value: "__none", label: "Select BOQ" }, ...boqsForSelect] : [{ value: "__none", label: "Select site first" }]}
                          placeholder={watchedSiteId ? "Select BOQ" : "Select site first"}
                          searchPlaceholder="Search BOQ..."
                          emptyText="No BOQ found."
                          disabled={isReadOnly || !isCreate || !watchedSiteId}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingAddressId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <label className="text-sm font-medium">Billing Address</label>
                      <FormControl>
                        <AppCombobox
                          value={field.value && field.value > 0 ? String(field.value) : "__none"}
                          onValueChange={(value) => {
                            const next = value === "__none" ? 0 : parseInt(value, 10);
                            field.onChange(next);
                          }}
                          options={[{ value: "__none", label: "Select billing address" }, ...billingAddressesForSelect]}
                          placeholder="Select billing address"
                          searchPlaceholder="Search address..."
                          emptyText="No address found."
                          disabled={isReadOnly}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
            </AppCard.Content>
          </AppCard>

          {/* Combined Invoice Items & Totals Card */}
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Invoice Items & Totals</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              {/* Items Section - Table Style like SubContractor Work Order */}
              <div className="w-full overflow-x-auto rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full border-collapse bg-transparent text-[11px]">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-700">
                      {!isReadOnly && <th className="w-10 px-2 py-2 text-center border-r border-slate-200 dark:border-slate-700"></th>}
                      <th className="px-2 py-2 text-left">Item Details</th>
                      <th className="w-32 px-2 py-2 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const computed = computedItems[index];
                      return (
                        <Fragment key={field.fieldId}>
                          {/* Row 1 - BOQ Item Selection + Particulars */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                            {!isReadOnly && (
                              <td rowSpan={3} className={`border-r border-slate-200 dark:border-slate-700 px-1 py-1 align-top text-center ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  className="text-destructive h-7 w-7 mt-2"
                                  title="Remove Item"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                            <td className="px-2 py-2 pt-3">
                              <div className="flex gap-4 items-start">
                                <div className="w-48">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.boqItemId`}
                                    render={({ field: boqField }) => (
                                      <FormItem>
                                        <label className="text-[10px] font-medium leading-none">Activity</label>
                                        <FormControl>
                                          <AppCombobox
                                            value={boqField.value && boqField.value > 0 ? String(boqField.value) : "__none"}
                                            onValueChange={(val) => {
                                              const parsed = val === "__none" ? 0 : parseInt(val, 10);
                                              boqField.onChange(parsed);
                                              const selectedItem = boqItems.find((it: BoqItem) => it.id === parsed);
                                              if (selectedItem) {
                                                form.setValue(`salesInvoiceDetails.${index}.particulars`, selectedItem.item || "");
                                                form.setValue(`salesInvoiceDetails.${index}.rate`, selectedItem.rate);
                                                form.setValue(`salesInvoiceDetails.${index}.totalBoqQty`, selectedItem.qty);
                                              }
                                            }}
                                            options={watchedBoqId ? [{ value: "__none", label: "Select Activity" }, ...boqItemsForSelect] : [{ value: "__none", label: "Select BOQ first" }]}
                                            placeholder={watchedBoqId ? "Select Activity" : "Select BOQ first"}
                                            searchPlaceholder="Search activity..."
                                            emptyText="No activity found."
                                            disabled={isReadOnly || !watchedBoqId}
                                            className="w-full"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <TextareaInput
                                    name={`salesInvoiceDetails.${index}.particulars`}
                                    control={form.control}
                                    label="Particulars"
                                    disabled={isReadOnly}
                                    className="h-14 text-[11px]"
                                    itemClassName="m-0"
                                  />
                                </div>
                              </div>
                            </td>
                            <td rowSpan={3} className={`border-l border-slate-200 dark:border-slate-700 px-2 py-2 align-middle text-right font-bold text-sm ${index % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/30" : "bg-white dark:bg-slate-900"}`}>
                              {computed?.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                            </td>
                          </tr>
                          {/* Row 2 - Qty, Rate, Discount */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`}>
                            <td className="px-2 py-2">
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.totalBoqQty`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">BOQ Qty</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right bg-slate-100 dark:bg-slate-800"
                                            disabled={true}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            readOnly
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.invoiceQty`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Invoice Qty</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === "" || /^\d*(?:\.\d{0,2})?$/.test(val)) {
                                                const boqQty = parseFloat(form.getValues(`salesInvoiceDetails.${index}.totalBoqQty`) as string) || 0;
                                                const invoiceQty = parseFloat(val) || 0;
                                                if (invoiceQty > boqQty && boqQty > 0) {
                                                  toast.error(`Invoice qty cannot exceed BOQ qty (${boqQty})`);
                                                  return;
                                                }
                                                field.onChange(val);
                                                form.setValue(`salesInvoiceDetails.${index}.invoiceQty`, val as any, { shouldDirty: true, shouldValidate: true });
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.rate`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Rate</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`salesInvoiceDetails.${index}.rate`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.discount`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">Disc %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`salesInvoiceDetails.${index}.discount`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.discountAmount > 0 ? `₹${computed.discountAmount.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Row 3 - Taxes */}
                          <tr className={`${index % 2 === 0 ? "bg-slate-50/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"} border-b-2 border-slate-300 dark:border-slate-700`}>
                            <td className="px-2 py-2 pb-3">
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.cgst`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">CGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`salesInvoiceDetails.${index}.cgst`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.cgstAmt > 0 ? `₹${computed.cgstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.sgst`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">SGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`salesInvoiceDetails.${index}.sgst`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.sgstAmt > 0 ? `₹${computed.sgstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <FormField
                                    control={form.control}
                                    name={`salesInvoiceDetails.${index}.igst`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <label className="text-[10px] font-medium leading-none">IGST %</label>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="h-7 text-[11px] text-right"
                                            disabled={isReadOnly}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            placeholder="0.00"
                                            onChange={(e) => handleDecimalChange2(`salesInvoiceDetails.${index}.igst`)(e.target.value)}
                                          />
                                        </FormControl>
                                        <div className="text-[9px] text-muted-foreground mt-0.5 text-right font-medium min-h-3.5">
                                          {computed?.igstAmt > 0 ? `₹${computed.igstAmt.toFixed(2)}` : ""}
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex-1"></div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isReadOnly && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="text-black dark:text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
              )}

              {/* Deductions & Totals - Right aligned, small text */}
              <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4">
                {/* Taxable Amount */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm">
                  <span className="text-muted-foreground text-[11px]">Taxable Amount:</span>
                  <span className="text-right text-[11px] font-medium">{itemTotals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Total CGST/SGST/IGST */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1">
                  <span className="text-muted-foreground text-[11px]">Total CGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground text-[11px]">Total SGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground text-[11px]">Total IGST:</span>
                  <span className="text-right text-[11px]">{itemTotals.igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Gross Amount */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1 border-t pt-1">
                  <span className="text-muted-foreground text-[11px] font-medium">Gross Amount:</span>
                  <span className="text-right text-[11px] font-medium">{formatAmount(grossAmount)}</span>
                </div>

                {/* Deductions - Input Fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full max-w-xs text-[11px] mt-2">
                  <span className="text-muted-foreground">TDS:</span>
                  <FormField
                    control={form.control}
                    name="tds"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isReadOnly}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("tds")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">WCT:</span>
                  <FormField
                    control={form.control}
                    name="wct"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isReadOnly}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("wct")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">LWF:</span>
                  <FormField
                    control={form.control}
                    name="lwf"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isReadOnly}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("lwf")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="text-muted-foreground">Other:</span>
                  <FormField
                    control={form.control}
                    name="other"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            type="text"
                            className="h-6 text-[11px] text-right"
                            disabled={isReadOnly}
                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                            placeholder="0.00"
                            onChange={(e) => handleDecimalChange2("other")(e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Deduction Values Display */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1">
                  {toNumber(tds) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less TDS:</span>
                      <span className="text-right text-[11px]">{formatAmount(toNumber(tds))}</span>
                    </>
                  )}
                  {toNumber(wct) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less WCT:</span>
                      <span className="text-right text-[11px]">{formatAmount(toNumber(wct))}</span>
                    </>
                  )}
                  {toNumber(lwf) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less LWF:</span>
                      <span className="text-right text-[11px]">{formatAmount(toNumber(lwf))}</span>
                    </>
                  )}
                  {toNumber(other) > 0 && (
                    <>
                      <span className="text-muted-foreground text-[11px]">Less Other:</span>
                      <span className="text-right text-[11px]">{formatAmount(toNumber(other))}</span>
                    </>
                  )}
                </div>

                {/* Total Deductions */}
                {deductionsTotal > 0 && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-1 border-t pt-1">
                    <span className="text-muted-foreground text-[11px] font-medium">Total Deductions:</span>
                    <span className="text-right text-[11px] font-medium">{formatAmount(deductionsTotal)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-sm text-sm mt-2 border-t pt-2">
                  <span className="text-lg font-bold text-[14px]">Net Amount:</span>
                  <span className="text-lg font-bold text-right text-[14px] text-primary">
                    {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </AppCard.Content>
          </AppCard>

          {/* Submit Buttons - Right Aligned */}
          {!isReadOnly && (
            <div className="flex justify-end gap-4">
              <AppButton
                type="button"
                variant="outline"
                onClick={() => router.push("/sales-invoices")}
                className="text-black dark:text-white"
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                disabled={isSubmitting}
                isLoading={isSubmitting}
              >
                {isCreate ? "Create Invoice" : "Update Invoice"}
              </AppButton>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
