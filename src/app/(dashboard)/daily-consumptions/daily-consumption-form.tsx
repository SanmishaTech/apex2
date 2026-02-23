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
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Form } from "@/components/ui/form";
import { ComboboxInput } from "@/components/common/combobox-input";
import { formatDateForInput } from "@/lib/locales";
import { AppSelect } from "@/components/common/app-select";
import { Plus, Trash2 } from "lucide-react";

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  dailyConsumptionDate: z.string().min(1, "Consumption Date is required"),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Item is required"),
        qty: z.string().optional().default(""),
        batches: z
          .array(
            z.object({
              batchNumber: z.string().optional().default(""),
              qty: z.string().optional().default(""),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1, "At least one item is required"),
});

type RawFormValues = z.infer<typeof inputSchema>;

function ExpiryQtyDisplay({ control, index }: { control: any; index: number }) {
  const batchesVal = useWatch({
    control,
    name: `items.${index}.batches` as any,
  }) as any[];

  const total = useMemo(() => {
    const sum = (batchesVal || []).reduce((acc, b) => {
      const q = b?.qty && b.qty !== "" ? Number(b.qty) : 0;
      return acc + (Number.isFinite(q) ? q : 0);
    }, 0);
    return sum > 0 ? String(Number(sum.toFixed(4))) : "";
  }, [batchesVal]);

  return (
    <input
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
      type="number"
      placeholder="0"
      disabled
      value={total}
      readOnly
    />
  );
}

