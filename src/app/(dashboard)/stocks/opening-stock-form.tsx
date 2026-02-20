"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common";
import { AppSelect } from "@/components/common/app-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/lib/toast";
import { apiGet, apiPost } from "@/lib/api-client";
import { Plus, Trash2 } from "lucide-react";
import { ComboboxInput } from "@/components/common/combobox-input";

// Minimal types for SWR responses
type SiteOption = { id: number; site: string };
interface SitesResponse {
  data: SiteOption[];
}

interface ItemOption {
  id: number;
  itemCode?: string | null;
  item: string;
  isExpiryDate?: boolean | null;
  unit?: { unitName: string } | null;
}
interface ItemsResponse {
  data: ItemOption[];
}

type SiteItemBatchOption = {
  id: number;
  itemId?: number;
  batchNumber: string;
  expiryDate: string;
  openingQty?: number;
  batchOpeningRate?: number;
  openingValue?: number;
};
interface SiteItemBatchesResponse {
  data: SiteItemBatchOption[];
}

function sanitizeDecimal2(raw: string): string {
  const s = String(raw ?? "");
  if (s === "") return "";
  const cleaned = s.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const intPart = (parts[0] || "").replace(/^0+(?=\d)/, "0");
  if (parts.length === 1) return intPart;
  const frac = (parts[1] || "").slice(0, 2);
  return `${intPart}.${frac}`;
}

const batchSchema = z
  .object({
    batchNumber: z.string().min(1, "Batch number is required"),
    expiryDate: z
      .string()
      .min(1, "Expiry date is required")
      .regex(/^\d{4}-\d{2}$/, "Expiry date must be in YYYY-MM format"),
    openingQty: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine((v) => Number.isFinite(v) && v >= 0, "Opening qty must be >= 0"),
    batchOpeningRate: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine(
        (v) => Number.isFinite(v) && v >= 0,
        "Batch opening rate must be >= 0"
      ),
    openingValue: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine((v) => Number.isFinite(v) && v >= 0, "Opening value must be >= 0"),
  })
  .superRefine((row, ctx) => {
    const qty = row.openingQty;
    const rate = row.batchOpeningRate;
    if (qty === 0 && rate === 0) return;
    if (qty > 0 && rate > 0) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [qty === 0 ? "openingQty" : "batchOpeningRate"],
      message: "Qty and rate must both be 0, or both be greater than 0",
    });
  });

const detailSchema = z
  .object({
    itemId: z
      .union([z.string(), z.number()])
      .transform((v) => String(v))
      .refine(
        (v) => v !== "__none" && v !== "" && v !== "0",
        "Item is required"
      )
      .transform((v) => parseInt(v)),
    openingStock: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine((v) => Number.isFinite(v) && v >= 0, "Opening stock must be >= 0"),
    openingRate: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine((v) => Number.isFinite(v) && v >= 0, "Opening rate must be >= 0"),
    openingValue: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
      .refine((v) => Number.isFinite(v) && v >= 0, "Opening value must be >= 0"),
    batches: z.array(batchSchema).optional(),
  })
  .superRefine((row, ctx) => {
    const qty = row.openingStock;
    const rate = row.openingRate;
    if (qty === 0 && rate === 0) return;
    if (qty > 0 && rate > 0) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [qty === 0 ? "openingStock" : "openingRate"],
      message: "Qty and rate must both be 0, or both be greater than 0",
    });
  });

const createSchema = z.object({
  siteId: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseInt(v) : v))
    .refine((v) => Number.isFinite(v) && v > 0, "Site is required"),
  details: z.array(detailSchema).optional(),
});

// Raw form data type before zod transforms
type FormData = {
  siteId: string | number;
  details: {
    itemId: string | number;
    openingStock: string | number;
    openingRate: string | number;
    openingValue: string | number;
    batches?: {
      batchNumber: string;
      expiryDate: string;
      openingQty: string | number;
      batchOpeningRate: string | number;
      openingValue: string | number;
    }[];
  }[];
};

