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
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import type { SitesResponse } from "@/types/sites";
import { ComboboxInput } from "@/components/common/combobox-input";

export interface ManpowerFoodChargesFormInitialData {
  id?: number;
  siteId?: number | null;
  monthYear?: string | null;
  manpowerFoodChargesDetails?: Array<{
    id?: number;
    manpowerFoodChargesId?: number;
    manpowerId: number;
    manpower?: { id: number; firstName: string; lastName: string };
    foodCharges1?: string | number | null;
    foodCharges2?: string | number | null;
  }>;
}

export interface ManpowerFoodChargesFormProps {
  mode: "create" | "edit";
  initial?: ManpowerFoodChargesFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const formSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  monthYear: z.string().min(1, "Month is required"),
  details: z
    .array(
      z.object({
        manpowerId: z.string().min(1),
        manpowerName: z.string().optional(),
        foodCharges1: z.string().optional().default(""),
        foodCharges2: z.string().optional().default(""),
      })
    )
    .default([]),
});

type FormValues = z.infer<typeof formSchema>;

function buildMonthYearOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
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
  const currentMonthStr = `${names[now.getMonth()]} ${now.getFullYear()}`;
  const opts: Array<{ value: string; label: string }> = [];
  opts.push({ value: currentMonthStr, label: currentMonthStr });
  for (const y of years) {
    for (const m of names) {
      const label = `${m} ${y}`;
      if (label !== currentMonthStr) {
        opts.push({ value: label, label });
      }
    }
  }
  return opts;
}



