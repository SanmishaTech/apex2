"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { FormSection, FormRow } from "@/components/common/app-form";
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { SitesResponse } from "@/types/sites";
import { ComboboxInput } from "@/components/common/combobox-input";
import { TextInput } from "@/components/common/text-input";

export interface OverallSiteBudgetsFormInitialData {
  id?: number;
  siteId?: number | null;
  boqId?: number | null;
  overallSiteBudgetDetails?: Array<{
    id?: number;
    overallSiteBudgetId?: number;
    BoqItemId: number;
    overallSiteBudgetItems?: Array<{
      id?: number;
      itemId: number;
      budgetQty: string | number | null;
      budgetRate: string | number | null;
      purchaseRate?: string | number | null;
      budgetValue?: string | number | null;
    }>;
  }>;
}

export interface OverallSiteBudgetsFormProps {
  mode:
    | "create"
    | "edit"
    | "view"
    | "techApproval"
    | "commercialApproval"
    | "projectApproval";
  initial?: OverallSiteBudgetsFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const budgetItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  budgetQty: z.string().min(1, "Budget Qty is required"),
  budgetRate: z.string().min(1, "Budget Rate is required"),
  purchaseRate: z.string().min(1, "Purchase Rate is required"),
});

const inputSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  boqId: z.string().min(1, "BOQ is required"),
  details: z
    .array(
      z.object({
        boqItemId: z.string().min(1),
        items: z.array(budgetItemSchema).optional().default([]),
      })
    )
    .default([]),
});

type RawFormValues = z.infer<typeof inputSchema>;

function toSubmitPayload(data: RawFormValues) {
  return {
    siteId: parseInt(data.siteId),
    boqId: parseInt(data.boqId),
    details: (data.details || []).map((d) => ({
      boqItemId: parseInt(d.boqItemId),
      items: (d.items || []).map((it) => ({
        itemId: parseInt(it.itemId),
        budgetQty: Number(it.budgetQty),
        budgetRate: Number(it.budgetRate),
        purchaseRate: Number(it.purchaseRate),
      })),
    })),
  };
}

function ReadonlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="h-9 flex items-center rounded-md border bg-muted/30 px-3 text-sm">
        {value || "—"}
      </div>
    </div>
  );
}

