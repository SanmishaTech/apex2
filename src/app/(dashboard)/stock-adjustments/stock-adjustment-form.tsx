"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common";
import { FormSection, FormRow } from "@/components/common/app-form";
import { TextInput } from "@/components/common/text-input";
import { TextareaInput } from "@/components/common/textarea-input";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Form } from "@/components/ui/form";
import { ComboboxInput } from "@/components/common/combobox-input";
import { formatDateForInput } from "@/lib/locales";
import { BatchNumberTypeaheadInput } from "@/components/common/batch-number-typeahead-input";
import { Trash2 } from "lucide-react";

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  date: z.string().min(1, "Date is required"),
  details: z
    .array(
      z.object({
        itemId: z.string().min(1, "Item is required"),
        issuedQty: z.string().optional(),
        receivedQty: z.string().optional(),
        rate: z.string().optional(),
        amount: z.string().optional(),
        remarks: z.string().optional().default(""),
        batches: z
          .array(
            z.object({
              batchNumber: z.string().optional().default(""),
              expiryDate: z.string().optional().default(""),
              issuedQty: z.string().optional().default(""),
              receivedQty: z.string().optional().default(""),
              unitRate: z.string().optional().default(""),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1, "At least one row is required"),
});

export type RawFormValues = z.infer<typeof inputSchema>;

function sanitizeDecimal2(raw: string): string {
  const s = String(raw ?? "");
  if (s === "") return "";
  const cleaned = s.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const intPart = parts[0] ?? "";
  const decRaw = parts.slice(1).join("");
  const decPart = decRaw.slice(0, 2);
  if (cleaned.includes(".")) {
    return `${intPart}.${decPart}`;
  }
  return intPart;
}

function BatchRows({
  form,
  index,
  siteId,
  itemId,
}: {
  form: any;
  index: number;
  siteId: string;
  itemId: number | undefined;
}) {
  const siteIdNum = Number(siteId);
  const itemIdNum = typeof itemId === "number" ? itemId : NaN;
  const canFetch =
    Number.isFinite(siteIdNum) && siteIdNum > 0 && Number.isFinite(itemIdNum) && itemIdNum > 0;

  const { data: batchesData } = useSWR<any>(
    canFetch ? `/api/site-item-batches?siteId=${siteIdNum}&itemId=${itemIdNum}` : null,
    apiGet
  );

  const byBatchNo = useMemo(() => {
    const m = new Map<string, any>();
    (batchesData?.data || []).forEach((b: any) => {
      if (b?.batchNumber) m.set(String(b.batchNumber), b);
    });
    return m;
  }, [batchesData?.data]);

  const batchOptions = useMemo(
    () =>
      (Array.from(
        new Set((batchesData?.data || []).map((b: any) => String(b.batchNumber)))
      )
        .filter(Boolean)
        .sort() as string[]),
    [batchesData?.data]
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `details.${index}.batches` as any,
  });

  const watchedBatches = useWatch({
    control: form.control,
    name: `details.${index}.batches` as any,
  }) as any[] | undefined;

  useEffect(() => {
    const rows = watchedBatches || [];
    rows.forEach((r: any, bIndex: number) => {
      const bn = String(r?.batchNumber || "").trim();
      if (!bn) return;
      const meta = byBatchNo.get(bn);
      if (!meta?.expiryDate) return;
      const yyyyMm = String(meta.expiryDate).slice(0, 7);
      const current = String(r?.expiryDate || "").trim();
      if (current !== yyyyMm) {
        form.setValue(`details.${index}.batches.${bIndex}.expiryDate` as any, yyyyMm, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    });
  }, [watchedBatches, byBatchNo, form, index]);

  const batchMode = useMemo(() => {
    const rows = watchedBatches || [];
    const anyIssued = rows.some((r: any) => Number(r?.issuedQty || 0) > 0);
    const anyReceived = rows.some((r: any) => Number(r?.receivedQty || 0) > 0);
    if (anyIssued && !anyReceived) return "ISSUED" as const;
    if (!anyIssued && anyReceived) return "RECEIVED" as const;
    return null;
  }, [watchedBatches]);

  function addRow() {
    append({ batchNumber: "", expiryDate: "", issuedQty: "", receivedQty: "", unitRate: "" } as any);
  }

  return (
    <div className="mt-2 rounded-md border bg-muted/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Batch-wise Adjustment</div>
        <AppButton type="button" size="sm" variant="secondary" onClick={addRow}>
          Add Batch
        </AppButton>
      </div>

      <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground mb-2">
        <div className="col-span-3">Batch Number</div>
        <div className="col-span-2">Expiry (YYYY-MM)</div>
        <div className="col-span-2">Issued</div>
        <div className="col-span-2">Received</div>
        <div className="col-span-2">Unit Rate</div>
        <div className="col-span-1">Closing</div>
        <div className="col-span-1" />
      </div>

      {fields.map((f, bIndex) => {
        const bn = String((watchedBatches?.[bIndex] as any)?.batchNumber || "").trim();
        const existing = bn ? byBatchNo.get(bn) : null;
        const closing = existing ? Number(existing.closingQty ?? 0) : 0;
        const existingExpiry = existing?.expiryDate ? String(existing.expiryDate).slice(0, 7) : "";
        return (
          <div key={f.id} className="grid grid-cols-12 gap-3 items-start mb-2">
            <div className="col-span-3">
              <BatchNumberTypeaheadInput
                control={form.control}
                name={`details.${index}.batches.${bIndex}.batchNumber` as any}
                label=""
                placeholder="Type or select"
                options={batchOptions}
                inputClassName="h-9"
                onSelectOption={(value) => {
                  const meta = byBatchNo.get(String(value || "").trim());
                  if (meta?.expiryDate) {
                    const yyyyMm = String(meta.expiryDate).slice(0, 7);
                    form.setValue(
                      `details.${index}.batches.${bIndex}.expiryDate` as any,
                      yyyyMm,
                      { shouldDirty: true, shouldValidate: false }
                    );
                  }
                }}
              />
            </div>

            <div className="col-span-2">
              <TextInput
                control={form.control}
                name={`details.${index}.batches.${bIndex}.expiryDate` as any}
                label=""
                type="month"
                span={12}
                disabled={!!existing}
                onValueChange={(raw) => {
                  if (existing) return existingExpiry;
                  return String(raw ?? "").slice(0, 7);
                }}
              />
            </div>

            <div className="col-span-2">
              <TextInput
                control={form.control}
                name={`details.${index}.batches.${bIndex}.issuedQty` as any}
                label=""
                type="text"
                inputMode="decimal"
                placeholder="0"
                span={12}
                disabled={batchMode === "RECEIVED"}
                onValueChange={(raw) => sanitizeDecimal2(raw)}
                onInput={(e) => {
                  if (batchMode === "RECEIVED") return;
                  const raw = (e.currentTarget as HTMLInputElement).value;
                  const next = sanitizeDecimal2(raw);
                  form.setValue(`details.${index}.batches.${bIndex}.issuedQty` as any, next, {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                  const q = Number(next || 0);
                  if (Number.isFinite(q) && q > 0) {
                    form.setValue(`details.${index}.batches.${bIndex}.receivedQty` as any, "0", {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }
                }}
              />
            </div>

            <div className="col-span-2">
              <TextInput
                control={form.control}
                name={`details.${index}.batches.${bIndex}.receivedQty` as any}
                label=""
                type="text"
                inputMode="decimal"
                placeholder="0"
                span={12}
                disabled={batchMode === "ISSUED"}
                onValueChange={(raw) => sanitizeDecimal2(raw)}
                onInput={(e) => {
                  if (batchMode === "ISSUED") return;
                  const raw = (e.currentTarget as HTMLInputElement).value;
                  const next = sanitizeDecimal2(raw);
                  form.setValue(`details.${index}.batches.${bIndex}.receivedQty` as any, next, {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                  const q = Number(next || 0);
                  if (Number.isFinite(q) && q > 0) {
                    form.setValue(`details.${index}.batches.${bIndex}.issuedQty` as any, "0", {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }
                }}
              />
            </div>

            <div className="col-span-2">
              <TextInput
                control={form.control}
                name={`details.${index}.batches.${bIndex}.unitRate` as any}
                label=""
                type="text"
                inputMode="decimal"
                placeholder="0"
                span={12}
                onValueChange={(raw) => sanitizeDecimal2(raw)}
              />
            </div>

            <div className="col-span-1 pt-2 text-sm">{existing ? Number(existing.closingQty ?? 0) : "—"}</div>

            <div className="col-span-1 pt-1">
              <AppButton
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(bIndex)}
              >
                <Trash2 className="h-4 w-4" />
              </AppButton>
            </div>
          </div>
        );
      })}

      {fields.length === 0 && (
        <div className="text-sm text-muted-foreground">Add batches to adjust stock.</div>
      )}
    </div>
  );
}

export default function StockAdjustmentForm() {
  const router = useRouter();
  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    defaultValues: {
      siteId: "",
      date: formatDateForInput(new Date()),
      details: [
        {
          itemId: "",
          issuedQty: "",
          receivedQty: "",
          rate: "",
          amount: "",
          remarks: "",
          batches: [],
        },
      ],
    },
  });
  const { control, handleSubmit } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "details",
  });

  const siteIdVal = form.watch("siteId");
  const detailsVal = useWatch({ control, name: "details" }) as any[];

  const { data: sitesData } = useSWR<any>(
    "/api/sites?perPage=1000&order=asc&sort=site",
    apiGet
  );
  const { data: itemsData } = useSWR<any>("/api/items/options", apiGet);
  const { data: siteItemsData } = useSWR<any>(
    siteIdVal ? `/api/site-items?siteId=${siteIdVal}` : null,
    apiGet
  );

  const closingStockMap: Record<number, number> = useMemo(() => {
    const map: Record<number, number> = {};
    ((siteItemsData?.data as any[]) || []).forEach((r: any) => {
      map[Number(r.itemId)] = Number(r.closingStock ?? 0);
    });
    return map;
  }, [siteItemsData]);

  useEffect(() => {
    // When site changes, clear selected items and quantities
    form.setValue(
      "details",
      [
        {
          itemId: "",
          issuedQty: "",
          receivedQty: "",
          rate: "",
          amount: "",
          remarks: "",
          batches: [],
        },
      ],
      { shouldDirty: true, shouldValidate: false }
    );
  }, [siteIdVal]);

  const [submitting, setSubmitting] = useState(false);

  function recomputeAmount(
    index: number,
    overrides?: Partial<{
      issuedQty: string | number;
      receivedQty: string | number;
      rate: string | number;
    }>
  ) {
    const rows = form.getValues("details") || [];
    const row = rows[index];
    if (!row) return;

    const issued = Number(overrides?.issuedQty ?? row.issuedQty ?? 0);
    const received = Number(overrides?.receivedQty ?? row.receivedQty ?? 0);
    const rate = Number(overrides?.rate ?? row.rate ?? 0);
    const qty = received > 0 ? received : issued;
    const amount = Number((qty * rate).toFixed(2));

    form.setValue(`details.${index}.amount` as any, String(amount), {
      shouldDirty: true,
      shouldValidate: false,
    });
  }

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      // Basic validations: at least one of issued/received must be > 0, and cannot exceed closing if issuing
      const closingMap = closingStockMap || {};
      let hasError = false;
      (data.details || []).forEach((r, index) => {
        const itemIdNum = parseInt(String(r.itemId || 0), 10);
        const itemRow = (itemsData?.data || []).find(
          (it: any) => String(it.id) === String(r.itemId)
        );
        const isExpiry = Boolean(itemRow?.isExpiryDate);

        const batchDerived = isExpiry
          ? (r.batches || []).reduce(
              (
                acc: { totalQty: number; totalAmount: number },
                b: any
              ) => {
                const bIssued =
                  b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                const bReceived =
                  b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                const bQty = bReceived > 0 ? bReceived : bIssued;
                const bRate =
                  b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0;
                const bAmount = Number((bQty * bRate).toFixed(2));
                return {
                  totalQty: Number((acc.totalQty + (Number.isFinite(bQty) ? bQty : 0)).toFixed(4)),
                  totalAmount: Number(
                    (acc.totalAmount + (Number.isFinite(bAmount) ? bAmount : 0)).toFixed(2)
                  ),
                };
              },
              { totalQty: 0, totalAmount: 0 }
            )
          : null;
        const derivedRate =
          batchDerived && batchDerived.totalQty > 0
            ? Number((batchDerived.totalAmount / batchDerived.totalQty).toFixed(2))
            : 0;
        const derivedAmount = batchDerived ? Number(batchDerived.totalAmount.toFixed(2)) : 0;

        const issued = isExpiry
          ? (r.batches || []).reduce((acc: number, b: any) => {
              const q = b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
              return acc + (Number.isFinite(q) ? q : 0);
            }, 0)
          : r.issuedQty && r.issuedQty !== ""
            ? Number(r.issuedQty)
            : 0;
        const received = isExpiry
          ? (r.batches || []).reduce((acc: number, b: any) => {
              const q = b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
              return acc + (Number.isFinite(q) ? q : 0);
            }, 0)
          : r.receivedQty && r.receivedQty !== ""
            ? Number(r.receivedQty)
            : 0;

        if (isExpiry && issued > 0 && received > 0) {
          hasError = true;
          form.setError(`details.${index}.issuedQty` as any, {
            type: "manual",
            message: "For expiry items, use either Issued OR Received across all batches",
          });
          form.setError(`details.${index}.receivedQty` as any, {
            type: "manual",
            message: "For expiry items, use either Issued OR Received across all batches",
          });
        }
        const rateNum = isExpiry
          ? derivedRate
          : r.rate && r.rate !== ""
            ? Number(r.rate)
            : 0;
        const amountNum = isExpiry
          ? derivedAmount
          : r.amount && r.amount !== ""
            ? Number(r.amount)
            : 0;
        if (!(issued > 0 || received > 0)) {
          hasError = true;
          form.setError(`details.${index}.issuedQty` as any, {
            type: "manual",
            message: "Issued or Received is required",
          });
          form.setError(`details.${index}.receivedQty` as any, {
            type: "manual",
            message: "Issued or Received is required",
          });
        }
        if (issued > 0) {
          const closing = Number(closingMap[itemIdNum] ?? 0);
          if (issued > closing) {
            hasError = true;
            form.setError(`details.${index}.issuedQty` as any, {
              type: "manual",
              message: `Cannot exceed closing (${closing})`,
            });
          }
        }

        if (isExpiry) {
          const siteIdNum = Number(siteIdVal);
          const itemIdN = Number(itemIdNum);
          if (Number.isFinite(siteIdNum) && siteIdNum > 0 && Number.isFinite(itemIdN) && itemIdN > 0) {
            // Validate batch issued does not exceed batch closing
            // We fetch all batches for the item and check against openingQty (API route returns openingQty)
            // This mirrors IDC-style autocomplete data source.
            const errors: Array<{ path: string; message: string }> = [];
            // no direct map here; rely on server-side validation as source of truth
            (r.batches || []).forEach((b: any, bIndex: number) => {
              const bn = String(b?.batchNumber || "").trim();
              const bIssued = b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
              const bReceived = b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
              const bRate = b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0;
              const bExpiry = String(b?.expiryDate || "").trim();
              if (!bn && (bIssued > 0 || bReceived > 0)) {
                errors.push({
                  path: `details.${index}.batches.${bIndex}.batchNumber`,
                  message: "Batch is required",
                });
              }
              if ((bIssued > 0 || bReceived > 0) && bn) {
                if (!/^\d{4}-\d{2}$/.test(bExpiry)) {
                  errors.push({
                    path: `details.${index}.batches.${bIndex}.expiryDate`,
                    message: "Expiry date is required (YYYY-MM)",
                  });
                }
              }
              if (bIssued > 0 && bReceived > 0) {
                errors.push({
                  path: `details.${index}.batches.${bIndex}.issuedQty`,
                  message: "Enter either issued or received for a batch",
                });
              }
              if ((bIssued > 0 || bReceived > 0) && !(bRate >= 0)) {
                errors.push({
                  path: `details.${index}.batches.${bIndex}.unitRate`,
                  message: "Unit rate is required",
                });
              }
            });
            errors.forEach((e) => {
              hasError = true;
              form.setError(e.path as any, { type: "manual", message: e.message });
            });
          }
        }
        // If there is any quantity, rate and amount must be > 0
        if (issued > 0 || received > 0) {
          if (!(rateNum > 0)) {
            hasError = true;
            form.setError(`details.${index}.rate` as any, {
              type: "manual",
              message: "Rate must be greater than 0",
            });
          }
          if (!(amountNum > 0)) {
            hasError = true;
            form.setError(`details.${index}.amount` as any, {
              type: "manual",
              message: "Amount must be greater than 0",
            });
          }
        }
      });
      if (hasError) {
        toast.error("Please fix row errors before submitting");
        setSubmitting(false);
        return;
      }

      const payload = {
        date: data.date,
        siteId: parseInt(data.siteId, 10),
        stockAdjustmentDetails: (data.details || []).map((r) => ({
          itemId: parseInt(r.itemId, 10),
          issuedQty:
            (r.batches || []).length > 0
              ? Number(
                  (r.batches || []).reduce((acc: number, b: any) => {
                    const q = b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                    return acc + (Number.isFinite(q) ? q : 0);
                  }, 0)
                )
              : Number(r.issuedQty || 0),
          receivedQty:
            (r.batches || []).length > 0
              ? Number(
                  (r.batches || []).reduce((acc: number, b: any) => {
                    const q = b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                    return acc + (Number.isFinite(q) ? q : 0);
                  }, 0)
                )
              : Number(r.receivedQty || 0),
          rate:
            (r.batches || []).length > 0
              ? (() => {
                  const agg = (r.batches || []).reduce(
                    (
                      acc: { totalQty: number; totalAmount: number },
                      b: any
                    ) => {
                      const bIssued =
                        b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                      const bReceived =
                        b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                      const bQty = bReceived > 0 ? bReceived : bIssued;
                      const bRate =
                        b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0;
                      const bAmount = Number((bQty * bRate).toFixed(2));
                      return {
                        totalQty: Number((acc.totalQty + (Number.isFinite(bQty) ? bQty : 0)).toFixed(4)),
                        totalAmount: Number(
                          (acc.totalAmount + (Number.isFinite(bAmount) ? bAmount : 0)).toFixed(2)
                        ),
                      };
                    },
                    { totalQty: 0, totalAmount: 0 }
                  );
                  return agg.totalQty > 0 ? Number((agg.totalAmount / agg.totalQty).toFixed(2)) : 0;
                })()
              : Number(r.rate || 0),
          amount:
            (r.batches || []).length > 0
              ? (() => {
                  const total = (r.batches || []).reduce((acc: number, b: any) => {
                    const bIssued =
                      b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                    const bReceived =
                      b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                    const bQty = bReceived > 0 ? bReceived : bIssued;
                    const bRate = b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0;
                    const bAmount = Number((bQty * bRate).toFixed(2));
                    return acc + (Number.isFinite(bAmount) ? bAmount : 0);
                  }, 0);
                  return Number(total.toFixed(2));
                })()
              : Number(r.amount || 0),
          remarks: (r.remarks || "").trim() || undefined,
          saDetailBatches: (r.batches || [])
            .map((b: any) => ({
              batchNumber: String(b?.batchNumber || "").trim(),
              batchExpiryDate: String(b?.expiryDate || "").trim(),
              batchIssuedQty:
                b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0,
              batchReceivedQty:
                b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0,
              batchUnitRate:
                b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0,
            }))
            .filter(
              (b: any) =>
                !!b.batchNumber &&
                (Number(b.batchIssuedQty) > 0 || Number(b.batchReceivedQty) > 0)
            ),
        })),
      };

      await apiPost("/api/stock-adjustments", payload);
      toast.success("Stock Adjustment created");
      router.push("/stock-adjustments");
    } catch (err) {
      toast.error((err as Error).message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <div className="text-xs">
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Create Stock Adjustment</AppCard.Title>
            <AppCard.Description>
              Add a new stock adjustment entry.
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection
                legend={
                  <span className="text-base font-semibold">General</span>
                }
              >
                <FormRow cols={3} from="md">
                  <TextInput
                    control={control}
                    name="date"
                    label="Date *"
                    type="date"
                    span={1}
                    spanFrom="md"
                  />
                  <ComboboxInput
                    control={control}
                    name="siteId"
                    label="Site"
                    options={(sitesData?.data || []).map((s: any) => ({
                      value: String(s.id),
                      label: s.site,
                    }))}
                    placeholder="Select site"
                    required
                  />
                </FormRow>
              </FormSection>

              <FormSection
                legend={
                  <span className="text-base font-semibold">
                    Adjustment Details
                  </span>
                }
              >
                <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-sm">
                  <div className="grid grid-cols-12 gap-2 md:gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded-md px-3 py-2">
                    <div className="col-span-2">Item</div>
                    <div className="col-span-1 text-right">Closing Stock</div>
                    <div className="col-span-2 text-right">Issued</div>
                    <div className="col-span-2 text-right">Received</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>
                  {fields.map((field, index) => {
                    const row = detailsVal?.[index] as any;
                    const selectedId = row?.itemId || "";
                    const closingMap = closingStockMap || {};
                    const closingVal = selectedId
                      ? closingMap[Number(selectedId)]
                      : undefined;
                    const unitName = (() => {
                      if (!selectedId) return "-";
                      const found = (itemsData?.data || []).find(
                        (it: any) => String(it.id) === String(selectedId)
                      );
                      return found?.unit?.unitName || "-";
                    })();

                    const itemRow = (itemsData?.data || []).find(
                      (it: any) => String(it.id) === String(selectedId)
                    );
                    const isExpiry = Boolean(itemRow?.isExpiryDate);
                    const itemIdNum = selectedId ? parseInt(String(selectedId), 10) : NaN;
                    const issuedTotal = isExpiry
                      ? (row?.batches || []).reduce((acc: number, b: any) => {
                          const q = b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                          return acc + (Number.isFinite(q) ? q : 0);
                        }, 0)
                      : undefined;
                    const receivedTotal = isExpiry
                      ? (row?.batches || []).reduce((acc: number, b: any) => {
                          const q = b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                          return acc + (Number.isFinite(q) ? q : 0);
                        }, 0)
                      : undefined;

                    const derived = isExpiry
                      ? (row?.batches || []).reduce(
                          (
                            acc: { totalQty: number; totalAmount: number },
                            b: any
                          ) => {
                            const bIssued =
                              b?.issuedQty && b.issuedQty !== "" ? Number(b.issuedQty) : 0;
                            const bReceived =
                              b?.receivedQty && b.receivedQty !== "" ? Number(b.receivedQty) : 0;
                            const bQty = bReceived > 0 ? bReceived : bIssued;
                            const bRate =
                              b?.unitRate && b.unitRate !== "" ? Number(b.unitRate) : 0;
                            const bAmount = Number((bQty * bRate).toFixed(2));
                            return {
                              totalQty: Number(
                                (acc.totalQty + (Number.isFinite(bQty) ? bQty : 0)).toFixed(4)
                              ),
                              totalAmount: Number(
                                (
                                  acc.totalAmount +
                                  (Number.isFinite(bAmount) ? bAmount : 0)
                                ).toFixed(2)
                              ),
                            };
                          },
                          { totalQty: 0, totalAmount: 0 }
                        )
                      : null;
                    const derivedRate =
                      derived && derived.totalQty > 0
                        ? Number((derived.totalAmount / derived.totalQty).toFixed(2))
                        : 0;
                    const derivedAmount = derived ? Number(derived.totalAmount.toFixed(2)) : 0;

                    // Build item options avoiding duplicates
                    const usedIds = new Set<string>(
                      (detailsVal || [])
                        .map((v: any, i: number) =>
                          i !== index ? v?.itemId || "" : ""
                        )
                        .filter((v: string) => !!v)
                    );
                    const itemOptions = ((itemsData?.data as any[]) || [])
                      .filter((it: any) => !usedIds.has(String(it.id)))
                      .map((it: any) => ({
                        value: String(it.id),
                        label: `${it.item} (${it.itemCode})`,
                      }));

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 gap-2 md:gap-2 items-center py-0.5 border-b"
                      >
                        <div className="col-span-2 min-w-0">
                          <ComboboxInput
                            control={control}
                            name={`details.${index}.itemId`}
                            inputClassName="w-full h-8 px-2 truncate"
                            options={itemOptions}
                            placeholder="Select item"
                          />
                        </div>
                        <div className="col-span-1 text-right whitespace-nowrap">
                          <div>{selectedId ? closingVal ?? "-" : "-"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {unitName}
                          </div>
                        </div>
                        <div className="col-span-2 ">
                          {isExpiry ? (
                            <input
                              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm ring-offset-background"
                              type="text"
                              placeholder="0"
                              disabled
                              value={String(issuedTotal || 0)}
                              readOnly
                            />
                          ) : (
                            <TextInput
                              control={control}
                              name={`details.${index}.issuedQty`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              className="h-8 text-right"
                              onValueChange={(raw) => sanitizeDecimal2(raw)}
                              onInput={(e) => {
                                const raw = (e.currentTarget as HTMLInputElement).value;
                                const val = sanitizeDecimal2(raw);
                                form.setValue(
                                  `details.${index}.issuedQty` as any,
                                  val,
                                  { shouldDirty: true, shouldValidate: false }
                                );
                                form.setValue(
                                  `details.${index}.receivedQty` as any,
                                  "0",
                                  { shouldDirty: true, shouldValidate: false }
                                );
                                recomputeAmount(index, {
                                  issuedQty: val,
                                  receivedQty: 0,
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          {isExpiry ? (
                            <input
                              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm ring-offset-background"
                              type="text"
                              placeholder="0"
                              disabled
                              value={String(receivedTotal || 0)}
                              readOnly
                            />
                          ) : (
                            <TextInput
                              control={control}
                              name={`details.${index}.receivedQty`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              className="h-8 text-right"
                              onValueChange={(raw) => sanitizeDecimal2(raw)}
                              onInput={(e) => {
                                const raw = (e.currentTarget as HTMLInputElement).value;
                                const val = sanitizeDecimal2(raw);
                                form.setValue(
                                  `details.${index}.receivedQty` as any,
                                  val,
                                  { shouldDirty: true, shouldValidate: false }
                                );
                                form.setValue(
                                  `details.${index}.issuedQty` as any,
                                  "0",
                                  { shouldDirty: true, shouldValidate: false }
                                );
                                recomputeAmount(index, {
                                  receivedQty: val,
                                  issuedQty: 0,
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          {isExpiry ? (
                            <input
                              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm ring-offset-background"
                              type="text"
                              placeholder="0.00"
                              disabled
                              value={String(derivedRate || 0)}
                              readOnly
                            />
                          ) : (
                            <TextInput
                              control={control}
                              name={`details.${index}.rate`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="h-8 text-right"
                              onValueChange={(raw) => sanitizeDecimal2(raw)}
                              onInput={(e) => {
                                const raw = (e.currentTarget as HTMLInputElement).value;
                                const val = sanitizeDecimal2(raw);
                                form.setValue(
                                  `details.${index}.rate` as any,
                                  val,
                                  { shouldDirty: true, shouldValidate: false }
                                );
                                recomputeAmount(index, { rate: val });
                              }}
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          {isExpiry ? (
                            <input
                              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-right text-sm ring-offset-background"
                              type="text"
                              placeholder="0.00"
                              disabled
                              value={String(derivedAmount || 0)}
                              readOnly
                            />
                          ) : (
                            <TextInput
                              control={control}
                              name={`details.${index}.amount`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="h-8 text-right"
                              disabled
                            />
                          )}
                        </div>
                        <div className="col-span-1 row-span-2 flex items-center justify-center">
                          <AppButton
                            type="button"
                            variant="destructive"
                            size="icon"
                            iconName="Trash2"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            aria-label="Remove row"
                          />
                        </div>
                        <div className="col-span-11 bg-muted/40 rounded-md p-2 mt-2">
                          <TextInput
                            control={control}
                            name={`details.${index}.remarks`}
                            label="Description"
                            placeholder="Enter description"
                          />
                        </div>

                        {isExpiry ? (
                          <div className="col-span-11">
                            <BatchRows
                              form={form}
                              index={index}
                              siteId={String(siteIdVal || "")}
                              itemId={Number.isFinite(itemIdNum) ? itemIdNum : undefined}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <div className="flex gap-2 pt-2">
                    <AppButton
                      type="button"
                      variant="secondary"
                      iconName="Plus"
                      onClick={() =>
                        append({
                          itemId: "",
                          issuedQty: "0",
                          receivedQty: "0",
                          rate: "0",
                          amount: "0",
                          remarks: "",
                          batches: [],
                        })
                      }
                    >
                      Add Row
                    </AppButton>
                  </div>
                </div>
              </FormSection>
            </AppCard.Content>
            <AppCard.Footer className="justify-end">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => router.push("/stock-adjustments")}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                iconName="Plus"
                isLoading={submitting}
                disabled={submitting || !form.formState.isValid}
              >
                Create
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </div>
    </Form>
  );
}
