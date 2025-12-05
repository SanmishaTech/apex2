"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
      })
    )
    .min(1, "At least one row is required"),
});

export type RawFormValues = z.infer<typeof inputSchema>;

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
        },
      ],
    },
  });
  const { control, handleSubmit, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "details",
  });

  const siteIdVal = watch("siteId");

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
        const issued =
          r.issuedQty && r.issuedQty !== "" ? Number(r.issuedQty) : 0;
        const received =
          r.receivedQty && r.receivedQty !== "" ? Number(r.receivedQty) : 0;
        const rateNum = r.rate && r.rate !== "" ? Number(r.rate) : 0;
        const amountNum = r.amount && r.amount !== "" ? Number(r.amount) : 0;
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
          issuedQty: Number(r.issuedQty || 0),
          receivedQty: Number(r.receivedQty || 0),
          rate: Number(r.rate || 0),
          amount: Number(r.amount || 0),
          remarks: (r.remarks || "").trim() || undefined,
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
                    const rows = watch("details") || [];
                    const row = rows[index];
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

                    // Build item options avoiding duplicates
                    const usedIds = new Set<string>(
                      rows
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
                          <TextInput
                            control={control}
                            name={`details.${index}.issuedQty`}
                            type="number"
                            step="0.0001"
                            placeholder="0"
                            className="h-8 text-right"
                            onInput={(e) => {
                              const val = (e.currentTarget as HTMLInputElement)
                                .value;
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
                        </div>
                        <div className="col-span-2">
                          <TextInput
                            control={control}
                            name={`details.${index}.receivedQty`}
                            type="number"
                            step="0.0001"
                            placeholder="0"
                            className="h-8 text-right"
                            onInput={(e) => {
                              const val = (e.currentTarget as HTMLInputElement)
                                .value;
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
                        </div>
                        <div className="col-span-2">
                          <TextInput
                            control={control}
                            name={`details.${index}.rate`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 text-right"
                            onInput={(e) => {
                              const val = (e.currentTarget as HTMLInputElement)
                                .value;
                              form.setValue(
                                `details.${index}.rate` as any,
                                val,
                                { shouldDirty: true, shouldValidate: false }
                              );
                              recomputeAmount(index, { rate: val });
                            }}
                          />
                        </div>
                        <div className="col-span-2">
                          <TextInput
                            control={control}
                            name={`details.${index}.amount`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 text-right"
                            disabled
                          />
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