function BudgetItemsEditor({
  detailIndex,
  form,
  itemOptions,
  itemMetaById,
  disabled,
  hideActions,
}: {
  detailIndex: number;
  form: any;
  itemOptions: Array<{ value: string; label: string }>;
  itemMetaById: Map<string, { unitName: string }>;
  disabled?: boolean;
  hideActions?: boolean;
}) {
  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.items` as any,
  });

  const watchedItems = useWatch({ control, name: `details.${detailIndex}.items` as any });

  function toNumber(v: unknown): number {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(String(v));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt2(v: unknown): string {
    return toNumber(v).toFixed(2);
  }

  function sanitizeDecimalInput(raw: string): string {
    let s = String(raw ?? "");
    s = s.replace(/[^0-9.]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot >= 0) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    const [intPart, decPart] = s.split(".");
    if (decPart !== undefined) {
      return `${intPart}.${decPart.slice(0, 2)}`;
    }
    return intPart;
  }

  function normalizeDecimalOnBlur(raw: string): string {
    const s = sanitizeDecimalInput(raw);
    if (!s) return "";
    if (s === ".") return "";
    const n = Number(s);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="min-w-[1020px] rounded-md border border-border text-xs">
          <div className="grid grid-cols-14 gap-2 bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Budget Qty</div>
            <div className="col-span-2">Budget Rate</div>
            <div className="col-span-2">Purchase Rate</div>
            <div className="col-span-1">Unit</div>
            <div className="col-span-2 text-right">Budget Value</div>
            {!hideActions ? (
              <div className="col-span-1 text-right">Actions</div>
            ) : (
              <div className="col-span-1 text-right"></div>
            )}
          </div>

          <div className="divide-y">
            {fields.length ? (
              fields.map((f: any, itemIndex: number) => (
                <div key={f.id} className="grid grid-cols-14 gap-2 px-2 py-2 items-start">
                  <div className="col-span-4">
                    <ComboboxInput
                      control={control}
                      name={`details.${detailIndex}.items.${itemIndex}.itemId`}
                      required
                      options={itemOptions}
                      placeholder="Select Item"
                      inputClassName="h-7 text-xs whitespace-pre-line text-left leading-tight"
                      disabled={disabled}
                    />
                  </div>
                  <div className="col-span-2">
                    <TextInput
                      control={control}
                      name={`details.${detailIndex}.items.${itemIndex}.budgetQty`}
                      type="text"
                      inputMode="decimal"
                      onValueChange={sanitizeDecimalInput}
                      onValueBlur={normalizeDecimalOnBlur}
                      className="h-7 px-2 text-xs"
                      disabled={disabled}
                    />
                  </div>
                  <div className="col-span-2">
                    <TextInput
                      control={control}
                      name={`details.${detailIndex}.items.${itemIndex}.budgetRate`}
                      type="text"
                      inputMode="decimal"
                      onValueChange={sanitizeDecimalInput}
                      onValueBlur={normalizeDecimalOnBlur}
                      className="h-7 px-2 text-xs"
                      disabled={disabled}
                    />
                  </div>
                  <div className="col-span-2">
                    <TextInput
                      control={control}
                      name={`details.${detailIndex}.items.${itemIndex}.purchaseRate`}
                      type="text"
                      inputMode="decimal"
                      onValueChange={sanitizeDecimalInput}
                      onValueBlur={normalizeDecimalOnBlur}
                      className="h-7 px-2 text-xs"
                      disabled={disabled}
                    />
                  </div>
                  <div className="col-span-1 min-w-0 flex items-center">
                    <div
                      className="text-[10px] leading-tight text-muted-foreground whitespace-nowrap truncate"
                      title={
                        itemMetaById.get(String(watchedItems?.[itemIndex]?.itemId || ""))?.unitName ||
                        "—"
                      }
                    >
                      {itemMetaById.get(String(watchedItems?.[itemIndex]?.itemId || ""))?.unitName ||
                        "—"}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 flex items-center justify-end">
                    <div
                      className="text-[10px] leading-tight text-foreground font-mono tabular-nums whitespace-nowrap truncate"
                      title={fmt2(
                        toNumber(watchedItems?.[itemIndex]?.budgetQty) *
                          toNumber(watchedItems?.[itemIndex]?.budgetRate)
                      )}
                    >
                      {fmt2(
                        toNumber(watchedItems?.[itemIndex]?.budgetQty) *
                          toNumber(watchedItems?.[itemIndex]?.budgetRate)
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {!hideActions ? (
                      <AppButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        iconName="Trash2"
                        className="h-7 w-7 bg-red-600 text-white hover:text-white"
                        onClick={() => remove(itemIndex)}
                        disabled={disabled}
                        aria-label="Remove item"
                        title="Remove"
                      >
                        <span className="sr-only">Remove</span>
                      </AppButton>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground">No budget items added.</div>
            )}
          </div>
        </div>
      </div>

      {!hideActions ? (
        <div>
          <AppButton
            type="button"
            size="sm"
            iconName="Plus"
            className="h-7 text-xs"
            onClick={() =>
              append({
                itemId: "",
                budgetQty: "",
                budgetRate: "",
                purchaseRate: "",
              } as any)
            }
            disabled={disabled}
          >
            Add Item
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

export function OverallSiteBudgetsForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/overall-site-budgets",
}: OverallSiteBudgetsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";
  const isView = mode === "view";
  const isApproval =
    mode === "techApproval" ||
    mode === "commercialApproval" ||
    mode === "projectApproval";
  const readonly = isView || isApproval;
  const [prevSiteId, setPrevSiteId] = useState<string>("");

  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : "",
      boqId: initial?.boqId ? String(initial.boqId) : "",
      details: (initial?.overallSiteBudgetDetails || []).map((d) => ({
        boqItemId: String(d.BoqItemId),
        items: (d.overallSiteBudgetItems || []).map((it) => ({
          itemId: String(it.itemId),
          budgetQty: it.budgetQty == null ? "" : String(it.budgetQty),
          budgetRate: it.budgetRate == null ? "" : String(it.budgetRate),
          purchaseRate:
            (it as any).purchaseRate == null ? "" : String((it as any).purchaseRate),
        })),
      })),
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const selectedSiteId = form.watch("siteId");
  const selectedBoqId = form.watch("boqId");

  const { data: boqsData } = useSWR<any>(
    selectedSiteId ? `/api/boqs?perPage=100&siteId=${selectedSiteId}` : null,
    apiGet
  );

  const boqDetailUrl = useMemo(() => {
    if (!selectedBoqId) return null;
    return `/api/boqs/${selectedBoqId}`;
  }, [selectedBoqId]);
  const { data: boqDetail } = useSWR<any>(boqDetailUrl, apiGet);

  const boqItems: any[] = useMemo(
    () => (Array.isArray(boqDetail?.items) ? boqDetail.items : []),
    [boqDetail?.items]
  );

  const itemsById = useMemo(() => {
    const map = new Map<number, any>();
    boqItems.forEach((it) => map.set(Number(it.id), it));
    return map;
  }, [boqItems]);

  const detailsWatch = useWatch({ control, name: "details" });
  const computedRows = useMemo(() => {
    return (detailsWatch || []).map((d: any) => {
      const id = Number(d?.boqItemId);
      const item = itemsById.get(id);
      const unitName = item?.unit?.unitName || "—";
      const isGroup = Boolean(item?.isGroup);
      return { boqItemId: id, item, unitName, isGroup };
    });
  }, [detailsWatch, itemsById]);

  const { data: itemsData } = useSWR<any>("/api/items?perPage=1000", apiGet);
  const itemOptions = (itemsData?.data || []).map((it: any) => ({
    value: String(it.id),
    label: `${it.itemCode} - ${it.item}`,
  }));

  const itemMetaById = useMemo(() => {
    const map = new Map<string, { unitName: string }>();
    (itemsData?.data || []).forEach((it: any) => {
      map.set(String(it.id), { unitName: it?.unit?.unitName || "—" });
    });
    return map;
  }, [itemsData?.data]);

  useEffect(() => {
    if (!selectedSiteId) {
      setPrevSiteId("");
      form.setValue("boqId", "", { shouldDirty: true, shouldValidate: false });
      replace([]);
      return;
    }

    if (prevSiteId && prevSiteId !== selectedSiteId) {
      form.setValue("boqId", "", { shouldDirty: true, shouldValidate: false });
      replace([]);
    }

    if (prevSiteId !== selectedSiteId) setPrevSiteId(selectedSiteId);
  }, [selectedSiteId, prevSiteId, form, replace]);

  useEffect(() => {
    const current = (form.getValues("details") || []) as RawFormValues["details"];
    if (!selectedBoqId) {
      if (current.length) replace([]);
      return;
    }

    if (!Array.isArray(boqItems) || boqItems.length === 0) return;

    const itemsByBoqItemId = new Map<string, any[]>();
    current.forEach((d: any) => {
      if (!d?.boqItemId) return;
      itemsByBoqItemId.set(String(d.boqItemId), d.items || []);
    });

    if (!current.length && Array.isArray(initial?.overallSiteBudgetDetails)) {
      initial.overallSiteBudgetDetails.forEach((d) => {
        const k = String(d.BoqItemId);
        const rows = (d.overallSiteBudgetItems || []).map((it) => ({
          itemId: String(it.itemId),
          budgetQty: it.budgetQty == null ? "" : String(it.budgetQty),
          budgetRate: it.budgetRate == null ? "" : String(it.budgetRate),
          purchaseRate:
            (it as any).purchaseRate == null ? "" : String((it as any).purchaseRate),
        }));
        itemsByBoqItemId.set(k, rows);
      });
    }

    const next = boqItems.map((it: any) => {
      const key = String(it.id);
      return {
        boqItemId: key,
        items: itemsByBoqItemId.get(key) || [],
      };
    });

    const isSame =
      current.length === next.length &&
      current.every((d: any, i: number) =>
        String(d?.boqItemId) === String((next[i] as any)?.boqItemId)
      );

    if (!isSame) replace(next as any);
  }, [selectedBoqId, boqItems, replace, form, initial?.overallSiteBudgetDetails]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost("/api/overall-site-budgets", payload);
        toast.success("Overall Site Budget created");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const res = await apiPatch("/api/overall-site-budgets", {
          id: initial.id,
          ...payload,
        });
        toast.success("Overall Site Budget updated");
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!initial?.id) return;
    const statusAction =
      mode === "techApproval"
        ? "approveTech"
        : mode === "commercialApproval"
        ? "approveCommercial"
        : "approveProject";

    setSubmitting(true);
    try {
      const res = await apiPatch(`/api/overall-site-budgets/${initial.id}`, {
        statusAction,
      });
      toast.success("Approved");
      onSuccess?.(res);
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const siteOptions = (sitesData?.data || []).map((s) => ({
    value: String(s.id),
    label: s.site,
  }));

  const boqOptions = (boqsData?.data || []).map((b: any) => ({
    value: String(b.id),
    label: b?.boqNo || `BOQ ${b?.id}`,
  }));

  const siteLabel = siteOptions.find((o) => o.value === selectedSiteId)?.label || "";
  const boqLabel = boqOptions.find((o) => o.value === selectedBoqId)?.label || "";

  return (
    <Form {...form}>
      <AppCard className="w-auto mx-auto">
        <AppCard.Header>
          <AppCard.Title>
            {isCreate
              ? "Create Overall Site Budget"
              : isView
              ? "View Overall Site Budget"
              : mode === "techApproval"
              ? "Tech Approval"
              : mode === "commercialApproval"
              ? "Commercial Approval"
              : mode === "projectApproval"
              ? "Project Approval"
              : "Edit Overall Site Budget"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new overall site budget."
              : readonly
              ? "Review overall site budget."
              : "Update overall site budget."}
          </AppCard.Description>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Budget Information">
              <FormRow cols={2} from="md">
                {isCreate ? (
                  <ComboboxInput
                    control={control}
                    name="siteId"
                    label="Site"
                    required
                    options={siteOptions}
                    placeholder="Select Site"
                  />
                ) : (
                  <ReadonlyField label="Site" value={siteLabel} />
                )}

                {isCreate ? (
                  <ComboboxInput
                    control={control}
                    name="boqId"
                    label="BOQ"
                    required
                    options={boqOptions}
                    placeholder={selectedSiteId ? "Select BOQ" : "Select Site first"}
                  />
                ) : (
                  <ReadonlyField label="BOQ" value={boqLabel} />
                )}
              </FormRow>
            </FormSection>

            <FormSection legend="BOQ Items">
              <div className="flex flex-col gap-4">
                {computedRows.map((row: any, idx: number) => (
                  <div key={row.boqItemId} className="rounded-md border border-border bg-card">
                    <div className="flex flex-col gap-1 p-3 border-b bg-muted/20 text-xs">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-muted-foreground">Activity ID</div>
                          <div className="font-medium text-xs">{row.item?.activityId || "—"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-muted-foreground">BOQ Qty</div>
                          <div className="font-mono text-xs">
                            {Number(row.item?.qty || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div className="min-w-0 w-auto">
                          <div className="text-[11px] text-muted-foreground">Item</div>
                          <div className="font-medium text-xs whitespace-normal break-words">
                            {row.item?.item || "—"}
                          </div>
                        </div>
                        <div className="md:text-right">
                          <div className="text-[11px] text-muted-foreground">Unit</div>
                          <div className="text-xs">{row.unitName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      <BudgetItemsEditor
                        detailIndex={idx}
                        form={form}
                        itemOptions={itemOptions}
                        itemMetaById={itemMetaById}
                        disabled={readonly ? true : Boolean(row.isGroup)}
                        hideActions={readonly}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className="justify-end gap-2">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            {readonly ? (
              isApproval ? (
                <AppButton
                  type="button"
                  iconName="Check"
                  isLoading={submitting}
                  disabled={submitting}
                  onClick={handleApprove}
                >
                  Approve
                </AppButton>
              ) : null
            ) : (
              <AppButton
                type="submit"
                iconName={isCreate ? "Plus" : "Save"}
                isLoading={submitting}
                disabled={submitting}
              >
                {isCreate ? "Create" : "Save Changes"}
              </AppButton>
            )}
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