export function ManpowerFoodChargesForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/manpower-food-charges",
}: ManpowerFoodChargesFormProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";

  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : "",
      monthYear: initial?.monthYear ? String(initial.monthYear) : "",
      details: (initial?.manpowerFoodChargesDetails || []).map((d) => ({
        manpowerId: String(d.manpowerId),
        manpowerName: d.manpower ? `${d.manpower.firstName} ${d.manpower.lastName}` : "",
        foodCharges1: d.foodCharges1 == null ? "" : Number(d.foodCharges1).toFixed(2),
        foodCharges2: d.foodCharges2 == null ? "" : Number(d.foodCharges2).toFixed(2),
      })),
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const selectedSiteId = form.watch("siteId");
  const monthOptions = useMemo(() => buildMonthYearOptions(), []);

  // Fetch assigned manpower
  const { data: manpowerAssigned } = useSWR<any>(
    selectedSiteId ? `/api/manpower-assignments?mode=assigned&siteId=${selectedSiteId}&perPage=10000` : null,
    apiGet
  );

  useEffect(() => {

    if (manpowerAssigned?.data) {
      const existingDetails = form.getValues("details") || [];
      const qtyMap = new Map();
      const qtyMap2 = new Map();
      
      existingDetails.forEach((d) => {
        qtyMap.set(String(d.manpowerId), d.foodCharges1);
        qtyMap2.set(String(d.manpowerId), d.foodCharges2);
      });

      const nextMap = new Map();

      manpowerAssigned.data.forEach((m: any) => {
        const id = String(m.id);
        nextMap.set(id, {
          manpowerId: id,
          manpowerName: `${m.firstName} ${m.lastName || ""}`.trim(),
          foodCharges1: qtyMap.get(id) ?? "",
          foodCharges2: qtyMap2.get(id) ?? "",
        });
      });

      if (!isCreate) {
        existingDetails.forEach((d) => {
          const id = String(d.manpowerId);
          if (!nextMap.has(id)) {
            nextMap.set(id, {
              manpowerId: id,
              manpowerName: d.manpowerName || "Unknown Manpower",
              foodCharges1: d.foodCharges1 ?? "",
              foodCharges2: d.foodCharges2 ?? "",
            });
          }
        });
      }

      const nextArr = Array.from(nextMap.values()).sort((a, b) => a.manpowerName.localeCompare(b.manpowerName));
      replace(nextArr);
    }
  }, [manpowerAssigned?.data, replace, form, isCreate, selectedSiteId]);

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        siteId: parseInt(data.siteId),
        monthYear: data.monthYear,
        details: data.details.map((d) => ({
          manpowerId: parseInt(d.manpowerId),
          foodCharges1: d.foodCharges1 === "" ? null : Number(d.foodCharges1),
          foodCharges2: d.foodCharges2 === "" ? null : Number(d.foodCharges2),
        })).filter(d => d.foodCharges1 !== null || d.foodCharges2 !== null || !isCreate),
      };

      if (isCreate) {
        const res = await apiPost("/api/manpower-food-charges", payload);
        toast.success("Manpower Food Charges created");
        mutate((key: any) => typeof key === 'string' && key.startsWith('/api/manpower-food-charges'));
        onSuccess?.(res);
      } else {
        const res = await apiPatch("/api/manpower-food-charges", { id: initial!.id, ...payload });
        toast.success("Manpower Food Charges updated");
        mutate((key: any) => typeof key === 'string' && key.startsWith('/api/manpower-food-charges'));
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

  const siteLabel = siteOptions.find((o) => o.value === selectedSiteId)?.label || "";

  function isValidQtyInput(v: string) {
    if (v === "") return true;
    return /^\d*(\.\d{0,2})?$/.test(v);
  }

  const detailsWatch = useWatch({ control, name: "details" });

  return (
    <Form {...form}>
      <AppCard className="w-auto mx-auto">
        <AppCard.Header>
          <AppCard.Title>{isCreate ? "Create Manpower Food Charges" : "Edit Manpower Food Charges"}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? "Add new food charges." : "Update food charges."}
          </AppCard.Description>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Information">
              <FormRow cols={2} from="md">
                <ComboboxInput
                  control={control}
                  name="siteId"
                  label="Site"
                  required
                  options={siteOptions}
                  placeholder="Select Site"
                  disabled={!isCreate}
                />

                <AppSelect
                  control={control}
                  name="monthYear"
                  label="Month"
                  required
                  placeholder="Select Month"
                  disabled={!isCreate}
                >
                    {monthOptions.map((opt) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
              </FormRow>
            </FormSection>

            {detailsWatch && detailsWatch.length > 0 && (
              <FormSection legend="Manpower Details">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="p-2 text-center font-semibold w-12 border-r border-border">#</th>
                        <th className="p-2 text-left font-semibold">Manpower</th>
                        <th className="p-2 text-right font-semibold w-32">Food Charges 1</th>
                        <th className="p-2 text-right font-semibold w-32">Food Charges 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsWatch.map((d, i) => (
                        <tr key={d?.manpowerId || i} className="border-b border-border hover:bg-muted/30">
                          <td className="p-2 border-r border-border font-medium text-center text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="p-2 border-r border-border font-medium">
                            {d?.manpowerName || "Unknown Manpower"}
                          </td>
                          <td className="p-2 border-r border-border">
                            <input
                              type="text"
                              className="w-full text-right bg-transparent focus:outline-none"
                              placeholder="0.00"
                              value={d?.foodCharges1 || ""}
                              onChange={(e) => {
                                if (isValidQtyInput(e.target.value)) {
                                  form.setValue(`details.${i}.foodCharges1`, e.target.value, { shouldDirty: true });
                                }
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full text-right bg-transparent focus:outline-none"
                              placeholder="0.00"
                              value={d?.foodCharges2 || ""}
                              onChange={(e) => {
                                if (isValidQtyInput(e.target.value)) {
                                  form.setValue(`details.${i}.foodCharges2`, e.target.value, { shouldDirty: true });
                                }
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FormSection>
            )}
            
            {detailsWatch.length === 0 && selectedSiteId && (
              <div className="text-center text-muted-foreground p-4">
                No manpower found for this site.
              </div>
            )}
          </AppCard.Content>
          <AppCard.Footer className="justify-end gap-3 border-t">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => router.push(redirectOnSuccess)}
              disabled={submitting}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={submitting}>
              {submitting ? "Saving..." : isCreate ? "Create" : "Update"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