function BatchRows({
  control,
  index,
  batchOptions,
  batchInfo,
}: {
  control: any;
  index: number;
  batchOptions: string[];
  batchInfo: Map<string, any>;
}) {
  const { fields: batchFields, append: appendBatch, remove: removeBatch } = useFieldArray({
    control,
    name: `items.${index}.batches` as any,
  });

  const batchesVal = useWatch({
    control,
    name: `items.${index}.batches` as any,
  }) as any[];

  return (
    <div className="mt-2 rounded-xl border bg-muted/20 p-3">
      <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground mb-2">
        <div className="col-span-5">Batch</div>
        <div className="col-span-3">Expiry</div>
        <div className="col-span-2">Batch Closing</div>
        <div className="col-span-1">Qty</div>
        <div className="col-span-1"></div>
      </div>

      {batchFields.map((f, bIndex) => {
        const batchNumber = String((batchesVal?.[bIndex] as any)?.batchNumber || "").trim();
        const info = batchNumber ? batchInfo.get(batchNumber) : null;
        const expiry = info?.expiryDate || "—";
        const closing = info ? Number(info.closingQty || 0) : 0;

        return (
          <div key={f.id} className="grid grid-cols-12 gap-3 items-start mb-2">
            <div className="col-span-5">
              <AppSelect
                control={control}
                name={`items.${index}.batches.${bIndex}.batchNumber` as any}
                placeholder="Select batch"
              >
                {batchOptions.map((o) => (
                  <AppSelect.Item key={o} value={o}>
                    {o}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div className="col-span-3 pt-2 text-sm">{expiry}</div>
            <div className="col-span-2 pt-2 text-sm">{closing}</div>
            <div className="col-span-1">
              <TextInput
                control={control}
                name={`items.${index}.batches.${bIndex}.qty` as any}
                label=""
                type="number"
                placeholder="0"
                span={12}
              />
            </div>
            <div className="col-span-1 pt-2">
              <button
                type="button"
                className="text-destructive inline-flex items-center text-sm"
                onClick={() => removeBatch(bIndex)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="inline-flex items-center text-sm border rounded-md px-3 py-2"
        onClick={() => appendBatch({ batchNumber: "", qty: "" } as any)}
      >
        <Plus className="h-4 w-4 mr-2" /> Add Batch
      </button>
    </div>
  );
}

export default function DailyConsumptionForm() {
  const router = useRouter();
  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    defaultValues: {
      siteId: "",
      dailyConsumptionDate: formatDateForInput(new Date()),
      items: [],
    },
  });
  const { control, handleSubmit } = form;
  const { fields, replace } = useFieldArray({ control, name: "items" });

  const siteIdVal = form.watch("siteId");
  const itemsVal = useWatch({ control, name: "items" }) as any[];

  const { data: sitesData } = useSWR<any>("/api/sites?perPage=1000", apiGet);
  const { data: siteItemsResp } = useSWR<any>(
    siteIdVal ? `/api/site-items?siteId=${siteIdVal}&includeBatches=1` : null,
    apiGet
  );

  const siteItemRows = useMemo(() => {
    return ((siteItemsResp?.data as any[]) || []) as any[];
  }, [siteItemsResp?.data]);

  const siteItemByItemId = useMemo(() => {
    const map = new Map<number, any>();
    siteItemRows.forEach((r: any) => map.set(Number(r.itemId), r));
    return map;
  }, [siteItemRows]);

  const closingByItem = useMemo(() => {
    const map = new Map<number, number>();
    siteItemRows.forEach((r: any) => map.set(Number(r.itemId), Number(r.closingStock ?? 0)));
    return map;
  }, [siteItemRows]);

  const batchInfoByItemId = useMemo(() => {
    const map = new Map<number, Map<string, any>>();
    siteItemRows.forEach((r: any) => {
      const itemId = Number(r.itemId);
      const inner = new Map<string, any>();
      ((r.siteItemBatches as any[]) || []).forEach((b: any) => {
        inner.set(String(b.batchNumber), b);
      });
      map.set(itemId, inner);
    });
    return map;
  }, [siteItemRows]);

  const batchOptionsByItemId = useMemo(() => {
    const map = new Map<number, string[]>();
    siteItemRows.forEach((r: any) => {
      const itemId = Number(r.itemId);
      const opts = ((r.siteItemBatches as any[]) || [])
        .map((b: any) => String(b.batchNumber || "").trim())
        .filter((v: string) => !!v);
      map.set(itemId, Array.from(new Set(opts)).sort());
    });
    return map;
  }, [siteItemRows]);

  const siteItemIdsKey = useMemo(() => {
    const ids = siteItemRows
      .map((r: any) => Number(r?.itemId))
      .filter((v: any) => Number.isFinite(v) && v > 0)
      .sort((a: number, b: number) => a - b);
    return ids.join(",");
  }, [siteItemRows]);

  useEffect(() => {
    if (!siteIdVal) {
      const current = (form.getValues("items") || []) as any[];
      if (current.length) replace([]);
      return;
    }

    const current = (form.getValues("items") || []) as any[];
    const currentKey = current
      .map((it: any) => Number(it?.itemId))
      .filter((v: any) => Number.isFinite(v) && v > 0)
      .sort((a: number, b: number) => a - b)
      .join(",");

    if (currentKey === siteItemIdsKey) return;

    const next = siteItemRows
      .map((si: any) => ({
        itemId: String(si.itemId),
        qty: "",
        batches: [],
      }))
      .sort((a: any, b: any) => Number(a.itemId) - Number(b.itemId));
    replace(next as any);
  }, [siteIdVal, replace, siteItemRows, siteItemIdsKey, form]);

  // Build options per-row to avoid duplicates, like outward challan form

  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      // Frontend validations for quantities
      let hasError = false;
      (data.items || []).forEach((r, index) => {
        const itemIdNum = parseInt(String(r.itemId || 0), 10);
        const closing = closingByItem.get(itemIdNum);
        const siteRow = siteItemByItemId.get(itemIdNum);
        const isExpiry = Boolean(siteRow?.item?.isExpiryDate);
        const qtyNum = isExpiry
          ? (r.batches || []).reduce((acc, b) => {
              const q = b?.qty && b.qty !== "" ? Number(b.qty) : 0;
              return acc + (Number.isFinite(q) ? q : 0);
            }, 0)
          : r.qty && r.qty !== ""
            ? Number(r.qty)
            : 0;
        if (!(qtyNum > 0)) {
          hasError = true;
          form.setError(`items.${index}.qty` as any, {
            type: "manual",
            message: "Qty must be greater than 0",
          });
        } else if (typeof closing === "number" && qtyNum > Number(closing)) {
          hasError = true;
          form.setError(`items.${index}.qty` as any, {
            type: "manual",
            message: `Cannot exceed closing (${closing})`,
          });
        }

        if (isExpiry) {
          const batchInfo = batchInfoByItemId.get(itemIdNum) || new Map<string, any>();
          const used = new Set<string>();
          (r.batches || []).forEach((b, bIndex) => {
            const bn = String(b?.batchNumber || "").trim();
            const bq = b?.qty && b.qty !== "" ? Number(b.qty) : 0;
            if (!bn && bq > 0) {
              hasError = true;
              form.setError(`items.${index}.batches.${bIndex}.batchNumber` as any, {
                type: "manual",
                message: "Batch is required",
              });
            }
            if (bn) {
              if (used.has(bn)) {
                hasError = true;
                form.setError(`items.${index}.batches.${bIndex}.batchNumber` as any, {
                  type: "manual",
                  message: "Duplicate batch",
                });
              }
              used.add(bn);
              const info = batchInfo.get(bn);
              const bClosing = info ? Number(info.closingQty || 0) : 0;
              if (bq > bClosing) {
                hasError = true;
                form.setError(`items.${index}.batches.${bIndex}.qty` as any, {
                  type: "manual",
                  message: `Cannot exceed batch closing (${bClosing})`,
                });
              }
            }
          });
        }
      });
      if (hasError) {
        toast.error("Please fix quantity errors before submitting");
        setSubmitting(false);
        return;
      }
      const payload = {
        dailyConsumptionDate: data.dailyConsumptionDate,
        siteId: parseInt(data.siteId),
        dailyConsumptionDetails: (data.items || []).map((r) => ({
          itemId: parseInt(r.itemId),
          qty:
            (r.batches || []).length > 0
              ? Number(
                  (r.batches || [])
                    .reduce((acc, b) => {
                      const q = b?.qty && b.qty !== "" ? Number(b.qty) : 0;
                      return acc + (Number.isFinite(q) ? q : 0);
                    }, 0)
                    .toFixed(4)
                )
              : r.qty && r.qty !== ""
                ? Number(r.qty)
                : 0,
          rate: 0,
          dcDetailBatches: (r.batches || [])
            .map((b) => ({
              batchNumber: String(b.batchNumber || "").trim(),
              qty: b.qty && b.qty !== "" ? Number(b.qty) : 0,
            }))
            .filter((b) => !!b.batchNumber && Number(b.qty) > 0),
        })),
      };
      await apiPost("/api/daily-consumptions", payload);
      toast.success("Daily Consumption created");
      router.push("/daily-consumptions");
    } catch (err) {
      const e = err as any;
      // Try to extract server-side validation details
      const data = e?.data || {};
      const errorsObj = (data as any)?.errors || data;
      const details: string[] | undefined = errorsObj?.details;
      if (Array.isArray(details) && details.length > 0) {
        // Messages look like: "Item 1: Qty cannot exceed closing (0)"
        // Map by itemId to row index
        const itemsVal = (form.getValues("items") || []) as Array<{ itemId: string; qty: string }>;
        details.forEach((msg) => {
          const m = String(msg);
          const match = m.match(/Item\s+(\d+)/i);
          const itemIdFromMsg = match ? match[1] : undefined;
          if (itemIdFromMsg) {
            const idx = itemsVal.findIndex((it) => String(it.itemId) === String(itemIdFromMsg));
            if (idx >= 0) {
              form.setError(`items.${idx}.qty` as any, { type: 'server', message: m.replace(/^Item\s+\d+:\s*/i, '') });
            }
          }
        });
        toast.error(details[0]);
      } else {
        toast.error((e as Error).message || 'Failed to save');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Create Daily Consumption</AppCard.Title>
          <AppCard.Description>Add a new daily consumption.</AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend={<span className="text-base font-semibold">General</span>}>
              <FormRow cols={3} from="md">
                <ComboboxInput
                  control={control}
                  name="siteId"
                  label="Site"
                  options={(sitesData?.data || []).map((s: any) => ({ value: String(s.id), label: s.site }))}
                  placeholder="Select site"
                  required
                />
                <TextInput
                  control={control}
                  name="dailyConsumptionDate"
                  label="Consumption Date *"
                  type="date"
                  span={1}
                  spanFrom="md"
                />
              </FormRow>
            </FormSection>

            <FormSection legend={<span className="text-base font-semibold">Consumption Details</span>}>
              <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-sm">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground">
                  <div className="col-span-1">Sr No</div>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Closing Stock</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-0"></div>
                </div>
                {fields.map((field, index) => {
                  const currentItemId = String((itemsVal?.[index] as any)?.itemId || "");
                  const itemIdNum = currentItemId ? parseInt(currentItemId, 10) : NaN;
                  const siteRow = Number.isFinite(itemIdNum) ? siteItemByItemId.get(itemIdNum) : null;
                  const itemLabel = siteRow?.item?.itemCode
                    ? `${siteRow.item.itemCode} - ${siteRow.item.item}`
                    : siteRow?.item?.item || "—";
                  const unitName = siteRow?.item?.unit?.unitName || "—";
                  const closingVal = Number.isFinite(itemIdNum) ? closingByItem.get(itemIdNum) ?? 0 : 0;
                  const isExpiry = Boolean(siteRow?.item?.isExpiryDate);

                  return (
                    <div key={field.id} className="py-2 border-b">
                      <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-1">{index + 1}</div>
                      <div className="col-span-5 text-sm">{itemLabel}</div>
                      <div className="col-span-2 text-sm">{closingVal}</div>
                      <div className="col-span-2 text-sm">{unitName}</div>
                      <div className="col-span-2">
                        {isExpiry ? (
                          <ExpiryQtyDisplay control={control} index={index} />
                        ) : (
                          <TextInput
                            control={control}
                            name={`items.${index}.qty`}
                            label=""
                            type="number"
                            step="0.0001"
                            placeholder="0"
                            span={12}
                          />
                        )}
                      </div>
                      </div>

                      {isExpiry && Number.isFinite(itemIdNum) ? (
                        <BatchRows
                          control={control}
                          index={index}
                          batchOptions={batchOptionsByItemId.get(itemIdNum) || []}
                          batchInfo={batchInfoByItemId.get(itemIdNum) || new Map<string, any>()}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <AppButton type="button" variant="secondary" onClick={() => router.push("/daily-consumptions")}>
              Cancel
            </AppButton>
            <AppButton type="submit" iconName="Plus" isLoading={submitting} disabled={submitting || !form.formState.isValid}>
              Create
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
