"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { FormSection, FormRow } from "@/components/common/app-form";
import { AppSelect } from "@/components/common/app-select";
import { TextInput } from "@/components/common/text-input";
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { SitesResponse } from "@/types/sites";
import { ComboboxInput } from "@/components/common/combobox-input";
import { CheckboxInput } from "@/components/common/checkbox-input";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

export interface SiteBudgetsFormInitialData {
  id?: number;
  siteId?: number | null;
  boqId?: number | null;
  overallSiteBudgetId?: number | null;
  month?: string | null;
  week?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  siteBudgetDetails?: Array<{
    id?: number;
    SiteBudgetId?: number;
    BoqItemId: number;
    siteBudgetItems?: Array<{
      id?: number;
      itemId: number;
      budgetQty: string | number | null;
      budgetRate: string | number | null;
      purchaseRate?: string | number | null;
      budgetValue?: string | number | null;
    }>;
  }>;
}

export interface SiteBudgetsFormProps {
  mode: "create" | "edit";
  initial?: SiteBudgetsFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const budgetItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  budgetQty: z.string().min(1, "Budget Qty is required"),
  budgetRate: z.string().min(1, "Budget Rate is required"),
  purchaseRate: z.string().min(1, "Purchase Rate is required"),
});

const inputSchema = z
  .object({
    siteId: z.string().min(1, "Site is required"),
    boqId: z.string().min(1, "BOQ is required"),
    overallSiteBudgetId: z.string().min(1, "Overall Budget is required"),
    month: z.string().min(1, "Month is required"),
    week: z.string().min(1, "Week is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    applyOverallBudgetValidation: z.boolean().optional().default(false),
    details: z
      .array(
        z.object({
          boqItemId: z.string().min(1),
          items: z.array(budgetItemSchema).optional().default([]),
        })
      )
      .default([]),
  })
  .refine(
    (data) => {
      if (data.fromDate && data.toDate) {
        return new Date(data.fromDate) <= new Date(data.toDate);
      }
      return true;
    },
    {
      message: "To date must be after or equal to from date",
      path: ["toDate"],
    }
  );

type RawFormValues = z.infer<typeof inputSchema>;

function toSubmitPayload(data: RawFormValues) {
  return {
    siteId: parseInt(data.siteId),
    boqId: parseInt(data.boqId),
    overallSiteBudgetId: parseInt(data.overallSiteBudgetId),
    month: data.month,
    week: data.week,
    fromDate: data.fromDate,
    toDate: data.toDate,
    applyOverallBudgetValidation: Boolean(data.applyOverallBudgetValidation),
    details: (data.details || []).map((d) => ({
      boqItemId: parseInt(d.boqItemId),
      items: (d.items || []).map((it) => ({
        itemId: parseInt(it.itemId),
        budgetQty: Number(it.budgetQty),
        budgetRate: Number(it.budgetRate),
        purchaseRate: Number(it.purchaseRate),
        budgetValue: Number(it.budgetQty) * Number(it.budgetRate),
      })),
    })),
  };
}

function monthIndexFromLabel(label: string): number | null {
  const monthName = String(label || "").trim().split(" ")[0];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const idx = names.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
  return idx >= 0 ? idx : null;
}

function yearFromLabel(label: string): number | null {
  const parts = String(label || "").trim().split(" ");
  const yearStr = parts[parts.length - 1];
  const y = Number(yearStr);
  return Number.isFinite(y) ? y : null;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  // eslint-disable-next-line no-mixed-operators
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildMonthYearOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const opts: Array<{ value: string; label: string }> = [];
  for (const y of years) {
    for (const m of names) {
      const label = `${m} ${y}`;
      opts.push({ value: label, label });
    }
  }
  return opts;
}

function buildWeekOptions(monthLabel: string): Array<{ value: string; label: string }> {
  if (!monthLabel) return [];
  return Array.from({ length: 4 }).map((_, i) => {
    const label = `${ordinal(i + 1)} Week`;
    return { value: label, label };
  });
}

function formatDdMmYyyyFromDateOnly(value: string) {
  const s = String(value || "").trim();
  if (!s) return "";
  // Prefer stable parsing: for ISO timestamps, take only the date part to avoid timezone shift.
  const dateOnly = s.includes("T") ? s.slice(0, 10) : s;
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return s;
  return `${dd}/${mm}/${yyyy}`;
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
  boqItemId,
  form,
  itemOptions,
  itemMetaById,
  overallBudgetViolationsByItemId,
  disabled,
}: {
  detailIndex: number;
  boqItemId: number;
  form: any;
  itemOptions: Array<{ value: string; label: string }>;
  itemMetaById: Map<string, { unitName: string }>;
  overallBudgetViolationsByItemId?: Map<
    number,
    {
      budgetQty?: { used: number; overall: number };
      budgetRate?: { used: number; overall: number };
      budgetValue?: { used: number; overall: number };
    }
  >;
  disabled?: boolean;
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

  function fmt2n(v: unknown): number {
    return Number(fmt2(v));
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
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y">
            {fields.length ? (
              fields.map((f, itemIndex) => (
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

                    {(() => {
                      const itemId = Number(watchedItems?.[itemIndex]?.itemId || 0);
                      const v = overallBudgetViolationsByItemId?.get(itemId)?.budgetQty;
                      if (!v) return null;
                      return (
                        <div className="mt-1 text-[11px] text-red-600">
                          {fmt2(v.used)}/{fmt2(v.overall)}
                        </div>
                      );
                    })()}
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

                    {(() => {
                      const itemId = Number(watchedItems?.[itemIndex]?.itemId || 0);
                      const v = overallBudgetViolationsByItemId?.get(itemId)?.budgetRate;
                      if (!v) return null;
                      return (
                        <div className="mt-1 text-[11px] text-red-600">
                          {fmt2(v.used)}/{fmt2(v.overall)}
                        </div>
                      );
                    })()}
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
                        itemMetaById.get(String(watchedItems?.[itemIndex]?.itemId || ""))?.unitName || "—"
                      }
                    >
                      {itemMetaById.get(String(watchedItems?.[itemIndex]?.itemId || ""))?.unitName || "—"}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 flex flex-col items-end justify-start">
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

                    {(() => {
                      const itemId = Number(watchedItems?.[itemIndex]?.itemId || 0);
                      const v = overallBudgetViolationsByItemId?.get(itemId)?.budgetValue;
                      if (!v) return null;
                      return (
                        <div className="mt-1 text-[11px] text-red-600 text-right w-full">
                          {fmt2(v.used)}/{fmt2(v.overall)}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-1 flex justify-end">
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
                  </div>
                </div>
              ))
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground">No budget items added.</div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}

export function SiteBudgetsForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/site-budgets",
}: SiteBudgetsFormProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";
  const [prevSiteId, setPrevSiteId] = useState<string>("");
  const [showOverallBudgetValidationToggle, setShowOverallBudgetValidationToggle] =
    useState(false);
  const [overallBudgetViolationsByBoqItemId, setOverallBudgetViolationsByBoqItemId] =
    useState<
      Map<
        number,
        Map<
          number,
          {
            budgetQty?: { used: number; overall: number };
            budgetRate?: { used: number; overall: number };
            budgetValue?: { used: number; overall: number };
          }
        >
      >
    >(
      new Map()
    );

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
      overallSiteBudgetId: initial?.overallSiteBudgetId
        ? String(initial.overallSiteBudgetId)
        : "",
      month: initial?.month || "",
      week: initial?.week || "",
      fromDate: initial?.fromDate || "",
      toDate: initial?.toDate || "",
      applyOverallBudgetValidation: true,
      details: (initial?.siteBudgetDetails || []).map((d) => ({
        boqItemId: String(d.BoqItemId),
        items: (d.siteBudgetItems || []).map((it) => ({
          itemId: String(it.itemId),
          budgetQty: it.budgetQty == null ? "" : String(it.budgetQty),
          budgetRate: it.budgetRate == null ? "" : String(it.budgetRate),
          purchaseRate: (it as any).purchaseRate == null ? "" : String((it as any).purchaseRate),
        })),
      })),
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const selectedSiteId = form.watch("siteId");
  const selectedBoqId = form.watch("boqId");
  const selectedOverallSiteBudgetId = form.watch("overallSiteBudgetId");
  const selectedMonth = form.watch("month");
  const selectedWeek = form.watch("week");
  const applyOverallBudgetValidation = form.watch("applyOverallBudgetValidation");

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);
  const weekOptions = useMemo(
    () => buildWeekOptions(selectedMonth),
    [selectedMonth]
  );

  const { data: boqsData } = useSWR<any>(
    selectedSiteId ? `/api/boqs?perPage=100&siteId=${selectedSiteId}` : null,
    apiGet
  );

  const { data: overallBudgetsData } = useSWR<any>(
    selectedSiteId && selectedBoqId
      ? `/api/overall-site-budgets?perPage=100&siteId=${selectedSiteId}&boqId=${selectedBoqId}`
      : null,
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
    return (detailsWatch || []).map((d) => {
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
      form.setValue("overallSiteBudgetId", "", { shouldDirty: true, shouldValidate: false });
      replace([]);
      return;
    }

    if (prevSiteId && prevSiteId !== selectedSiteId) {
      form.setValue("boqId", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("overallSiteBudgetId", "", { shouldDirty: true, shouldValidate: false });
      replace([]);
    }

    if (prevSiteId !== selectedSiteId) setPrevSiteId(selectedSiteId);
  }, [selectedSiteId, prevSiteId, form, replace]);

  useEffect(() => {
    if (!applyOverallBudgetValidation) {
      setOverallBudgetViolationsByBoqItemId(new Map());
    }
  }, [applyOverallBudgetValidation]);

  useEffect(() => {
    if (!selectedMonth) {
      form.setValue("week", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("fromDate", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("toDate", "", { shouldDirty: true, shouldValidate: false });
      return;
    }
    if (selectedWeek && weekOptions.every((w) => w.value !== selectedWeek)) {
      form.setValue("week", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("fromDate", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("toDate", "", { shouldDirty: true, shouldValidate: false });
    }
  }, [selectedMonth, selectedWeek, weekOptions, form]);

  useEffect(() => {
    const current = (form.getValues("details") || []) as RawFormValues["details"];
    if (!selectedBoqId) {
      if (current.length) replace([]);
      return;
    }

    if (!Array.isArray(boqItems) || boqItems.length === 0) return;

    const itemsByBoqItemId = new Map<string, any[]>();
    current.forEach((d) => {
      if (!d?.boqItemId) return;
      itemsByBoqItemId.set(String(d.boqItemId), d.items || []);
    });

    if (!current.length && Array.isArray(initial?.siteBudgetDetails)) {
      initial.siteBudgetDetails.forEach((d) => {
        const k = String(d.BoqItemId);
        const rows = (d.siteBudgetItems || []).map((it) => ({
          itemId: String(it.itemId),
          budgetQty: it.budgetQty == null ? "" : String(it.budgetQty),
          budgetRate: it.budgetRate == null ? "" : String(it.budgetRate),
          purchaseRate: (it as any).purchaseRate == null ? "" : String((it as any).purchaseRate),
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
      current.every((d, i) => String(d?.boqItemId) === String((next[i] as any)?.boqItemId));

    if (!isSame) replace(next as any);
  }, [selectedBoqId, boqItems, replace, form, initial?.siteBudgetDetails]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      setOverallBudgetViolationsByBoqItemId(new Map());
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost("/api/site-budgets", payload);
        toast.success("Site Budget created");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
        const res = await apiPatch("/api/site-budgets", { id: initial.id, ...payload });
        toast.success("Site Budget updated");
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { data?: any };
      const code = e?.data?.code;
      if (code === "OVERALL_BUDGET_VALIDATION") {
        setShowOverallBudgetValidationToggle(true);
        const violations = Array.isArray(e?.data?.violations) ? e.data.violations : [];
        const next = new Map<
          number,
          Map<
            number,
            {
              budgetQty?: { used: number; overall: number };
              budgetRate?: { used: number; overall: number };
              budgetValue?: { used: number; overall: number };
            }
          >
        >();
        for (const v of violations) {
          const boqItemId = Number(v?.boqItemId || 0);
          const itemId = Number(v?.itemId || 0);
          if (!(boqItemId > 0 && itemId > 0)) continue;
          if (!next.has(boqItemId)) next.set(boqItemId, new Map());

          const current = next.get(boqItemId)!.get(itemId) || {};
          const field = String(v?.field || "");
          if (field === "budgetQty") {
            next.get(boqItemId)!.set(itemId, {
              ...current,
              budgetQty: {
                used: Number(v?.usedValue || 0),
                overall: Number(v?.overallValue || 0),
              },
            });
          } else if (field === "budgetRate") {
            next.get(boqItemId)!.set(itemId, {
              ...current,
              budgetRate: {
                used: Number(v?.incomingValue || 0),
                overall: Number(v?.overallValue || 0),
              },
            });
          } else if (field === "budgetValue") {
            next.get(boqItemId)!.set(itemId, {
              ...current,
              budgetValue: {
                used: Number(v?.usedValue || 0),
                overall: Number(v?.overallValue || 0),
              },
            });
          }
        }
        setOverallBudgetViolationsByBoqItemId(next);

        toast.error("Budget Validation Error");
        return;
      }

      toast.error(e.message || "Failed");
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

  const overallBudgetOptions = (overallBudgetsData?.data || [])
    .filter((b: any) => Boolean((b as any)?.isProjectApprovalDone))
    .map((b: any) => ({
    value: String(b.id),
    label: `(${b?.boq?.boqNo || `BOQ ${b?.boqId || ""}` || ""} - ${
      b?.site?.site || ""
    })`,
  }));

  const siteLabel = siteOptions.find((o) => o.value === selectedSiteId)?.label || "";
  const boqLabel = boqOptions.find((o) => o.value === selectedBoqId)?.label || "";
  const overallBudgetLabel =
    overallBudgetOptions.find((o) => o.value === selectedOverallSiteBudgetId)?.label || "";
  const fromDateVal = form.watch("fromDate");
  const toDateVal = form.watch("toDate");

  const fromDateDisplay = isCreate ? fromDateVal : formatDdMmYyyyFromDateOnly(fromDateVal);
  const toDateDisplay = isCreate ? toDateVal : formatDdMmYyyyFromDateOnly(toDateVal);

  return (
    <Form {...form}>
      <AppCard className="w-auto mx-auto">
        <AppCard.Header>
          <AppCard.Title>{isCreate ? "Create Site Budget" : "Edit Site Budget"}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add a new site budget." : "Update site budget."}
          </AppCard.Description>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Budget Information">
              <FormRow cols={3} from="md">
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

                {isCreate ? (
                  <AppSelect
                    control={control}
                    name="month"
                    label="Month"
                    placeholder="Select month"
                    triggerClassName="h-9 w-full"
                  >
                    {monthOptions.map((opt) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                ) : (
                  <ReadonlyField label="Month" value={selectedMonth} />
                )}
              </FormRow>

              <FormRow cols={3} from="md">
                {isCreate ? (
                  <AppSelect
                    control={control}
                    name="week"
                    label="Week"
                    placeholder={selectedMonth ? "Select week" : "Select month first"}
                    triggerClassName="h-9 w-full"
                    disabled={!selectedMonth}
                  >
                    {weekOptions.map((opt) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                ) : (
                  <ReadonlyField label="Week" value={selectedWeek} />
                )}

                {isCreate ? (
                  <div className="grid gap-1">
                    <div className="text-xs font-medium">From Date</div>
                    <TextInput
                      control={control}
                      name="fromDate"
                      label=""
                      type="date"
                      disabled={!selectedMonth}
                    />
                  </div>
                ) : (
                  <ReadonlyField label="From Date" value={formatDdMmYyyyFromDateOnly(fromDateVal)} />
                )}

                {isCreate ? (
                  <div className="grid gap-1">
                    <div className="text-xs font-medium">To Date</div>
                    <TextInput
                      control={control}
                      name="toDate"
                      label=""
                      type="date"
                      disabled={!selectedMonth}
                    />
                  </div>
                ) : (
                  <ReadonlyField label="To Date" value={toDateDisplay} />
                )}
              </FormRow>

              <FormRow cols={1} from="md">
                {isCreate ? (
                  <ComboboxInput
                    control={control}
                    name="overallSiteBudgetId"
                    label="Overall Budget"
                    required
                    options={overallBudgetOptions}
                    placeholder={
                      selectedSiteId && selectedBoqId
                        ? "Select Overall Budget"
                        : "Select Site and BOQ first"
                    }
                  />
                ) : (
                  <ReadonlyField label="Overall Budget" value={overallBudgetLabel} />
                )}
              </FormRow>
            </FormSection>

            <FormSection legend="BOQ Items">
              <div className="flex flex-col gap-4">
                {computedRows.map((row, idx) => (
                  <div key={row.boqItemId} className="rounded-md border border-border bg-card">
                    <div className="flex flex-col gap-1 p-3 border-b bg-muted/20 text-xs">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-muted-foreground">Activity ID</div>
                          <div className="font-medium text-xs">{row.item?.activityId || "—"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-muted-foreground">BOQ Qty</div>
                          <div className="font-mono text-xs">{Number(row.item?.qty || 0).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div className="min-w-0 w-auto">
                          <div className="text-[11px] text-muted-foreground">Item</div>
                          <div className="font-medium text-xs whitespace-normal break-words">{row.item?.item || "—"}</div>
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
                        boqItemId={row.boqItemId}
                        form={form}
                        itemOptions={itemOptions}
                        itemMetaById={itemMetaById}
                        overallBudgetViolationsByItemId={overallBudgetViolationsByBoqItemId.get(
                          Number(row.boqItemId)
                        )}
                        disabled={Boolean(row.isGroup)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className="justify-end gap-2">
            {showOverallBudgetValidationToggle &&
            can(PERMISSIONS.BYPASS_OVERALL_SITE_BUDGET_VALIDATION) ? (
              <div className="mr-auto">
                <CheckboxInput
                  control={control}
                  name="applyOverallBudgetValidation"
                  label="Apply Budget Validation"
                  description="Uncheck to save without budget validation."
                />
              </div>
            ) : null}
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName={isCreate ? "Plus" : "Save"}
              isLoading={submitting}
              disabled={submitting}
            >
              {isCreate ? "Create" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
