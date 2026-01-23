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

const inputSchema = z
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

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
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

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
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
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const selectedSiteId = form.watch("siteId");
  const selectedBoqId = form.watch("boqId");
  const selectedMonth = form.watch("month");
  const selectedWeek = form.watch("week");

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);
  const weekOptions = useMemo(() => buildWeekOptions(selectedMonth), [selectedMonth]);

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

  // When Week changes, auto-set from/to date
  useEffect(() => {
    if (!selectedMonth || !selectedWeek) return;
    const range = computeWeekDateRange(selectedMonth, selectedWeek);
    if (!range) return;
    form.setValue("fromTargetDate", range.from, { shouldDirty: true, shouldValidate: false });
    form.setValue("toTargetDate", range.to, { shouldDirty: true, shouldValidate: false });
  }, [selectedMonth, selectedWeek, form]);

  // Populate details table whenever BOQ items are available
  useEffect(() => {
    const current = (form.getValues("details") || []) as RawFormValues["details"];
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

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost("/api/boq-targets", payload);
        toast.success("BOQ Target created");
        onSuccess?.(res);
      } else if (mode === "edit" && initial?.id) {
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
  const fromTargetDateVal = form.watch("fromTargetDate");
  const toTargetDateVal = form.watch("toTargetDate");

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
                  <div>
                  <TextInput
                    control={control}
                    name="fromTargetDate"
                    label="From Target Date"
                    type="date"
                    disabled
                  />
                  </div>
                ) : (
                  <ReadonlyField label="From Target Date" value={fromTargetDateVal} />
                )}

                {isCreate ? (
                  <div>
                  <TextInput
                    control={control}
                    name="toTargetDate"
                    label="To Target Date"
                    type="date"
                    disabled
                  />
                  </div>
                ) : (
                  <ReadonlyField label="To Target Date" value={toTargetDateVal} />
                )}
              </FormRow>
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
                        <th className="text-right font-medium px-3 py-2">Daily Target Qty</th>
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
