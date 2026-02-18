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
import { AppSelect } from "@/components/common/app-select";
import { AppCombobox } from "@/components/common/app-combobox";
import { MultiSelectInput } from "@/components/common/multi-select-input";
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
  approved2Qty?: number | null;
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
  paymentTermIds?: number[] | null;
  quotationNo?: string;
  quotationDate?: string;
  transport?: string | null;
  note?: string | null;
  poStatus?: "ORDER_PLACED" | "IN_TRANSIT" | "RECEIVED" | "HOLD" | "OPEN" | null;
  paymentTermsInDays?: number | null;
  deliverySchedule?: string | null;
  poAdditionalCharges?: Array<{
    id?: number;
    head?: string | null;
    gstCharge?: string | null;
    amount?: string | number | null;
    amountWithGst?: string | number | null;
  }>;
  purchaseOrderItems?: PurchaseOrderItem[];
};

export interface PurchaseOrderFormProps {
  mode: "create" | "edit" | "approval1" | "approval2";
  initial?: PurchaseOrderFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/purchase-orders'
  mutate?: () => Promise<any>;
  indentId?: number;
  indentIds?: number[];
  refreshKey?: string;
}

const twoDpNumber = (
  label: string,
  required = false,
  min?: number,
  max?: number,
  dp: number = 2
) =>
  z.preprocess(
    (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        let t = val.trim();
        if (t.endsWith(".")) t = t.slice(0, -1);
        if (t === "") return required ? undefined : 0;
        const re = new RegExp(`^\\d*(?:\\.\\d{0,${dp}})?$`);
        if (!re.test(t)) return NaN as any;
        const n = parseFloat(t);
        return Number.isFinite(n) ? n : (NaN as any);
      }
      return required ? undefined : 0;
    },
    z
      .number({ required_error: `${label} is required` })
      .refine((v) => (typeof min === "number" ? v >= min : true), `${label} must be ${min !== undefined ? `>= ${min}` : "valid"}`)
      .refine((v) => (typeof max === "number" ? v <= max : true), `${label} must be ${max !== undefined ? `<= ${max}` : "valid"}`)
  );

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
  fromIndent: z.coerce.boolean().optional().default(false),
  qty: twoDpNumber("Quantity", true, 0.01),
  approved1Qty: z
    .preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : val),
      twoDpNumber("Approved quantity", true, 0.01)
    )
    .optional(),
  approved2Qty: z
    .preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : val),
      twoDpNumber("Approved quantity", true, 0.01)
    )
    .optional(),
  rate: twoDpNumber("Rate", true, 0.01),
  discountPercent: twoDpNumber("Discount %", false, 0, 100),
  cgstPercent: twoDpNumber("CGST %", false, 0, 100),
  sgstPercent: twoDpNumber("SGST %", false, 0, 100),
  igstPercent: twoDpNumber("IGST %", false, 0, 100),
  indentItemId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      const n = typeof val === "string" ? parseInt(val, 10) : val;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
  // Derived, display-only field to allow showing validation message under Amount
  amount: z.number().optional(),
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
  paymentTermIds: z
    .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
    .optional()
    .default([]),
  quotationNo: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.string().min(1, "Quotation No. is required").optional()
    )
    .optional(),
  quotationDate: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.string().min(1, "Quotation date is required").optional()
    )
    .optional(),
  transport: z.string().optional(),
  note: z.string().optional(),
  poStatus: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? "OPEN" : v),
      z.enum(["OPEN", "ORDER_PLACED", "IN_TRANSIT", "RECEIVED", "HOLD"])
    )
    .optional(),
  paymentTermsInDays: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? undefined : Number(v))),
  deliverySchedule: z.string().optional(),
  poAdditionalCharges: z
    .array(
      z.object({
        head: z.string().optional(),
        gstCharge: z.enum(["N/A", "5%", "18%"]).optional(),
        amount: z
          .string()
          .optional()
          .nullable()
          .transform((v) => (v === null || v === undefined ? "" : String(v))),
      })
    )
    .optional()
    .default([]),
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
  mutate,
  indentId,
  indentIds,
  refreshKey,
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

  const normalizeGstChargeLabel = (value?: string | null) => {
    if (value === "5% Gst charge") return "5%";
    if (value === "18% Gst charge") return "18%";
    if (value === "5%") return "5%";
    if (value === "18%") return "18%";
    return "N/A";
  };

  type ApiListResponse<T> = {
    data: T[];
  };

  // Fetch data for dropdowns using shared API client
  const { data: sitesData } = useSWR<ApiListResponse<Site>>(
    "/api/sites?perPage=1000",
    apiGet
  );

  const { data: vendorsData } = useSWR<ApiListResponse<Vendor>>(
    "/api/vendors?perPage=10000",
    apiGet
  );

  const { data: billingAddressesData } = useSWR<
    ApiListResponse<BillingAddress>
  >("/api/billing-addresses?perPage=10000", apiGet);

  const { data: paymentTermsData } = useSWR<ApiListResponse<PaymentTerm>>(
    "/api/payment-terms?perPage=1000",
    apiGet
  );

  const { data: itemsData } = useSWR<ApiListResponse<Item>>(
    "/api/items?perPage=5000&include=unit",
    apiGet
  );

  const resolvedIndentIds = useMemo(() => {
    const fromList = Array.isArray(indentIds) ? indentIds : [];
    const cleaned = fromList
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    const unique = Array.from(new Set(cleaned));
    if (unique.length > 0) return unique;
    if (indentId && Number.isFinite(indentId) && indentId > 0) return [indentId];
    return [] as number[];
  }, [indentIds, indentId]);

  // If generating from indent(s), fetch indent(s) and prefill
  const { data: indentData, mutate: revalidateIndent } = useSWR<any>(
    mode === "create" && resolvedIndentIds.length === 1
      ? `/api/indents/${resolvedIndentIds[0]}?r=${encodeURIComponent(String(refreshKey ?? ""))}`
      : null,
    mode === "create" && resolvedIndentIds.length === 1 ? apiGet : null
  );

  const { data: indentsBulkData } = useSWR<any>(
    mode === "create" && resolvedIndentIds.length > 1
      ? `/api/indents/bulk?ids=${encodeURIComponent(resolvedIndentIds.join(","))}&r=${encodeURIComponent(String(refreshKey ?? ""))}`
      : null,
    mode === "create" && resolvedIndentIds.length > 1 ? apiGet : null
  );

  const [indentAllocationsByItemId, setIndentAllocationsByItemId] = useState<
    Record<number, Array<{ indentItemId: number; qty: number }>>
  >({});
  const [prefilledFromIndent, setPrefilledFromIndent] = useState(false);

  const formatDateField = (
    value?: string | null,
    fallback?: string
  ): string => {
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

  const formatBillingAddressLabel = (address: BillingAddress): string => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.city?.city,
      address.state?.state,
      address.pincode,
    ]
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean);
    return parts.join(", ") || address.companyName || `Address ${address.id}`;
  };

  // Initialize form with proper types
  const defaultValues = useMemo<DeepPartial<FormData>>(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const indentLinkedEdit =
      mode === "edit" &&
      Array.isArray((initial as any)?.purchaseOrderIndent) &&
      (((initial as any)?.purchaseOrderIndent?.length as any) || 0) > 0;
    const toNum = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const initialPaymentTermIds: string[] = Array.isArray(initial?.paymentTermIds)
      ? (initial?.paymentTermIds || [])
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0)
          .map((n) => String(n))
      : [];

    return {
      purchaseOrderNo: initial?.purchaseOrderNo ?? "",
      purchaseOrderDate: formatDateField(initial?.purchaseOrderDate, today),
      deliveryDate: formatDateField(initial?.deliveryDate),
      siteId: initial?.siteId ?? 0,
      vendorId: initial?.vendorId ?? 0,
      billingAddressId: initial?.billingAddressId ?? 0,
      siteDeliveryAddressId: initial?.siteDeliveryAddressId ?? 0,
      paymentTermIds: initialPaymentTermIds,
      quotationNo: initial?.quotationNo ?? "",
      quotationDate: initial?.quotationDate
        ? formatDateField(initial.quotationDate, undefined)
        : "",
      transport: initial?.transport ?? "",
      note: initial?.note ?? "",
      poStatus: initial?.poStatus ?? "OPEN",
      paymentTermsInDays: initial?.paymentTermsInDays ?? 0,
      deliverySchedule: initial?.deliverySchedule ?? "",
      poAdditionalCharges:
        (initial?.poAdditionalCharges?.map((c) => ({
          id: c.id,
          head: (c.head ?? "") as any,
          gstCharge: normalizeGstChargeLabel(c.gstCharge as any) as any,
          amount:
            c.amount == null
              ? ""
              : typeof c.amount === "string"
                ? c.amount
                : String(c.amount),
        })) || []) as any,
      purchaseOrderItems: initial?.purchaseOrderItems?.map((item) => {
        const fromIndent = Array.isArray((item as any)?.indentItemPOs)
          ? ((item as any).indentItemPOs?.length || 0) > 0
          : false;
        return {
          id: (item as any).id,
          itemId: item.itemId ?? 0,
          remark: item.remark ?? "",
          qty: toNum((item as any).qty),
          // Lock (disable item selection) only for rows that are actually linked to indent.
          // This keeps manually removed+readded rows editable.
          lockItem: indentLinkedEdit ? fromIndent : false,
          fromIndent,
        // normalize approved quantities: keep as numbers or undefined
        approved1Qty: isApprovalMode
          ? (toNum((item as any).approved1Qty) ?? toNum((item as any).qty) ?? undefined)
          : toNum((item as any).approved1Qty) ?? undefined,
        approved2Qty: isApproval2
          ? (toNum((item as any).approved2Qty) ??
              toNum((item as any).approved1Qty) ??
              toNum((item as any).qty) ??
              undefined)
          : toNum((item as any).approved2Qty) ?? undefined,
        rate: toNum((item as any).rate),
        discountPercent: toNum((item as any).discountPercent),
        cgstPercent: toNum((item as any).cgstPercent),
        sgstPercent: toNum((item as any).sgstPercent),
        igstPercent: toNum((item as any).igstPercent),
          amount: 0,
        };
      }) || [
        {
          itemId: 0,
          qty: undefined,
          rate: undefined,
          discountPercent: undefined,
          cgstPercent: undefined,
          sgstPercent: undefined,
          igstPercent: undefined,
          amount: 0,
          lockItem: false,
          fromIndent: false,
        },
      ],
    };
  }, [initial, isApprovalMode, isApproval2, mode]);

  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema) as unknown as Resolver<FormData>,
    defaultValues,
  });

  const { fields: chargeFields, append: appendCharge, remove: removeCharge } =
    useFieldArray({
      control: form.control,
      name: "poAdditionalCharges" as any,
      keyName: "fieldId",
    });

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "purchaseOrderItems",
    keyName: "fieldId",
  });

  useEffect(() => {
    // When generating from indent(s), let the indent prefill effect control resets entirely
    if (resolvedIndentIds.length > 0) return;
    if (!prefilledFromIndent) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form, prefilledFromIndent, resolvedIndentIds.length]);

  // Apply siteId coming from initial props (e.g., passed via query) immediately
  useEffect(() => {
    if (mode !== "create") return;
    const initialSiteId = Number(initial?.siteId ?? 0);
    if (initialSiteId > 0) {
      const currentSite = Number(form.getValues("siteId") || 0);
      if (currentSite !== initialSiteId) {
        form.setValue("siteId", initialSiteId as any, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        void form.trigger("siteId");
      }
    }
  }, [mode, initial?.siteId, form]);

  // Prefill site and items from indent(s) for new PO (single-shot, unconditional)
  useEffect(() => {
    if (mode !== "create" || prefilledFromIndent) return;
    if (resolvedIndentIds.length === 0) return;
    const singleReady = resolvedIndentIds.length === 1 && !!indentData;
    const multiReady = resolvedIndentIds.length > 1 && !!indentsBulkData;
    if (!singleReady && !multiReady) return;

    try {
      const indents: any[] = singleReady
        ? [((indentData as any).data ?? indentData)]
        : ((indentsBulkData as any)?.data?.data ?? (indentsBulkData as any)?.data ?? []);

      const cleanIndents = (indents || []).filter(Boolean);
      if (cleanIndents.length === 0) return;

      const siteIds = Array.from(
        new Set(
          cleanIndents
            .map((i: any) => Number(i?.siteId ?? i?.site?.id ?? 0))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        )
      );
      const computedSiteId = siteIds.length === 1 ? siteIds[0] : 0;

      // Collect indent items in FIFO: indentDate asc, then indentId asc, then indentItemId asc
      const fifoIndentItems: any[] = [];
      for (const ind of cleanIndents) {
        const itemsArr: any[] = Array.isArray(ind.indentItems) ? ind.indentItems : [];
        for (const it of itemsArr) {
          fifoIndentItems.push({
            indentId: Number(ind.id),
            indentDate: ind.indentDate,
            deliveryDate: ind.deliveryDate,
            siteId: Number(ind.siteId ?? ind.site?.id ?? 0),
            ...it,
          });
        }
      }
      fifoIndentItems.sort((a, b) => {
        const da = new Date(a.indentDate).getTime();
        const db = new Date(b.indentDate).getTime();
        if (da !== db) return da - db;
        const ia = Number(a.indentId || 0);
        const ib = Number(b.indentId || 0);
        if (ia !== ib) return ia - ib;
        return Number(a.id || 0) - Number(b.id || 0);
      });

      const toNum = (v: any) => {
        if (v === null || v === undefined || v === "") return 0;
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      // Compute remaining per indent item based on approved2Qty cap
      const remainingByIndentItemId = new Map<number, number>();
      for (const it of fifoIndentItems) {
        const cap = toNum(it?.approved2Qty);
        const already = Array.isArray(it?.indentItemPOs)
          ? it.indentItemPOs.reduce((s: number, x: any) => s + toNum(x?.orderedQty), 0)
          : 0;
        const remaining = Math.max(0, cap - already);
        remainingByIndentItemId.set(Number(it.id), remaining);
      }

      // Merge into PO rows by itemId, but keep allocations per itemId for FIFO split on submit
      const allocationsByItemId: Record<number, Array<{ indentItemId: number; qty: number }>> = {};
      const mergedQtyByItemId = new Map<number, number>();
      const remarkByItemId = new Map<number, string>();
      const sourcesCountByItemId = new Map<number, number>();

      for (const it of fifoIndentItems) {
        const itemId = Number(it?.itemId || 0);
        const indentItemId = Number(it?.id || 0);
        if (!itemId || !indentItemId) continue;

        const remaining = Number(remainingByIndentItemId.get(indentItemId) || 0);
        if (!(remaining > 0)) continue;

        if (!allocationsByItemId[itemId]) allocationsByItemId[itemId] = [];
        allocationsByItemId[itemId].push({ indentItemId, qty: remaining });

        sourcesCountByItemId.set(itemId, (sourcesCountByItemId.get(itemId) || 0) + 1);

        mergedQtyByItemId.set(itemId, (mergedQtyByItemId.get(itemId) || 0) + remaining);
        if (!remarkByItemId.has(itemId)) {
          remarkByItemId.set(itemId, String(it?.remark || ""));
        }
      }

      const mapped = Array.from(mergedQtyByItemId.entries()).map(([itemId, qty]) => {
        const sourcesCount = sourcesCountByItemId.get(itemId) || 0;
        const mergedFromMultipleIndents = resolvedIndentIds.length > 1 && sourcesCount > 1;
        return {
          itemId,
          remark: mergedFromMultipleIndents ? "" : remarkByItemId.get(itemId) || "",
          qty,
          rate: undefined,
          discountPercent: undefined,
          cgstPercent: undefined,
          sgstPercent: undefined,
          igstPercent: undefined,
          amount: 0,
          fromIndent: true,
        } as any;
      });

      setIndentAllocationsByItemId(allocationsByItemId);

      // Always ensure site is set if different/missing
      const currentSite = Number(form.getValues("siteId") || 0);
      if (computedSiteId > 0 && currentSite !== computedSiteId) {
        form.setValue("siteId", computedSiteId as any, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        void form.trigger("siteId");
      }

      // Prefill delivery date only for single-indent PO (multi-indent can have conflicting delivery dates)
      if (resolvedIndentIds.length === 1) {
        const computedDeliveryDate = formatDateField(cleanIndents?.[0]?.deliveryDate, undefined);
        const currentDeliveryDate = String(form.getValues("deliveryDate") || "");
        if (!currentDeliveryDate && computedDeliveryDate) {
          form.setValue("deliveryDate", computedDeliveryDate as any, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
          void form.trigger("deliveryDate");
        }
      }

      // Prefill items unconditionally once when indent data is ready
      if (mapped.length > 0) {
        replace(mapped as any);
        setPrefilledFromIndent(true);
      }
    } catch (e) {
      // ignore prefill errors
    }
  }, [mode, resolvedIndentIds, indentData, indentsBulkData, prefilledFromIndent, form, replace]);

  // Fallback: if site is still 0 after mount and indent is known, set it
  useEffect(() => {
    if (resolvedIndentIds.length !== 1) return;
    if (!indentData) return;
    try {
      const raw = (indentData as any).data ?? indentData;
      if (!raw) return;
      const computedSiteId = Number(raw?.siteId ?? raw?.site?.id ?? 0);
      const currentSite = Number(form.getValues("siteId") || 0);
      if (computedSiteId > 0 && currentSite === 0) {
        form.setValue("siteId", computedSiteId as any, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        void form.trigger("siteId");
      }
    } catch {}
  }, [resolvedIndentIds.length, indentData, form]);

  // useEffect(() => {
  //   if (isApprovalMode && typeof defaultValues.poStatus !== "undefined") {
  //     form.setValue("poStatus", defaultValues.poStatus ?? null, {
  //       shouldDirty: false,
  //       shouldTouch: false,
  //     });
  //   }
  // }, [defaultValues.poStatus, form, isApprovalMode]);

  const siteValue = form.watch("siteId");
  const items = form.watch("purchaseOrderItems");
  const vendorValue = form.watch("vendorId");
  const billingAddressValue = form.watch("billingAddressId");
  const siteDeliveryAddressValue = form.watch("siteDeliveryAddressId");
  const poStatusValue = form.watch("poStatus");
  const poAdditionalCharges = (form.watch("poAdditionalCharges") as any[]) || [];
  const { errors } = form.formState;

  const { data: siteDetailData } = useSWR<
    (Site & { siteDeliveryAddresses?: SiteDeliveryAddress[] }) | null
  >(
    siteValue && siteValue > 0 ? `/api/sites/${siteValue}` : null,
    siteValue && siteValue > 0 ? apiGet : null
  );

  const sites = sitesData?.data ?? [];
  const activeSiteId = Number(siteValue || 0);

  const currentSiteInList = sites.some((s) => s.id === activeSiteId);
  const currentSiteNameFromIndent =
    (indentData as any)?.data?.site?.site ??
    (indentData as any)?.site?.site ??
    undefined;
  const sitesForSelect =
    activeSiteId > 0 && !currentSiteInList
      ? [
          ...sites,
          {
            id: activeSiteId,
            site: currentSiteNameFromIndent || `Site #${activeSiteId}`,
          },
        ]
      : sites;
  const vendors = vendorsData?.data ?? [];
  const billingAddresses = billingAddressesData?.data ?? [];
  const siteDeliveryAddresses = siteDetailData?.siteDeliveryAddresses ?? [];
  const paymentTerms = paymentTermsData?.data ?? [];
  const itemOptions = itemsData?.data ?? [];

  const isFromIndent = resolvedIndentIds.length > 0;
  const isIndentLinkedEdit =
    isEdit &&
    Array.isArray((initial as any)?.purchaseOrderIndent) &&
    ((initial as any)?.purchaseOrderIndent?.length || 0) > 0;

  // Closing stock for items at selected site
  const selectedItemIds: number[] = (
    (isApprovalMode
      ? initial?.purchaseOrderItems?.map((it) => it.itemId)
      : items?.map((it) => Number((it as any)?.itemId))) || []
  ).filter(
    (n) => typeof n === "number" && Number.isFinite(n) && n > 0
  ) as number[];
  const itemIdsParam =
    selectedItemIds.length > 0 ? selectedItemIds.join(",") : null;
  const { data: closingStockData } = useSWR<any>(
    siteValue && siteValue > 0 && itemIdsParam
      ? `/api/inward-delivery-challans?variant=closing-stock&siteId=${siteValue}&itemIds=${itemIdsParam}`
      : null,
    apiGet
  );

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

  const decimalRegex2 = /^\d*(?:\.\d{0,2})?$/;
  const handleDecimalChange2 =
    (path: `purchaseOrderItems.${number}.${string}`) => (value: string) => {
      if (value === "" || decimalRegex2.test(value)) {
        form.setValue(path as any, value as any, { shouldDirty: true });
      }
    };

  const computeItemMetrics = (item: PurchaseOrderItemFormValue) => {
    // In approval 1 use approved1Qty; in approval 2 use approved2Qty; otherwise use qty
    const qty = isApproval2
      ? toNumber((item as any).approved2Qty)
      : isApproval1
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

  const gstRateFromChargeLabel = (label?: string | null): number => {
    if (label === "5%" || label === "5% Gst charge") return 5;
    if (label === "18%" || label === "18% Gst charge") return 18;
    return 0;
  };

  const computedCharges = poAdditionalCharges.map((c) => {
    const base = toNumber((c as any)?.amount);
    const r = base < 0 ? 0 : gstRateFromChargeLabel((c as any)?.gstCharge);
    const total = roundTo2(base + (base * r) / 100);
    return {
      head: String((c as any)?.head ?? ""),
      gstCharge: String((c as any)?.gstCharge ?? "N/A"),
      amount: base,
      amountWithGst: total,
    };
  });

  useEffect(() => {
    poAdditionalCharges.forEach((c, idx) => {
      const amt = toNumber((c as any)?.amount);
      const current = String((c as any)?.gstCharge ?? "N/A");
      if (amt < 0 && current !== "N/A") {
        form.setValue(`poAdditionalCharges.${idx}.gstCharge` as any, "N/A", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    });
  }, [form, poAdditionalCharges]);

  const additionalChargesTotal = computedCharges.reduce(
    (s, c) => roundTo2(s + c.amountWithGst),
    0
  );

  // Final totals including all additional charges
  const totals = {
    ...itemTotals,
    additionalChargesAmount: additionalChargesTotal,
    amount: roundTo2(
      itemTotals.amount +
        additionalChargesTotal
    ),
  };

  // Handle vendor change to update billing addresses
  // Add a new empty item row
  const addItem = () => {
    append({
      itemId: 0,
      qty: undefined,
      rate: undefined,
      discountPercent: undefined,
      cgstPercent: undefined,
      sgstPercent: undefined,
      igstPercent: undefined,
      lockItem: false,
    } as any);
  };

  // Remove an item row
  const removeItem = (index: number) => {
    if (fields.length === 1 && index === 0) {
      // Reset the only/top row to an empty default instead of removing all rows
      update(0, {
        id: undefined,
        itemId: 0,
        remark: "",
        qty: undefined,
        rate: undefined,
        discountPercent: undefined,
        cgstPercent: undefined,
        sgstPercent: undefined,
        igstPercent: undefined,
        amount: 0,
        lockItem: false,
        // Ensure it's no longer treated as sourced from indent
        ...(typeof (items?.[0] as any) === "object"
          ? { fromIndent: false }
          : {}),
      } as any);
      return;
    }
    remove(index);
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Clear any previous per-row errors before submitting
      for (let i = 0; i < items.length; i++) {
        const qtyField = isApprovalMode
          ? isApproval2
            ? "approved2Qty"
            : "approved1Qty"
          : "qty";
        const qtyPath = `purchaseOrderItems.${i}.${qtyField}` as const;
        form.clearErrors(qtyPath as any);
        const ratePath = `purchaseOrderItems.${i}.rate` as const;
        form.clearErrors(ratePath as any);
        const amountPath = `purchaseOrderItems.${i}.amount` as const;
        form.clearErrors(amountPath as any);
      }

      // Prepare the payload
      const normalizedItems = data.purchaseOrderItems.map((item, index) => {
        const metrics = computeItemMetrics(item);
        const originalItem = initial?.purchaseOrderItems?.[index];
        const approvedQty = metrics.qty;

        const baseItem = {
          ...(isEdit
            ? { id: (originalItem as any)?.id }
            : {}),
          itemId: Number(item.itemId),
          remark: item.remark?.trim() ? item.remark.trim() : null,
          qty: isApprovalMode ? approvedQty : metrics.qty,
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
          fromIndent: Boolean((item as any)?.fromIndent),
          indentItemId:
            (item as any)?.indentItemId &&
            Number((item as any).indentItemId) > 0
              ? Number((item as any).indentItemId)
              : undefined,
        };

        // Add approval-specific fields
        if (isApproval1) {
          return {
            ...baseItem,
            id: originalItem?.id,
            orderedQty:
              originalItem?.qty ??
              toNumber(item.qty) ??
              originalItem?.orderedQty ??
              undefined,
            approved1Qty: approvedQty,
            qty: approvedQty,
          };
        } else if (isApproval2) {
          return {
            ...baseItem,
            id: originalItem?.id,
            orderedQty:
              originalItem?.qty ??
              toNumber(item.qty) ??
              originalItem?.orderedQty ??
              undefined,
            approved1Qty:
              originalItem?.approved1Qty ??
              toNumber((item as any).approved1Qty),
            approved2Qty: approvedQty,
            qty: approvedQty,
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

      const additionalChargesNumeric = Array.isArray((data as any).poAdditionalCharges)
        ? (data as any).poAdditionalCharges.reduce((s: number, c: any) => {
            const base = toNumber(c?.amount);
            const r = base < 0 ? 0 : gstRateFromChargeLabel(c?.gstCharge);
            const total = roundTo2(base + (base * r) / 100);
            return roundTo2(s + total);
          }, 0)
        : 0;

      const finalAmount = roundTo2(
        headerTotals.amount + additionalChargesNumeric
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
        paymentTermIds: Array.isArray((data as any).paymentTermIds)
          ? Array.from(
              new Set(
                ((data as any).paymentTermIds as any[])
                  .map((v) => Number(v))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            )
          : [],
        paymentTermsInDays: data.paymentTermsInDays
          ? Number(data.paymentTermsInDays)
          : undefined,
        poStatus: data.poStatus ?? null,
        poAdditionalCharges: Array.isArray((data as any).poAdditionalCharges)
          ? ((data as any).poAdditionalCharges as any[])
              .map((c) => {
                const head = typeof c?.head === "string" ? c.head.trim() : "";
                const amount = toNumber(c?.amount);
                const gstChargeRaw =
                  typeof c?.gstCharge === "string" ? c.gstCharge : "N/A";
                const gstCharge = amount < 0 ? "N/A" : normalizeGstChargeLabel(gstChargeRaw);
                const r = amount < 0 ? 0 : gstRateFromChargeLabel(gstCharge);
                const amountWithGst = roundTo2(amount + (amount * r) / 100);
                return {
                  ...(isEdit ? { id: c?.id } : {}),
                  head,
                  gstCharge,
                  amount: c?.amount === "" ? null : amount,
                  amountWithGst,
                };
              })
              .filter(
                (c) =>
                  c.head ||
                  (typeof c.amount === "number" && c.amount !== 0)
              )
          : [],
        amount: finalAmount,
        totalCgstAmount: headerTotals.totalCgstAmount,
        totalSgstAmount: headerTotals.totalSgstAmount,
        totalIgstAmount: headerTotals.totalIgstAmount,
        purchaseOrderItems: normalizedItems,
      };

      // If this PO was generated from indents, attach the selected indentIds and per-item FIFO allocations
      if (mode === "create" && resolvedIndentIds.length > 0) {
        payload.indentIds = resolvedIndentIds;
        payload.indentAllocationsByItemId = indentAllocationsByItemId;
      }

      // Add statusAction for approval modes
      if (isApproval1) {
        payload.statusAction = "approve1";
      } else if (isApproval2) {
        payload.statusAction = "approve2";
      }

      // Submit the form
      const result =
        mode === "create"
          ? await apiPost(
              "/api/purchase-orders",
              indentId ? { ...payload, indentId } : payload
            )
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
      if (mutate) {
        await mutate();
      }
      if (onSuccess) {
        onSuccess(result);
      } else if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (error: any) {
      const msg =
        error && typeof error.message === "string"
          ? (error.message as string)
          : String(error);

      const cleaned = msg.replace(/^BAD_REQUEST:\s*/i, "");
      const sections = cleaned.split("|").map((s) => s.trim());
      let matchedAny = false;

      for (const section of sections) {
        const lower = section.toLowerCase();
        if (lower.includes("item limit exceeded")) {
          matchedAny = true;
          const arrowIdx = section.indexOf("->");
          const listStr =
            arrowIdx >= 0 ? section.substring(arrowIdx + 2).trim() : section;
          const parts = listStr
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          const nameToRatio = new Map<string, string>();
          for (const p of parts) {
            const cidx = p.indexOf(":");
            if (cidx > -1) {
              const name = p.substring(0, cidx).trim();
              const ratio = p.substring(cidx + 1).trim();
              if (name && ratio) nameToRatio.set(name, ratio);
            }
          }
          if (nameToRatio.size > 0) {
            for (let i = 0; i < items.length; i++) {
              const rowName = initial?.purchaseOrderItems?.[i]?.item?.item;
              const rowItemId = items?.[i]?.itemId;
              const ratio =
                (rowName && nameToRatio.get(rowName)) ||
                (rowItemId ? nameToRatio.get(String(rowItemId)) : undefined);
              if (ratio) {
                const fieldName = isApprovalMode
                  ? isApproval2
                    ? "approved2Qty"
                    : "approved1Qty"
                  : "qty";
                const path = `purchaseOrderItems.${i}.${fieldName}` as const;
                form.setError(path as any, { type: "manual", message: ratio });
              }
            }
          }
        }
        if (lower.includes("rate limit exceeded")) {
          matchedAny = true;
          const arrowIdx = section.indexOf("->");
          const listStr =
            arrowIdx >= 0 ? section.substring(arrowIdx + 2).trim() : section;
          const parts = listStr
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          const nameToRatio = new Map<string, string>();
          for (const p of parts) {
            const cidx = p.indexOf(":");
            if (cidx > -1) {
              const name = p.substring(0, cidx).trim();
              const ratio = p.substring(cidx + 1).trim();
              if (name && ratio) nameToRatio.set(name, ratio);
            }
          }
          for (let i = 0; i < items.length; i++) {
            const rowName = initial?.purchaseOrderItems?.[i]?.item?.item;
            const rowItemId = items?.[i]?.itemId;
            const ratio =
              (rowName && nameToRatio.get(rowName)) ||
              (rowItemId ? nameToRatio.get(String(rowItemId)) : undefined);
            if (ratio) {
              const path = `purchaseOrderItems.${i}.rate` as const;
              form.setError(path as any, { type: "manual", message: ratio });
            }
          }
        }
        if (lower.includes("value limit exceeded")) {
          matchedAny = true;
          const arrowIdx = section.indexOf("->");
          const listStr =
            arrowIdx >= 0 ? section.substring(arrowIdx + 2).trim() : section;
          const parts = listStr
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          const nameToRatio = new Map<string, string>();
          for (const p of parts) {
            const cidx = p.indexOf(":");
            if (cidx > -1) {
              const name = p.substring(0, cidx).trim();
              const ratio = p.substring(cidx + 1).trim();
              if (name && ratio) nameToRatio.set(name, ratio);
            }
          }
          for (let i = 0; i < items.length; i++) {
            const rowName = initial?.purchaseOrderItems?.[i]?.item?.item;
            const rowItemId = items?.[i]?.itemId;
            const ratio =
              (rowName && nameToRatio.get(rowName)) ||
              (rowItemId ? nameToRatio.get(String(rowItemId)) : undefined);
            if (ratio) {
              const path = `purchaseOrderItems.${i}.amount` as const;
              form.setError(path as any, { type: "manual", message: ratio });
            }
          }
        }
      }

      toast.error(msg || `Failed to ${mode} purchase order. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errs: unknown) => {
    try {
      console.group("[PurchaseOrderForm] Validation errors");
      console.log(errs);
      console.log("formState.errors:", form.formState.errors);
      console.groupEnd();
    } catch {
      // ignore
    }
  };

  // Handle vendor change
  const onVendorChange = (value: string) => {
    const nextVendor = value === "__none" ? 0 : parseInt(value, 10);
    form.setValue("vendorId", nextVendor);
    form.setValue("billingAddressId", 0);
  };

  // Format number input
  return (
    <Form {...form}>
      <AppCard className="w-full">
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
        <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          <AppCard.Content className="space-y-6">
            <FormSection legend="Purchase Order Details">
              <FormRow cols={3}>
                <div>
                <TextInput
                  control={form.control}
                  name="purchaseOrderNo"
                  label="PO No."
                  placeholder="Auto-generated"
                  disabled
                />
                </div>
                <div>
                <TextInput
                  control={form.control}
                  name="purchaseOrderDate"
                  label="PO Date"
                  type="date"
                  required={!isApprovalMode}
                  disabled={isApprovalMode}
                />
                </div>
                <div>
                <TextInput
                  control={form.control}
                  name="deliveryDate"
                  label="Delivery Date"
                  type="date"
                  required={!isApprovalMode}
                  disabled={isApprovalMode}
                />
                 </div>
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
                    disabled={isEdit || isApprovalMode || Boolean(resolvedIndentIds?.length)}
                  >
                    <AppSelect.Item key="site-none" value="__none">
                      Select Site
                    </AppSelect.Item>
                    {sitesForSelect.map((site) => (
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
                    PO Status
                  </label>
                  <AppSelect
                    value={poStatusValue ? poStatusValue : "OPEN"}
                    onValueChange={(value) => {
                      form.setValue("poStatus", value as any);
                    }}
                    placeholder="Select PO Status"
                  >
                    <AppSelect.Item value="OPEN">Open</AppSelect.Item>
                    <AppSelect.Item value="ORDER_PLACED">Order Placed</AppSelect.Item>
                    <AppSelect.Item value="IN_TRANSIT">In Transit</AppSelect.Item>
                    <AppSelect.Item value="RECEIVED">Received</AppSelect.Item>
                    <AppSelect.Item value="HOLD">Hold</AppSelect.Item>
                  </AppSelect>
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Vendor & Billing">
              <FormRow cols={3}>
            

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vendor<span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <FormField
                    control={form.control}
                    name={"vendorId" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <AppCombobox
                            value={field.value && field.value > 0 ? String(field.value) : "__none"}
                            onValueChange={(value) => {
                              const next = value === "__none" ? 0 : parseInt(value, 10);
                              field.onChange(next);
                              onVendorChange(value);
                            }}
                            options={[
                              { value: "__none", label: "Select Vendor" },
                              ...vendors.map((v) => ({
                                value: String(v.id),
                                label: v.vendorName,
                              })),
                            ]}
                            placeholder="Select Vendor"
                            searchPlaceholder="Search vendor..."
                            emptyText="No vendor found."
                            disabled={isApprovalMode}
                            className="overflow-hidden"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name={"billingAddressId" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <AppCombobox
                            value={field.value && field.value > 0 ? String(field.value) : "__none"}
                            onValueChange={(value) => {
                              const next = value === "__none" ? 0 : parseInt(value, 10);
                              field.onChange(next);
                            }}
                            options={[
                              { value: "__none", label: "Select Billing Address" },
                              ...billingAddresses.map((a) => ({
                                value: String(a.id),
                                label: formatBillingAddressLabel(a),
                              })),
                            ]}
                            placeholder="Select Billing Address"
                            searchPlaceholder="Search address..."
                            emptyText="No address found."
                            disabled={isApprovalMode}
                            className="overflow-hidden"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {errors.billingAddressId ? (
                    <p className="text-sm text-destructive mt-2">
                      {errors.billingAddressId.message as string}
                    </p>
                  ) : null}
                </div>
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
                    disabled={isApprovalMode}
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
              </FormRow>

              <FormRow cols={3}>
             

                <div>
                  <MultiSelectInput
                    control={form.control}
                    name={"paymentTermIds" as any}
                    label="Payment Terms"
                    placeholder="Select Payment Terms"
                    options={paymentTerms.map((t) => ({
                      value: String(t.id),
                      label: t.paymentTerm,
                    }))}
                    disabled={isApprovalMode}
                    size="sm"
                  />
                </div>
                  <div>
                <TextInput
                  control={form.control}
                  name="quotationNo"
                  label="Quotation No."
                  placeholder="Enter quotation number"
                  required={false}
                  disabled={isApprovalMode}
                />
                </div>
                <div>
                <TextInput
                  control={form.control}
                  name="quotationDate"
                  label="Quotation Date"
                  type="date"
                  required={false}
                  disabled={isApprovalMode}
                />
                </div>
              </FormRow>
            </FormSection>

            <FormSection legend="Logistics & Terms">
              <FormRow cols={3}>
                <div>
                <TextInput
                  control={form.control}
                  name="transport"
                  label="Transport"
                  placeholder="Enter transport"
                />
                </div>
                <div>
                <TextInput
                  control={form.control}
                  name="paymentTermsInDays"
                  label="Payment Terms (Days)"
                  type="number"
                  placeholder="Enter payment term in days"
                  min={0}
                  max={999}
                  disabled={isApprovalMode}
                />
                </div>
              </FormRow>
               <TextareaInput
                  control={form.control}
                  name="deliverySchedule"
                  label="Delivery Schedule"
                  
                  rows={2}
                  span={1}
                />
            </FormSection>

            <FormSection legend="Notes">
              <FormRow cols={2}>
                <div>
                <TextareaInput
                  control={form.control}
                  name="note"
                  label="Note"
   rows={4}
                  span={2}                />
                </div>
              </FormRow>
            </FormSection>

            {/* Items Table */}
            <FormSection legend="Items">
              <div className="w-full overflow-x-hidden rounded-md border border-black bg-card">
                <table className="w-full table-fixed border-collapse bg-white dark:bg-slate-900 text-[11px]">
                  <tbody>
                    {fields.map((field, index) => {
                      const colCount =
                        5 + (isApprovalMode ? 1 : 0) + (isApproval2 ? 1 : 0) + 1;
                      const amountColIndex = colCount - 2;
                      const actionsColIndex = colCount - 1;
                      const qtyLabel = isApproval2
                        ? "Approved 2 Qty"
                        : isApproval1
                        ? "Approved 1 Qty"
                        : "Qty";

                      const summaryLabelIndex = Math.max(0, amountColIndex - 1);

                      const emptyCells = (count: number) =>
                        Array.from({ length: count }).map((_, i) => (
                          <td
                            key={i}
                            className="border border-black px-1 py-1 align-top bg-white dark:bg-slate-900"
                          />
                        ));

                      return (
                        <Fragment key={field.fieldId ?? index}>
                        <tr>
                          <td className="border border-black px-1 py-2 align-top bg-white dark:bg-slate-900">
                            {isApprovalMode ? (
                              <>
                                <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                  Item
                                </div>
                                <div className="font-medium">
                                  {initial?.purchaseOrderItems?.[index]?.item
                                    ?.itemCode
                                    ? `${initial.purchaseOrderItems[index].item.itemCode} - ${initial.purchaseOrderItems[index].item.item}`
                                    : initial?.purchaseOrderItems?.[index]?.item
                                        ?.item || ""}
                                </div>
                                <div className="text-xs text-gray-900 dark:text-slate-100">
                                  Unit:{" "}
                                  {initial?.purchaseOrderItems?.[index]?.item
                                    ?.unit?.unitName || ""}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                  Item
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`purchaseOrderItems.${index}.itemId`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormControl>
                                        <AppCombobox
                                          value={
                                            field.value && field.value > 0
                                              ? String(field.value)
                                              : "__none"
                                          }
                                          onValueChange={(value) => {
                                            const next =
                                              value === "__none"
                                                ? 0
                                                : parseInt(value, 10);
                                            field.onChange(
                                              Number.isNaN(next) ? 0 : next
                                            );

                                            // Update rate if item is selected
                                            if (
                                              value !== "__none" &&
                                              itemOptions.length
                                            ) {
                                              form.setValue(
                                                `purchaseOrderItems.${index}.rate`,
                                                0
                                              );
                                            }
                                          }}
                                          options={[
                                            { value: "__none", label: "Select Item" },
                                            ...itemOptions.map((item) => ({
                                              value: String(item.id),
                                              label: item.item,
                                            })),
                                          ]}
                                          placeholder="Select Item"
                                          disabled={
                                            (items?.[index] as any)?.fromIndent === true ||
                                            (items?.[index] as any)?.lockItem === true
                                          }
                                          className="w-full max-w-full overflow-hidden truncate"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </>
                            )}
                            <div className="mt-2">
                              <div className="w-full mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                Discount
                              </div>
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.discountPercent`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                        onChange={(e) =>
                                          handleDecimalChange2(
                                            `purchaseOrderItems.${index}.discountPercent`
                                          )(e.target.value)
                                        }
                                        className="h-7 text-right w-full text-[11px]"
                                      />
                                    </FormControl>
                                    <div className="text-xs text-gray-900 dark:text-slate-100 text-left">
                                      Discount Amt:{" "}
                                      {formatAmount(
                                        computedItems[index]?.disAmt
                                      )}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </td>
                          {(() => {
                            const rowItemId = isApprovalMode
                              ? initial?.purchaseOrderItems?.[index]?.itemId
                              : (items?.[index] as any)?.itemId;
                            const closingMap =
                              (closingStockData &&
                                (closingStockData as any).closingStockByItemId) ||
                              {};
                            const closingVal =
                              typeof rowItemId === "number"
                                ? closingMap[rowItemId]
                                : undefined;
                            return (
                              <td className="border border-black px-1 py-2 text-right align-top bg-white dark:bg-slate-900">
                                <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                  Closing Stock Qty
                                </div>
                                <div className="w-full">
                                  <Input
                                    readOnly
                                    tabIndex={-1}
                                    value={
                                      typeof closingVal === "number"
                                        ? String(closingVal)
                                        : ""
                                    }
                                    placeholder="-"
                                    className="h-7 text-right w-full text-[11px]"
                                  />
                                </div>
                                <div className="mt-2">
                                  <FormField
                                    control={form.control}
                                    name={`purchaseOrderItems.${index}.cgstPercent`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <div className="w-full mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                          CGST
                                        </div>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            {...field}
                                            value={typeof field.value === "string" ? field.value : field.value?.toString() || ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                                field.onChange(v);
                                              }
                                            }}
                                            className="h-7 text-right w-full text-[11px]"
                                          />
                                        </FormControl>
                                        <div className="text-xs text-gray-900 dark:text-slate-100 text-left">
                                          CGST Amt:{" "}
                                          {formatAmount(
                                            computedItems[index]?.cgstAmt
                                          )}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </td>
                            );
                          })()}

                          {isApprovalMode && (
                            <td className="border border-black px-1 py-2 text-right font-medium align-top bg-white dark:bg-slate-900">
                              <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                Ordered Qty
                              </div>
                              {toNumber(
                                initial?.purchaseOrderItems?.[index]
                                  ?.orderedQty ??
                                  initial?.purchaseOrderItems?.[index]?.qty ??
                                  0
                              ).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          )}

                          {isApproval2 && (
                            <td className="border border-black px-1 py-2 text-right font-medium align-top bg-white dark:bg-slate-900">
                              <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                Approved 1 Qty
                              </div>
                              {toNumber(
                                (items[index] as any)?.approved1Qty ??
                                  initial?.purchaseOrderItems?.[index]
                                    ?.approved1Qty ??
                                  initial?.purchaseOrderItems?.[index]?.qty ??
                                  0
                              ).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          )}

                          <td className="border border-black px-1 py-2 align-top bg-white dark:bg-slate-900">
                            <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                              {qtyLabel}
                            </div>
                            {isApproval1 ? (
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.approved1Qty`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={
                                          typeof field.value === "string"
                                            ? field.value
                                            : field.value?.toString() || ""
                                        }
                                        onChange={(e) =>
                                          handleDecimalChange2(
                                            `purchaseOrderItems.${index}.approved1Qty`
                                          )(e.target.value)
                                        }
                                        className="h-7 text-right w-full text-[11px]"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ) : isApproval2 ? (
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.approved2Qty`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={
                                          typeof field.value === "string"
                                            ? field.value
                                            : field.value?.toString() || ""
                                        }
                                        onChange={(e) =>
                                          handleDecimalChange2(
                                            `purchaseOrderItems.${index}.approved2Qty`
                                          )(e.target.value)
                                        }
                                        className="h-7 text-right w-full text-[11px]"
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
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={
                                          typeof field.value === "string"
                                            ? field.value
                                            : field.value?.toString() || ""
                                        }
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                            field.onChange(v);
                                          }
                                        }}
                                        className="h-7 text-right w-full text-[11px]"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                            <div className="mt-1">
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.sgstPercent`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <div className="w-full mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                      SGST
                                    </div>
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={
                                          typeof field.value === "string"
                                            ? field.value
                                            : field.value?.toString() || ""
                                        }
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                            field.onChange(v);
                                          }
                                        }}
                                        className="h-7 text-right w-full text-[11px]"
                                      />
                                    </FormControl>
                                    <div className="text-xs text-gray-900 dark:text-slate-100 text-left">
                                      SGST Amt:{" "}
                                      {formatAmount(computedItems[index]?.sgstAmt)}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </td>

                          <td className="border border-black px-1 py-2 align-top bg-white dark:bg-slate-900">
                            <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                              Rate
                            </div>
                            <FormField
                              control={form.control}
                              name={`purchaseOrderItems.${index}.rate`}
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormControl>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      {...field}
                                      value={
                                        typeof field.value === "string"
                                          ? field.value
                                          : field.value?.toString() || ""
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                          field.onChange(v);
                                        }
                                      }}
                                      className="h-7 text-right w-full text-[11px]"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="mt-1">
                              <FormField
                                control={form.control}
                                name={`purchaseOrderItems.${index}.igstPercent`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <div className="w-full mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                                      IGST
                                    </div>
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        {...field}
                                        value={
                                          typeof field.value === "string"
                                            ? field.value
                                            : field.value?.toString() || ""
                                        }
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === "" || /^\d*(?:\.\d{0,2})?$/.test(v)) {
                                            field.onChange(v);
                                          }
                                        }}
                                        className="h-7 text-right w-full text-[11px]"
                                      />
                                    </FormControl>
                                    <div className="text-xs text-gray-900 dark:text-slate-100 text-left">
                                      IGST Amt:{" "}
                                      {formatAmount(computedItems[index]?.igstAmt)}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </td>

                          <td className="border border-black px-1 py-2 text-right text-[11px] font-medium align-top bg-white dark:bg-slate-900">
                            <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                              Amount
                            </div>
                            <FormField
                              control={form.control}
                              name={`purchaseOrderItems.${index}.amount`}
                              render={() => (
                                <FormItem className="space-y-1">
                                  <div>
                                    {formatAmount(computedItems[index]?.amount)}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          <td className="border border-black px-0 py-2 text-right align-top bg-white dark:bg-slate-900 w-10">
                            <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                              #
                            </div>
                            {!isApprovalMode ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>

                        <tr>
                          <td className="border border-black px-1 py-2 align-top bg-white dark:bg-slate-900">
                            <div className="mb-1 text-xs font-medium text-gray-900 dark:text-slate-100 text-left leading-none">
                              Remarks
                            </div>
                            <FormField
                              control={form.control}
                              name={`purchaseOrderItems.${index}.remark`}
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Remarks"
                                      value={field.value || ""}
                                      className="h-7 text-[11px] w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          {emptyCells(colCount - 1)}
                        </tr>

                        {index === fields.length - 1 && (
                          <>
                            <tr>
                              {Array.from({ length: colCount }).map((_, i) => {
                                if (i === 0) {
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-2 align-top bg-white dark:bg-slate-900"
                                    >
                                      {!isApprovalMode ? (
                                        <Button
                                          type="button"
                                          onClick={addItem}
                                          className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      ) : null}
                                    </td>
                                  );
                                }
                                if (i === summaryLabelIndex) {
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-2 text-right font-medium bg-white dark:bg-slate-900"
                                    >
                                      Subtotal
                                    </td>
                                  );
                                }
                                if (i === amountColIndex) {
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-2 text-right font-medium bg-white dark:bg-slate-900"
                                    >
                                      {formatAmount(totals.taxableAmount)}
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={i}
                                    className="border border-black px-1 py-2 bg-white dark:bg-slate-900"
                                  />
                                );
                              })}
                            </tr>

                            {(
                              [
                                { label: "Discount", value: formatAmount(totals.disAmt) },
                                { label: "CGST", value: formatAmount(totals.cgstAmt) },
                                { label: "SGST", value: formatAmount(totals.sgstAmt) },
                                { label: "IGST", value: formatAmount(totals.igstAmt) },
                              ] as const
                            ).map((r) => (
                              <tr key={r.label}>
                                {Array.from({ length: colCount }).map((_, i) => {
                                  if (i === summaryLabelIndex) {
                                    return (
                                      <td
                                        key={i}
                                        className="border border-black px-1 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900"
                                      >
                                        {r.label}
                                      </td>
                                    );
                                  }
                                  if (i === amountColIndex) {
                                    return (
                                      <td
                                        key={i}
                                        className="border border-black px-1 py-1 text-right text-[11px] font-medium text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-900"
                                      >
                                        {r.value}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-1 bg-white dark:bg-slate-900"
                                    />
                                  );
                                })}
                              </tr>
                            ))}

                            <>
                              {chargeFields.map((f, idx) => {
                                const row = computedCharges[idx];
                                return (
                                  <tr key={(f as any).fieldId}>
                                    {Array.from({ length: colCount }).map((_, i) => {
                                      if (i === 0) {
                                        return (
                                          <td
                                            key={i}
                                            className="border border-black px-1 py-1 align-top bg-white dark:bg-slate-900"
                                          >
                                            <div className="mb-1 text-[10px] font-medium text-gray-900 dark:text-slate-100 leading-none">
                                              Head
                                            </div>
                                            <Input
                                              value={String(
                                                (poAdditionalCharges?.[idx] as any)?.head ?? ""
                                              )}
                                              onChange={(e) =>
                                                form.setValue(
                                                  `poAdditionalCharges.${idx}.head` as any,
                                                  e.target.value
                                                )
                                              }
                                              placeholder="Head"
                                              className="h-7 text-[11px] w-full bg-white"
                                            />
                                          </td>
                                        );
                                      }
                                      if (i === 1) {
                                        return (
                                          <td
                                            key={i}
                                            className="border border-black px-1 py-1 align-top bg-white dark:bg-slate-900"
                                          >
                                            <div className="mb-1 text-[10px] font-medium text-gray-900 dark:text-slate-100 leading-none">
                                              GST
                                            </div>
                                            <AppSelect
                                              className="w-full"
                                              triggerClassName="h-7 text-[11px]"
                                              value={
                                                (poAdditionalCharges?.[idx] as any)?.gstCharge ||
                                                "N/A"
                                              }
                                              disabled={
                                                toNumber(
                                                  (poAdditionalCharges?.[idx] as any)?.amount
                                                ) < 0
                                              }
                                              onValueChange={(value) => {
                                                form.setValue(
                                                  `poAdditionalCharges.${idx}.gstCharge` as any,
                                                  value
                                                );
                                              }}
                                              placeholder="GST Charge"
                                            >
                                              <AppSelect.Item
                                                key={`gst-na-${idx}`}
                                                value="N/A"
                                              >
                                                N/A
                                              </AppSelect.Item>
                                              <AppSelect.Item
                                                key={`gst-5-${idx}`}
                                                value="5%"
                                              >
                                                5%
                                              </AppSelect.Item>
                                              <AppSelect.Item
                                                key={`gst-18-${idx}`}
                                                value="18%"
                                              >
                                                18%
                                              </AppSelect.Item>
                                            </AppSelect>
                                          </td>
                                        );
                                      }
                                      if (i === summaryLabelIndex) {
                                        return (
                                          <td
                                            key={i}
                                            className="border border-black px-1 py-1 align-top bg-white dark:bg-slate-900"
                                          >
                                            <div className="mb-1 text-[10px] font-medium text-gray-900 dark:text-slate-100 leading-none">
                                              Amount
                                            </div>
                                            <Input
                                              value={
                                                (poAdditionalCharges?.[idx] as any)?.amount ===
                                                  null ||
                                                (poAdditionalCharges?.[idx] as any)?.amount ===
                                                  undefined
                                                  ? ""
                                                  : String(
                                                      (poAdditionalCharges?.[idx] as any)
                                                        ?.amount
                                                    )
                                              }
                                              inputMode="decimal"
                                              onChange={(event) => {
                                                const v = event.target.value;
                                                if (
                                                  v === "" ||
                                                  v === "-" ||
                                                  /^-?\d*(?:\.\d{0,2})?$/.test(v)
                                                ) {
                                                  form.setValue(
                                                    `poAdditionalCharges.${idx}.amount` as any,
                                                    v
                                                  );
                                                }
                                              }}
                                              type="text"
                                              placeholder="Amount"
                                              className="h-7 text-[11px] text-right w-full bg-white"
                                            />
                                          </td>
                                        );
                                      }
                                      if (i === amountColIndex) {
                                        return (
                                          <td
                                            key={i}
                                            className="border border-black px-1 py-1 text-right font-medium bg-white dark:bg-slate-900"
                                          >
                                            <div className="mb-1 text-[10px] font-medium text-gray-900 dark:text-slate-100 leading-none text-left">
                                              Total
                                            </div>
                                            {formatAmount(row?.amountWithGst ?? 0)}
                                          </td>
                                        );
                                      }
                                      if (i === actionsColIndex) {
                                        return (
                                          <td
                                            key={i}
                                            className="border border-black px-0 py-1 align-top bg-white dark:bg-slate-900 w-10"
                                          >
                                            <div className="flex justify-end">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeCharge(idx)}
                                                className="h-7 w-7 p-0 text-red-600 hover:text-red-800"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td
                                          key={i}
                                          className="border border-black px-1 py-1 bg-white dark:bg-slate-900"
                                        />
                                      );
                                    })}
                                  </tr>
                                );
                              })}

                              <tr>
                                {Array.from({ length: colCount }).map((_, i) => {
                                  if (i === 0) {
                                    return (
                                      <td
                                        key={i}
                                        className="border border-black px-1 py-1 align-top bg-white dark:bg-slate-900"
                                      >
                                        <Button
                                          type="button"
                                          onClick={() =>
                                            appendCharge({
                                              head: "",
                                              gstCharge: "N/A",
                                              amount: "",
                                            } as any)
                                          }
                                          className="h-7 px-2 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          Add Charge
                                        </Button>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-1 bg-white dark:bg-slate-900"
                                    />
                                  );
                                })}
                              </tr>
                            </>

                            <tr>
                              {Array.from({ length: colCount }).map((_, i) => {
                                if (i === summaryLabelIndex) {
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-2 text-right text-[11px] font-bold text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                                    >
                                      Total Amount
                                    </td>
                                  );
                                }
                                if (i === amountColIndex) {
                                  return (
                                    <td
                                      key={i}
                                      className="border border-black px-1 py-2 text-right text-[11px] font-bold text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                                    >
                                      {formatAmount(totals.amount)}
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={i}
                                    className="border border-black px-1 py-2 bg-white dark:bg-slate-900"
                                  />
                                );
                              })}
                            </tr>
                          </>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  </table>
              </div>

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
// fix purchase order ui