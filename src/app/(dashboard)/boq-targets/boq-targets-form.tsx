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

export interface BoqTargetsFormInitialData {
  id?: number;
  siteId?: number | null;
  boqId?: number | null;
  month?: string | null;
  week?: string | null;
  fromTargetDate?: string | null;
  toTargetDate?: string | null;
  boqTargetDetails?: Array<{
    id?: number;
    boqTargetId?: number;
    BoqItemId: number;
    dailyTargetQty: string | number | null;
  }>;
}

export interface BoqTargetsFormProps {
  mode: "create" | "edit";
  initial?: BoqTargetsFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/boq-targets'
}

const editSchema = z
  .object({
    siteId: z.string().min(1, "Site is required"),
    boqId: z.string().min(1, "BOQ is required"),
    month: z.string().min(1, "Month is required"),
    week: z.string().min(1, "Week is required"),
    fromTargetDate: z.string().min(1, "From target date is required"),
    toTargetDate: z.string().min(1, "To target date is required"),
    details: z
      .array(
        z.object({
          boqItemId: z.string().min(1),
          dailyTargetQty: z.string().optional().default(""),
        })
      )
      .default([]),
  })
  .refine(
    (data) => {
      if (data.fromTargetDate && data.toTargetDate) {
        return new Date(data.fromTargetDate) <= new Date(data.toTargetDate);
      }
      return true;
    },
    {
      message: "To target date must be after or equal to from target date",
      path: ["toTargetDate"],
    }
  );

