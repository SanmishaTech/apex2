"use client";

import { useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
  unit?: { unitName: string } | null;
}
interface ItemsResponse {
  data: ItemOption[];
}

const detailSchema = z.object({
  itemId: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => v !== "__none" && v !== "" && v !== "0", "Item is required")
    .transform((v) => parseInt(v)),
  openingStock: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((v) => Number.isFinite(v) && v > 0, "Opening stock must be > 0"),
  openingRate: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((v) => Number.isFinite(v) && v > 0, "Opening rate must be > 0"),
  openingValue: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((v) => Number.isFinite(v) && v > 0, "Opening value must be > 0"),
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
  }[];
};

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
    "/api/items/options",
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
    const details = rows.map((si: any) => ({
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
    }));
    form.reset({ siteId: form.getValues("siteId"), details });
    prefilledSiteRef.current = siteKey;
  }, [siteItemsData, watchSiteId, siteIdFromQuery]);

  function addRow() {
    append({
      itemId: "__none",
      openingStock: "",
      openingRate: "",
      openingValue: "",
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
                    <tr key={f.id} className="border-t">
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
                                  type="number"
                                  step="0.0001"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    onQtyRateChange(index);
                                  }}
                                  className="text-sm"
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
                                  type="number"
                                  step="0.01"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    onQtyRateChange(index);
                                  }}
                                  className="text-sm"
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
                                  typeof si?.unitRate === "number"
                                    ? si.unitRate
                                    : 0;
                                return (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Unit Rate: {v}
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
