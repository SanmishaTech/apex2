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
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Form } from "@/components/ui/form";
import { ComboboxInput } from "@/components/common/combobox-input";
import { formatDateForInput } from "@/lib/locales";

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  dailyConsumptionDate: z.string().min(1, "Consumption Date is required"),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Item is required"),
        qty: z.string().min(1, "Qty is required"),
      })
    )
    .min(1, "At least one item is required"),
});

type RawFormValues = z.infer<typeof inputSchema>;

export default function DailyConsumptionForm() {
  const router = useRouter();
  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onChange",
    defaultValues: {
      siteId: "",
      dailyConsumptionDate: formatDateForInput(new Date()),
      items: [{ itemId: "", qty: "" }],
    },
  });
  const { control, handleSubmit, watch } = form;
  const { fields, append, remove, update } = useFieldArray({ control, name: "items" });

  const siteIdVal = watch("siteId");
  const selectedItemIds = useMemo(
    () => (watch("items") || []).map((r) => r.itemId).filter((v) => (v || "").trim() !== ""),
    [watch("items")]
  );

  const { data: sitesData } = useSWR<any>("/api/sites?perPage=1000", apiGet);
  const { data: itemsData } = useSWR<any>(
    siteIdVal ? `/api/items/options?asset=false&siteId=${siteIdVal}` : null,
    apiGet
  );
  // Fetch closing stock for all items at the selected site (SiteItem table)
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
    form.setValue("items", [{ itemId: "", qty: "" }], { shouldDirty: true, shouldValidate: false });
  }, [siteIdVal]);

  // Build options per-row to avoid duplicates, like outward challan form

  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      // Frontend validations for quantities
      const closingMap = closingStockMap || {};
      let hasError = false;
      (data.items || []).forEach((r, index) => {
        const itemIdNum = parseInt(String(r.itemId || 0), 10);
        const qtyNum = r.qty && r.qty !== "" ? Number(r.qty) : 0;
        const hasClosing = Object.prototype.hasOwnProperty.call(closingMap, itemIdNum);
        const closing = hasClosing ? Number(closingMap[itemIdNum] ?? 0) : undefined;
        if (!(qtyNum > 0)) {
          hasError = true;
          form.setError(`items.${index}.qty` as any, {
            type: "manual",
            message: "Qty must be greater than 0",
          });
        } else if (hasClosing && closing !== undefined && qtyNum > Number(closing)) {
          hasError = true;
          form.setError(`items.${index}.qty` as any, {
            type: "manual",
            message: `Cannot exceed closing (${closing})`,
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
          qty: Number(r.qty),
          rate: 0,
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
                  <div className="col-span-4">Item</div>
                  <div className="col-span-2">Closing Stock</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                {fields.map((field, index) => {
                  const itemsVal = watch("items") || [];
                  const row = itemsVal[index];
                  const selectedId = row?.itemId || "";
                  const closingMap = closingStockMap || {};
                  const closingVal = selectedId ? closingMap[Number(selectedId)] : undefined;

                  const unitName = (() => {
                    if (!selectedId) return "-";
                    const found = (itemsData?.data || []).find((it: any) => String(it.id) === String(selectedId));
                    return found?.unit?.unitName || "-";
                  })();

                  const usedIds = new Set<string>(
                    itemsVal
                      .map((v: any, i: number) => (i !== index ? v?.itemId || "" : ""))
                      .filter((v: string) => !!v)
                  );
                  const itemOptions = ((itemsData?.data as any[]) || [])
                    .filter((it: any) => !usedIds.has(String(it.id)))
                    .map((it: any) => ({ value: String(it.id), label: it.item }));

                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-3 items-center py-2 border-b">
                      <div className="col-span-1">{index + 1}</div>
                      <div className="col-span-4">
                        <ComboboxInput
                          control={control}
                          name={`items.${index}.itemId`}
                          options={siteIdVal ? itemOptions : []}
                          placeholder="Select item"
                        />
                      </div>
                      <div className="col-span-2">{selectedId ? (closingVal ?? "-") : '-'}</div>
                      <div className="col-span-2">{unitName}</div>
                      <div className="col-span-2">
                        <TextInput
                          control={control}
                          name={`items.${index}.qty`}
                          label=""
                          type="number"
                          step="0.0001"
                          placeholder="0"
                          span={12}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
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
                    </div>
                  );
                })}

                <div className="flex gap-2 pt-2">
                  <AppButton
                    type="button"
                    variant="secondary"
                    iconName="Plus"
                    onClick={() => append({ itemId: "", qty: "" })}
                  >
                    Add Row
                  </AppButton>
                </div>
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