const createSchema = z
  .object({
    siteId: z.string().min(1, "Site is required"),
    boqId: z.string().min(1, "BOQ is required"),
    month: z.string().min(1, "Month is required"),
    weeks: z
      .array(
        z.object({
          fromTargetDate: z.string().min(1, "From target date is required"),
          toTargetDate: z.string().min(1, "To target date is required"),
        })
      )
      .length(4),
    details: z
      .array(
        z.object({
          boqItemId: z.string().min(1),
          dailyTargetQty: z.string().optional().default(""),
        })
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    const mi = monthIndexFromLabel(data.month);
    const yr = yearFromLabel(data.month);
    if (mi === null || yr === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid month",
        path: ["month"],
      });
      return;
    }

    const bounds = monthBoundsIso(data.month);
    if (!bounds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid month",
        path: ["month"],
      });
      return;
    }

    function ymFromDateInput(dateStr: string): { y: number; m: number } | null {
      const parts = String(dateStr || "").split("-");
      if (parts.length !== 3) return null;
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
      return { y, m };
    }

    const weekRanges = (data.weeks || []).map((w) => ({
      from: String(w.fromTargetDate || ""),
      to: String(w.toTargetDate || ""),
    }));

    (data.weeks || []).forEach((w, idx) => {
      if (w.fromTargetDate && w.toTargetDate) {
        if (new Date(w.fromTargetDate) > new Date(w.toTargetDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "To target date must be after or equal to from target date",
            path: ["weeks", idx, "toTargetDate"],
          });
        }

        const fromYm = ymFromDateInput(w.fromTargetDate);
        const toYm = ymFromDateInput(w.toTargetDate);
        if (!fromYm || !toYm) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid date",
            path: ["weeks", idx],
          });
          return;
        }

        if (fromYm.y !== yr || fromYm.m !== mi) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "From target date must be within selected month",
            path: ["weeks", idx, "fromTargetDate"],
          });
        }
        if (toYm.y !== yr || toYm.m !== mi) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "To target date must be within selected month",
            path: ["weeks", idx, "toTargetDate"],
          });
        }
      }
    });

    let expectedFrom = bounds.min;
    for (let i = 0; i < weekRanges.length; i++) {
      const r = weekRanges[i];
      if (!r.from || !r.to) continue;

      if (r.from !== expectedFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Week ranges must be continuous without gaps. Expected from date: ${expectedFrom}`,
          path: ["weeks", i, "fromTargetDate"],
        });
      }

      const nextExpected = addDaysIso(r.to, 1);
      if (nextExpected) expectedFrom = nextExpected;

      if (i > 0) {
        const prevTo = weekRanges[i - 1]?.to;
        if (prevTo && r.from <= prevTo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Week dates must be after the previous week (no overlap)",
            path: ["weeks", i, "fromTargetDate"],
          });
        }
      }
    }

    const lastTo = weekRanges[weekRanges.length - 1]?.to;
    if (lastTo && lastTo !== bounds.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `All dates of the month must be covered. Expected last to date: ${bounds.max}`,
        path: ["weeks", weekRanges.length - 1, "toTargetDate"],
      });
    }
  });

type EditFormValues = z.infer<typeof editSchema>;
type CreateFormValues = z.infer<typeof createSchema>;

// Transform string inputs to correct types for API payload
function toEditSubmitPayload(data: EditFormValues) {
  return {
    siteId: data.siteId && data.siteId !== "" ? parseInt(data.siteId) : null,
    boqId: data.boqId && data.boqId !== "" ? parseInt(data.boqId) : null,
    month: data.month,
    week: data.week,
    fromTargetDate: new Date(data.fromTargetDate).toISOString(),
    toTargetDate: new Date(data.toTargetDate).toISOString(),
    details: (data.details || []).map((d) => ({
      boqItemId: parseInt(d.boqItemId),
      dailyTargetQty:
        d.dailyTargetQty === "" || d.dailyTargetQty === undefined
          ? null
          : Number(d.dailyTargetQty),
    })),
  };
}

function inclusiveDays(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const ms = toUtc - fromUtc;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(0, days);
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

function addDaysIso(dateIso: string, days: number): string | null {
  const parts = String(dateIso || "").split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m, d + Number(days || 0)));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function monthBoundsIso(monthLabel: string): { min: string; max: string } | null {
  const mi = monthIndexFromLabel(monthLabel);
  const yr = yearFromLabel(monthLabel);
  if (mi === null || yr === null) return null;
  const min = new Date(Date.UTC(yr, mi, 1)).toISOString().slice(0, 10);
  const lastDay = new Date(yr, mi + 1, 0).getDate();
  const max = new Date(Date.UTC(yr, mi, lastDay)).toISOString().slice(0, 10);
  return { min, max };
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
  const mi = monthIndexFromLabel(monthLabel);
  const yr = yearFromLabel(monthLabel);
  if (mi === null || yr === null) return [];
  const daysInMonth = new Date(yr, mi + 1, 0).getDate();
  const weeks = Math.ceil(daysInMonth / 7);
  return Array.from({ length: weeks }).map((_, i) => {
    const label = `${ordinal(i + 1)} Week`;
    return { value: label, label };
  });
}

function weekNumberFromLabel(label: string): number | null {
  const m = String(label || "").match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function computeWeekDateRange(monthLabel: string, weekLabel: string): { from: string; to: string } | null {
  const mi = monthIndexFromLabel(monthLabel);
  const yr = yearFromLabel(monthLabel);
  const wn = weekNumberFromLabel(weekLabel);
  if (mi === null || yr === null || wn === null) return null;
  const daysInMonth = new Date(yr, mi + 1, 0).getDate();
  const startDay = (wn - 1) * 7 + 1;
  const endDay = Math.min(startDay + 6, daysInMonth);
  const from = new Date(Date.UTC(yr, mi, startDay));
  const to = new Date(Date.UTC(yr, mi, endDay));
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);
  return { from: fromIso, to: toIso };
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

export function BoqTargetsForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/boq-targets",
}: BoqTargetsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";
  const [prevSiteId, setPrevSiteId] = useState<string>("");

  // Fetch sites for dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const form = useForm<any>({
    resolver: zodResolver(isCreate ? createSchema : editSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: (isCreate
      ? {
          siteId: initial?.siteId ? String(initial.siteId) : "",
          boqId: initial?.boqId ? String(initial.boqId) : "",
          month: initial?.month ? String(initial.month) : "",
          weeks: [
            { fromTargetDate: "", toTargetDate: "" },
            { fromTargetDate: "", toTargetDate: "" },
            { fromTargetDate: "", toTargetDate: "" },
            { fromTargetDate: "", toTargetDate: "" },
          ],
          details: (initial?.boqTargetDetails || []).map((d) => ({
            boqItemId: String(d.BoqItemId),
            dailyTargetQty:
              d.dailyTargetQty == null ? "" : Number(d.dailyTargetQty as any).toFixed(2),
          })),
        }
      : {
          siteId: initial?.siteId ? String(initial.siteId) : "",
          boqId: initial?.boqId ? String(initial.boqId) : "",
          month: initial?.month ? String(initial.month) : "",
          week: initial?.week ? String(initial.week) : "",
          fromTargetDate: initial?.fromTargetDate
            ? initial.fromTargetDate.split("T")[0]
            : "",
          toTargetDate: initial?.toTargetDate
            ? initial.toTargetDate.split("T")[0]
            : "",
          details: (initial?.boqTargetDetails || []).map((d) => ({
            boqItemId: String(d.BoqItemId),
            dailyTargetQty:
              d.dailyTargetQty == null ? "" : Number(d.dailyTargetQty as any).toFixed(2),
          })),
        }) as any,
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const weeksWatch = useWatch({ control, name: "weeks" as any }) as any;

  const selectedSiteId = form.watch("siteId");
  const selectedBoqId = form.watch("boqId");
  const selectedMonth = form.watch("month");
  const selectedWeek = isCreate ? "" : (form.watch("week") as string);

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);
  const weekOptions = useMemo(
    () => (isCreate ? [] : buildWeekOptions(selectedMonth)),
    [isCreate, selectedMonth]
  );
  const monthBounds = useMemo(
    () => (isCreate && selectedMonth ? monthBoundsIso(String(selectedMonth)) : null),
    [isCreate, selectedMonth]
  );

  const createWeekBounds = useMemo(() => {
    if (!isCreate || !monthBounds) return null;
    const weeks = Array.isArray(weeksWatch) ? weeksWatch : [];
    const res: Array<{ minFrom: string; minTo: string }> = [];
    for (let i = 0; i < 4; i++) {
      let minFrom = monthBounds.min;
      if (i > 0) {
        const prevTo = String(weeks?.[i - 1]?.toTargetDate || "");
        const next = prevTo ? addDaysIso(prevTo, 1) : null;
        if (next) minFrom = next;
      }
      const from = String(weeks?.[i]?.fromTargetDate || "");
      const minTo = from && from >= minFrom ? from : minFrom;
      res.push({ minFrom, minTo });
    }
    return res;
  }, [isCreate, monthBounds, weeksWatch]);

  // Fetch BOQs for dropdown based on selected site
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
    return (detailsWatch || []).map((d) => {
      const id = Number(d?.boqItemId);
      const item = itemsById.get(id);
      const boqQty = Number(item?.qty || 0);
      const unitName = item?.unit?.unitName || "—";
      const isGroup = Boolean(item?.isGroup);
      const dailyTargetQty = Number(d?.dailyTargetQty || 0);
      return { boqItemId: id, item, boqQty, unitName, isGroup, dailyTargetQty };
    });
  }, [detailsWatch, itemsById]);

  // When Site changes, clear BOQ + items
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

  // When Month changes, reset week and date range
  useEffect(() => {
    if (isCreate) return;
    if (!selectedMonth) {
      form.setValue("week", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("fromTargetDate", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("toTargetDate", "", { shouldDirty: true, shouldValidate: false });
      return;
    }
    if (selectedWeek && weekOptions.every((w) => w.value !== selectedWeek)) {
      form.setValue("week", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("fromTargetDate", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("toTargetDate", "", { shouldDirty: true, shouldValidate: false });
    }
  }, [selectedMonth, selectedWeek, weekOptions, form]);

  // When Month changes (create), reset all week date ranges
  useEffect(() => {
    if (!isCreate) return;
    if (!selectedMonth) {
      for (let i = 0; i < 4; i++) {
        form.setValue(`weeks.${i}.fromTargetDate` as any, "", {
          shouldDirty: true,
          shouldValidate: false,
        });
        form.setValue(`weeks.${i}.toTargetDate` as any, "", {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      form.setValue(`weeks.${i}.fromTargetDate` as any, "", {
        shouldDirty: true,
        shouldValidate: false,
      });
      form.setValue(`weeks.${i}.toTargetDate` as any, "", {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [isCreate, selectedMonth, form]);

  useEffect(() => {
    if (!isCreate) return;
    if (!createWeekBounds) return;
    const weeks = Array.isArray(weeksWatch) ? weeksWatch : [];
    for (let i = 1; i < 4; i++) {
      const minFrom = createWeekBounds[i]?.minFrom;
      const from = String(weeks?.[i]?.fromTargetDate || "");
      const to = String(weeks?.[i]?.toTargetDate || "");
      if (minFrom && from && from < minFrom) {
        form.setValue(`weeks.${i}.fromTargetDate` as any, "", { shouldDirty: true, shouldValidate: false });
        form.setValue(`weeks.${i}.toTargetDate` as any, "", { shouldDirty: true, shouldValidate: false });
        continue;
      }
      if (minFrom && to && to < minFrom) {
        form.setValue(`weeks.${i}.toTargetDate` as any, "", { shouldDirty: true, shouldValidate: false });
      }
    }
  }, [isCreate, createWeekBounds, weeksWatch, form]);

  // When Week changes, auto-set from/to date
  useEffect(() => {
    if (isCreate) return;
    if (!selectedMonth || !selectedWeek) return;
    const range = computeWeekDateRange(selectedMonth, selectedWeek);
    if (!range) return;
    form.setValue("fromTargetDate", range.from, { shouldDirty: true, shouldValidate: false });
    form.setValue("toTargetDate", range.to, { shouldDirty: true, shouldValidate: false });
  }, [selectedMonth, selectedWeek, form]);

  // Populate details table whenever BOQ items are available
  useEffect(() => {
    const current = (form.getValues("details") || []) as any[];
    if (!selectedBoqId) {
      if (current.length) replace([]);
      return;
    }

    if (!Array.isArray(boqItems) || boqItems.length === 0) return;

    const qtyByItemId = new Map<string, string>();
    current.forEach((d) => {
      if (!d?.boqItemId) return;
      qtyByItemId.set(String(d.boqItemId), String(d.dailyTargetQty ?? ""));
    });

    // Bring in persisted values from initial payload (edit) when current is empty
    if (!current.length && Array.isArray(initial?.boqTargetDetails)) {
      initial.boqTargetDetails.forEach((d) => {
        const k = String(d.BoqItemId);
        const v = d.dailyTargetQty == null ? "" : Number(d.dailyTargetQty as any).toFixed(2);
        qtyByItemId.set(k, v);
      });
    }

    const next = boqItems.map((it: any) => {
      const key = String(it.id);
      return {
        boqItemId: key,
        dailyTargetQty: qtyByItemId.get(key) ?? "",
      };
    });

    const isSame =
      current.length === next.length &&
      current.every(
        (d, i) =>
          String(d?.boqItemId ?? "") === String((next[i] as any)?.boqItemId ?? "") &&
          String(d?.dailyTargetQty ?? "") === String((next[i] as any)?.dailyTargetQty ?? "")
      );

    if (!isSame) replace(next as any);
  }, [selectedBoqId, boqItems, replace, form, initial?.boqTargetDetails]);

  async function onSubmit(data: CreateFormValues | EditFormValues) {
    setSubmitting(true);
    try {
      if (isCreate) {
        const d = data as CreateFormValues;
        const mi = monthIndexFromLabel(d.month);
        const yr = yearFromLabel(d.month);
        if (mi === null || yr === null) {
          throw new Error("Invalid month");
        }
        const monthDays = new Date(yr, mi + 1, 0).getDate();
        if (!monthDays) {
          throw new Error("Invalid month days");
        }

        const base = {
          siteId: d.siteId && d.siteId !== "" ? parseInt(d.siteId) : null,
          boqId: d.boqId && d.boqId !== "" ? parseInt(d.boqId) : null,
          month: d.month,
        };

        const details = (d.details || []).map((x) => ({
          boqItemId: parseInt(x.boqItemId),
          monthQty:
            x.dailyTargetQty === "" || x.dailyTargetQty === undefined ? null : Number(x.dailyTargetQty),
        }));

        const results: any[] = [];
        for (let i = 0; i < 4; i++) {
          const w = d.weeks[i];
          const from = new Date(w.fromTargetDate);
          const to = new Date(w.toTargetDate);
          const days = inclusiveDays(from, to);
          if (!days) {
            throw new Error(`${ordinal(i + 1)} Week date range is invalid`);
          }

          const payload = {
            ...base,
            week: `${ordinal(i + 1)} Week`,
            fromTargetDate: new Date(w.fromTargetDate).toISOString(),
            toTargetDate: new Date(w.toTargetDate).toISOString(),
            details: details.map((it) => ({
              boqItemId: it.boqItemId,
              dailyTargetQty:
                it.monthQty === null || it.monthQty === undefined
                  ? null
                  : Number((((it.monthQty / monthDays) * days) as number).toFixed(2)),
            })),
          };

          const res = await apiPost("/api/boq-targets", payload);
          results.push(res);
        }

        toast.success("BOQ Targets created");
        onSuccess?.(results);
      } else if (mode === "edit" && initial?.id) {
        const payload = toEditSubmitPayload(data as EditFormValues);
        const res = await apiPatch("/api/boq-targets", {
          id: initial.id,
          ...payload,
        });
        toast.success("BOQ Target updated");
        onSuccess?.(res);
      }
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
  const fromTargetDateVal = isCreate ? "" : (form.watch("fromTargetDate") as string);
  const toTargetDateVal = isCreate ? "" : (form.watch("toTargetDate") as string);

  function isValidQtyInput(v: string) {
    if (v === "") return true;
    return /^\d*(\.\d{0,2})?$/.test(v);
  }

  function setQtyAtIndex(idx: number, next: string) {
    if (!isValidQtyInput(next)) return;
    form.setValue(`details.${idx}.dailyTargetQty` as any, next, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }

  function formatQtyInput(v: string) {
    if (!v) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  return (
    <Form {...form}>
      <AppCard className="w-auto mx-auto">
        <AppCard.Header>
          <AppCard.Title>{isCreate ? "Create BOQ Target" : "Edit BOQ Target"}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add a new BOQ target." : "Update BOQ target."}
          </AppCard.Description>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Target Information">
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

              {isCreate ? (
                <div className="grid grid-cols-1 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="text-sm font-medium mb-3">{`${ordinal(i + 1)} Week`}</div>
                      <FormRow cols={2} from="md">
                        <TextInput
                          control={control}
                          name={`weeks.${i}.fromTargetDate` as any}
                          label="From Target Date"
                          type="date"
                          min={createWeekBounds?.[i]?.minFrom ?? monthBounds?.min}
                          max={monthBounds?.max}
                          disabled={!monthBounds}
                        />
                        <TextInput
                          control={control}
                          name={`weeks.${i}.toTargetDate` as any}
                          label="To Target Date"
                          type="date"
                          min={createWeekBounds?.[i]?.minTo ?? monthBounds?.min}
                          max={monthBounds?.max}
                          disabled={!monthBounds}
                        />
                      </FormRow>
                    </div>
                  ))}
                </div>
              ) : (
                <FormRow cols={3} from="md">
                  <ReadonlyField label="Week" value={selectedWeek} />
                  <ReadonlyField label="From Target Date" value={fromTargetDateVal} />
                  <ReadonlyField label="To Target Date" value={toTargetDateVal} />
                </FormRow>
              )}
            </FormSection>

            <FormSection legend="Target Items">
              {selectedBoqId && boqItems.length > 0 ? (
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Activity ID</th>
                        <th className="text-left font-medium px-3 py-2">Description of item</th>
                        <th className="text-left font-medium px-3 py-2">Unit</th>
                        <th className="text-right font-medium px-3 py-2">BOQ Qty</th>
                        <th className="text-right font-medium px-3 py-2">{isCreate ? "Target Qty" : "Daily Target Qty"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(computedRows || []).map((row, idx) => {
                        const desc = `${row?.item?.item || ""}`;
                        const qtyValue = ((detailsWatch?.[idx] as any)?.dailyTargetQty ?? "").toString();
                        return (
                          <tr key={row.boqItemId} className="border-t">
                            <td className="px-3 py-2 align-top whitespace-nowrap">
                              {row?.item?.activityId || "—"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className={row.isGroup ? "font-medium" : ""}>{desc || "—"}</div>
                              {row?.item?.clientSrNo ? (
                                <div className="text-xs text-muted-foreground">Client Sr No: {row.item.clientSrNo}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 align-top">{row.unitName}</td>
                            <td className="px-3 py-2 text-right tabular-nums align-top">
                              {Number(row?.boqQty || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums align-top">
                              <input
                                type="text"
                                className="h-9 w-32 border rounded-md px-2 text-right"
                                value={qtyValue}
                                onChange={(e) => setQtyAtIndex(idx, e.target.value)}
                                onBlur={(e) => setQtyAtIndex(idx, formatQtyInput(e.target.value))}
                                disabled={row.isGroup}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {selectedBoqId ? "No BOQ items found." : "Select a BOQ to view items."}
                </div>
              )}
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push(redirectOnSuccess)}
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
              {isCreate ? "Create Target" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default BoqTargetsForm;