function ExpiryBatchesEditor({
  form,
  detailIndex,
  siteId,
  itemId,
}: {
  form: any;
  detailIndex: number;
  siteId: string | number | undefined;
  itemId: string | number | undefined;
}) {
  const control = form.control;

  const siteIdNum = Number(String(siteId || "").trim());
  const itemIdNum = Number(String(itemId || "").trim());

  const canFetch = Number.isFinite(siteIdNum) && siteIdNum > 0 && Number.isFinite(itemIdNum) && itemIdNum > 0;
  const { data: batchesData } = useSWR<SiteItemBatchesResponse>(
    canFetch ? `/api/site-item-batches?siteId=${siteIdNum}&itemId=${itemIdNum}` : null,
    apiGet
  );

  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.batches` as any,
  });

  const watchedBatches = useWatch({
    control,
    name: `details.${detailIndex}.batches` as any,
  }) as any[] | undefined;

  const byBatchNo = useMemo(() => {
    const m = new Map<string, SiteItemBatchOption>();
    (batchesData?.data || []).forEach((b) => {
      if (b?.batchNumber) m.set(String(b.batchNumber), b);
    });
    return m;
  }, [batchesData?.data]);

  function addBatchRow() {
    append({
      batchNumber: "",
      expiryDate: "",
      openingQty: "",
      batchOpeningRate: "",
      openingValue: "",
    } as any);
  }

  function onQtyRateChange(batchIndex: number) {
    const qtyRaw = String(
      form.getValues(`details.${detailIndex}.batches.${batchIndex}.openingQty`) ?? ""
    ).trim();
    const rateRaw = String(
      form.getValues(`details.${detailIndex}.batches.${batchIndex}.batchOpeningRate`) ?? ""
    ).trim();
    const qty = qtyRaw === "" ? NaN : parseFloat(qtyRaw);
    const rate = rateRaw === "" ? NaN : parseFloat(rateRaw);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
      const val = (qty * rate).toFixed(2);
      form.setValue(`details.${detailIndex}.batches.${batchIndex}.openingValue`, val, {
        shouldDirty: true,
        shouldValidate: false,
      });
    } else {
      form.setValue(`details.${detailIndex}.batches.${batchIndex}.openingValue`, "", {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }

  useEffect(() => {
    const rows = Array.isArray(watchedBatches) ? watchedBatches : [];
    let totalQty = 0;
    let totalValue = 0;
    for (const r of rows) {
      const qty = Number(String(r?.openingQty ?? "").trim());
      const rate = Number(String(r?.batchOpeningRate ?? "").trim());
      if (Number.isFinite(qty) && qty > 0) {
        totalQty += qty;
        if (Number.isFinite(rate) && rate > 0) totalValue += qty * rate;
      }
    }
    const avgRate = totalQty > 0 ? totalValue / totalQty : 0;

    form.setValue(`details.${detailIndex}.openingStock`, totalQty > 0 ? String(totalQty) : "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue(`details.${detailIndex}.openingRate`, avgRate > 0 ? avgRate.toFixed(2) : "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue(
      `details.${detailIndex}.openingValue`,
      totalValue > 0 ? totalValue.toFixed(2) : "",
      {
        shouldDirty: true,
        shouldValidate: false,
      }
    );
  }, [watchedBatches, form, detailIndex]);

  useEffect(() => {
    if (fields.length === 0) addBatchRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2 text-sm">Batch Number *</th>
              <th className="text-left p-2 text-sm">Expiry Date *</th>
              <th className="text-left p-2 text-sm">Opening Qty *</th>
              <th className="text-left p-2 text-sm">Batch Opening Rate *</th>
              <th className="text-left p-2 text-sm">Opening Value *</th>
              <th className="text-center p-2 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, batchIndex) => (
              <tr key={f.id} className="border-t">
                <td className="p-2 min-w-[220px]">
                  <FormField
                    control={control}
                    name={`details.${detailIndex}.batches.${batchIndex}.batchNumber`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as any}
                            type="text"
                            className="text-sm"
                            onChange={(e) => {
                              field.onChange(e);
                              const v = String(e.target.value || "").trim();
                              const meta = byBatchNo.get(v);
                              if (meta?.expiryDate) {
                                const raw = String(meta.expiryDate);
                                const yyyyMm = raw.length >= 7 ? raw.slice(0, 7) : raw;
                                form.setValue(
                                  `details.${detailIndex}.batches.${batchIndex}.expiryDate`,
                                  yyyyMm,
                                  { shouldDirty: true, shouldValidate: false }
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 min-w-[160px]">
                  <FormField
                    control={control}
                    name={`details.${detailIndex}.batches.${batchIndex}.expiryDate`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as any}
                            type="month"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 min-w-[140px]">
                  <FormField
                    control={control}
                    name={`details.${detailIndex}.batches.${batchIndex}.openingQty`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as any}
                            type="text"
                            inputMode="decimal"
                            onChange={(e) => {
                              field.onChange(sanitizeDecimal2(e.target.value));
                              onQtyRateChange(batchIndex);
                            }}
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 min-w-[140px]">
                  <FormField
                    control={control}
                    name={`details.${detailIndex}.batches.${batchIndex}.batchOpeningRate`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as any}
                            type="text"
                            inputMode="decimal"
                            onChange={(e) => {
                              field.onChange(sanitizeDecimal2(e.target.value));
                              onQtyRateChange(batchIndex);
                            }}
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 min-w-[160px]">
                  <FormField
                    control={control}
                    name={`details.${detailIndex}.batches.${batchIndex}.openingValue`}
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value as any}
                            type="number"
                            step="0.01"
                            className="text-sm"
                            disabled
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </td>
                <td className="p-2 text-center min-w-[80px]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(batchIndex)}
                    disabled={fields.length <= 1}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="p-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBatchRow}
                  className="gap-2 h-8"
                >
                  <Plus className="h-3 w-3" />
                  <span className="text-sm">Add Batch</span>
                </Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function OpeningStockForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const siteIdFromQuery = sp?.get("siteId");

  const form = useForm<FormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      siteId: siteIdFromQuery ? siteIdFromQuery : "__none",
      details: [
        {
          itemId: "__none",
          openingStock: "",
          openingRate: "",
          openingValue: "",
        },
      ],
    },
  });
  const watchSiteId = form.watch("siteId");

  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=200",
    apiGet
  );
  const { data: itemsData } = useSWR<ItemsResponse>(
    "/api/items/options?all=true",
    apiGet
  );
  const mountTs = useRef<number>(Date.now());
  const { data: siteItemsData } = useSWR<any>(
    () => {
      const effectiveSiteId =
        siteIdFromQuery ||
        (watchSiteId && watchSiteId !== "__none" ? watchSiteId : undefined);
      return effectiveSiteId
        ? `/api/site-items?siteId=${String(effectiveSiteId)}&ts=${
            mountTs.current
          }`
        : null;
    },
    apiGet,
    { revalidateOnMount: true, revalidateIfStale: true, dedupingInterval: 0 }
  );

  const effectiveSiteIdForBatches = siteIdFromQuery || (watchSiteId && watchSiteId !== "__none" ? watchSiteId : undefined);
  const { data: siteBatchesData } = useSWR<any>(
    () =>
      effectiveSiteIdForBatches
        ? `/api/site-item-batches?siteId=${String(effectiveSiteIdForBatches)}&ts=${mountTs.current}`
        : null,
    apiGet,
    { revalidateOnMount: true, revalidateIfStale: true, dedupingInterval: 0 }
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  });

  const prefilledSiteRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = String(watchSiteId || siteIdFromQuery || "");
    if (!siteKey || siteKey === "__none") return;
    if (prefilledSiteRef.current === siteKey) return;
    const rows: any[] = Array.isArray(siteItemsData?.data)
      ? siteItemsData!.data
      : [];
    if (rows.length === 0) return;

    if (!siteBatchesData) return;

    const batchRows: any[] = Array.isArray(siteBatchesData?.data) ? siteBatchesData!.data : [];
    const batchesByItemId = new Map<string, any[]>();
    for (const b of batchRows) {
      const key = String(b?.itemId ?? "");
      if (!key) continue;
      const arr = batchesByItemId.get(key) || [];
      arr.push(b);
      batchesByItemId.set(key, arr);
    }

    const details = rows.map((si: any) => {
      const itemKey = String(si.itemId);
      const batches = (batchesByItemId.get(itemKey) || []).map((b: any) => ({
        batchNumber: String(b.batchNumber ?? ""),
        expiryDate: String(b.expiryDate ?? "").slice(0, 7),
        openingQty: b.openingQty !== undefined && b.openingQty !== null ? String(b.openingQty) : "",
        batchOpeningRate:
          b.batchOpeningRate !== undefined && b.batchOpeningRate !== null
            ? String(b.batchOpeningRate)
            : "",
        openingValue: b.openingValue !== undefined && b.openingValue !== null ? String(b.openingValue) : "",
      }));

      return {
        itemId: String(si.itemId),
        openingStock:
          si.openingStock !== undefined && si.openingStock !== null
            ? String(si.openingStock)
            : "",
        openingRate:
          si.openingRate !== undefined && si.openingRate !== null
            ? String(si.openingRate)
            : "",
        openingValue:
          si.openingValue !== undefined && si.openingValue !== null
            ? String(si.openingValue)
            : "",
        batches: batches.length > 0 ? batches : [],
      };
    });
    form.reset({ siteId: form.getValues("siteId"), details });
    prefilledSiteRef.current = siteKey;
  }, [siteItemsData, siteBatchesData, watchSiteId, siteIdFromQuery]);

  function addRow() {
    append({
      itemId: "__none",
      openingStock: "",
      openingRate: "",
      openingValue: "",
      batches: [],
    });
  }

  function onQtyRateChange(index: number) {
    const qtyRaw = String(
      form.getValues(`details.${index}.openingStock`) ?? ""
    ).trim();
    const rateRaw = String(
      form.getValues(`details.${index}.openingRate`) ?? ""
    ).trim();
    const qty = qtyRaw === "" ? NaN : parseFloat(qtyRaw);
    const rate = rateRaw === "" ? NaN : parseFloat(rateRaw);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
      const val = (qty * rate).toFixed(2);
      form.setValue(`details.${index}.openingValue`, val, {
        shouldDirty: true,
        shouldValidate: false,
      });
    } else {
      form.setValue(`details.${index}.openingValue`, "", {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }

  function isExpiryItem(detailIndex: number): boolean {
    const selectedId = String(form.watch(`details.${detailIndex}.itemId`) || "");
    if (!selectedId || selectedId === "__none") return false;
    const selected = (itemsData?.data || []).find((it) => String(it.id) === selectedId);
    return Boolean(selected?.isExpiryDate);
  }

  async function onSubmit(values: FormData) {
    try {
      const payload = createSchema.parse(values);
      const res = await apiPost("/api/stocks", payload);
      toast.success("Opening stock saved");
      router.push("/stocks");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save opening stock");
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Add Opening Stock</AppCard.Title>
        <AppCard.Description>
          Create opening balances for a site's items.
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={String(field.value || "__none")}
                        onValueChange={field.onChange}
                        disabled={!!siteIdFromQuery}
                      >
                        <AppSelect.Item value="__none">
                          Select Site
                        </AppSelect.Item>
                        {sitesData?.data?.map((s) => (
                          <AppSelect.Item key={s.id} value={String(s.id)}>
                            {s.site}
                          </AppSelect.Item>
                        ))}
                      </AppSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Opening stock details
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 text-sm">Item *</th>
                    <th className="text-left p-2 text-sm">Opening Stock *</th>
                    <th className="text-left p-2 text-sm">Opening Rate *</th>
                    <th className="text-left p-2 text-sm">Opening Value *</th>
                    <th className="text-center p-2 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, index) => (
                    <Fragment key={f.id}>
                      <tr className="border-t">
                        <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`details.${index}.itemId`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                {(() => {
                                  const rows = form.getValues("details") || [];
                                  const usedIds = new Set<string>(
                                    rows
                                      .map((r: any, i: number) =>
                                        i !== index
                                          ? String(r?.itemId || "")
                                          : ""
                                      )
                                      .filter(
                                        (v: string) => !!v && v !== "__none"
                                      )
                                  );
                                  const options = (itemsData?.data || [])
                                    .filter((it) => !usedIds.has(String(it.id)))
                                    .map((it) => ({
                                      value: String(it.id),
                                      label: it.item,
                                    }));
                                  return (
                                    <ComboboxInput
                                      control={form.control as any}
                                      name={`details.${index}.itemId`}
                                      inputClassName="w-full h-8 px-2 truncate"
                                      placeholder="Select item"
                                      options={options}
                                    />
                                  );
                                })()}
                              </FormControl>
                              {(() => {
                                const selectedId = String(
                                  form.watch(`details.${index}.itemId`) || ""
                                );
                                if (!selectedId || selectedId === "__none")
                                  return null;
                                const selected = (itemsData?.data || []).find(
                                  (it) => String(it.id) === selectedId
                                );
                                const unitName = selected?.unit?.unitName;
                                return unitName ? (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Unit: {unitName}
                                  </div>
                                ) : null;
                              })()}
                              {/* <FormMessage className="text-xs" /> */}
                            </FormItem>
                          )}
                        />
                        </td>
                        <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`details.${index}.openingStock`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value as any}
                                  type="text"
                                  inputMode="decimal"
                                  onChange={(e) => {
                                    field.onChange(sanitizeDecimal2(e.target.value));
                                    onQtyRateChange(index);
                                  }}
                                  className="text-sm"
                                  disabled={isExpiryItem(index)}
                                />
                              </FormControl>
                              {(() => {
                                const itemId = String(
                                  form.watch(`details.${index}.itemId`) || ""
                                );
                                if (!itemId || itemId === "__none") return null;
                                const si = (siteItemsData?.data || []).find(
                                  (d: any) => String(d.itemId) === itemId
                                );
                                const v =
                                  typeof si?.closingStock === "number"
                                    ? si.closingStock
                                    : 0;
                                return (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Closing Qty: {v}
                                  </div>
                                );
                              })()}
                              <FormMessage className="text-sm" />
                            </FormItem>
                          )}
                        />
                        </td>
                        <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`details.${index}.openingRate`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value as any}
                                  type="text"
                                  inputMode="decimal"
                                  onChange={(e) => {
                                    field.onChange(sanitizeDecimal2(e.target.value));
                                    onQtyRateChange(index);
                                  }}
                                  className="text-sm"
                                  disabled={isExpiryItem(index)}
                                />
                              </FormControl>
                              {(() => {
                                const itemId = String(
                                  form.watch(`details.${index}.itemId`) || ""
                                );
                                if (!itemId || itemId === "__none") return null;
                                const si = (siteItemsData?.data || []).find(
                                  (d: any) => String(d.itemId) === itemId
                                );
                                const v =
                                  typeof si?.openingRate === "number"
                                    ? si.openingRate
                                    : 0;
                                return (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Opening Rate: {v}
                                  </div>
                                );
                              })()}
                              <FormMessage className="text-sm" />
                            </FormItem>
                          )}
                        />
                        </td>
                        <td className="p-2">
                        <FormField
                          control={form.control}
                          name={`details.${index}.openingValue`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value as any}
                                  type="number"
                                  step="0.01"
                                  className="text-sm"
                                  disabled
                                />
                              </FormControl>
                              {(() => {
                                const itemId = String(
                                  form.watch(`details.${index}.itemId`) || ""
                                );
                                if (!itemId || itemId === "__none") return null;
                                const si = (siteItemsData?.data || []).find(
                                  (d: any) => String(d.itemId) === itemId
                                );
                                const v =
                                  typeof si?.closingValue === "number"
                                    ? si.closingValue
                                    : 0;
                                return (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Closing Value: {v}
                                  </div>
                                );
                              })()}
                              <FormMessage className="text-sm" />
                            </FormItem>
                          )}
                        />
                        </td>
                        <td className="p-2 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => remove(index)}
                          disabled={false}
                          className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        </td>
                      </tr>

                      {isExpiryItem(index) ? (
                        <tr className="border-t" key={`${f.id}-batches`}>
                          <td colSpan={5} className="p-2">
                            <ExpiryBatchesEditor
                              form={form}
                              detailIndex={index}
                              siteId={watchSiteId || siteIdFromQuery || undefined}
                              itemId={form.watch(`details.${index}.itemId`) || undefined}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="p-3 border-t bg-muted/25">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                        className="gap-2 h-8"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="text-sm">Add Item</span>
                      </Button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => router.push("/stocks")}
              >
                Cancel
              </AppButton>
              <AppButton type="submit">Save</AppButton>
            </div>
          </form>
        </Form>
      </AppCard.Content>
    </AppCard>
  );
}
