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
import { FilterBar } from "@/components/common";
import { Pagination } from "@/components/common/pagination";

export interface ManpowerFoodChargesFormInitialData {
  id?: number;
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
  monthYear: z.string().min(1, "Month is required"),
  details: z
    .array(
      z.object({
        manpowerId: z.string().min(1),
        manpowerName: z.string().optional(),
        aadharNo: z.string().optional(),
        currentSiteName: z.string().optional(),
        currentSiteId: z.number().nullable().optional(),
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
  const currentMonthValue = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  const opts: Array<{ value: string; label: string }> = [];
  opts.push({ value: currentMonthValue, label: currentMonthStr });
  for (const y of years) {
    for (let mIndex = 0; mIndex < names.length; mIndex++) {
      const label = `${names[mIndex]} ${y}`;
      if (label !== currentMonthStr) {
        const value = `${String(mIndex + 1).padStart(2, "0")}-${y}`;
        opts.push({ value, label });
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

  const { data: manpowerData, isLoading: isLoadingManpower } = useSWR<any>(
    `/api/manpower?perPage=10000`,
    apiGet
  );

  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const siteOptions = (sitesData?.data || []).map((s) => ({
    value: String(s.id),
    label: s.site,
  }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      monthYear: initial?.monthYear ? String(initial.monthYear) : "",
      details: (initial?.manpowerFoodChargesDetails || []).map((d) => ({
        manpowerId: String(d.manpowerId),
        manpowerName: d.manpower ? `${d.manpower.firstName} ${d.manpower.lastName}` : "",
        aadharNo: "-",
        currentSiteName: "-",
        currentSiteId: null,
        foodCharges1: d.foodCharges1 == null ? "" : Number(d.foodCharges1).toFixed(2),
        foodCharges2: d.foodCharges2 == null ? "" : Number(d.foodCharges2).toFixed(2),
      })),
    },
  });

  const { control, handleSubmit } = form;
  const { replace } = useFieldArray({ control, name: "details" });

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilterSiteId, setSelectedFilterSiteId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {

    if (manpowerData?.data) {
      const existingDetails = form.getValues("details") || [];
      const qtyMap = new Map();
      const qtyMap2 = new Map();
      
      existingDetails.forEach((d) => {
        qtyMap.set(String(d.manpowerId), d.foodCharges1);
        qtyMap2.set(String(d.manpowerId), d.foodCharges2);
      });

      const nextMap = new Map();

      manpowerData.data.forEach((m: any) => {
        const id = String(m.id);
        nextMap.set(id, {
          manpowerId: id,
          manpowerName: `${m.firstName} ${m.lastName || ""}`.trim(),
          aadharNo: m.aadharNo || "-",
          currentSiteName: m.currentSiteName || "-",
          currentSiteId: m.currentSiteId || null,
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
              aadharNo: d.aadharNo || "-",
              currentSiteName: d.currentSiteName || "-",
              currentSiteId: d.currentSiteId || null,
              foodCharges1: d.foodCharges1 ?? "",
              foodCharges2: d.foodCharges2 ?? "",
            });
          }
        });
      }

      const nextArr = Array.from(nextMap.values()).sort((a, b) => a.manpowerName.localeCompare(b.manpowerName));
      replace(nextArr);
    }
  }, [manpowerData?.data, replace, form, isCreate]);

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
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

  const detailsWatch = useWatch({ control, name: "details" });

  function isValidQtyInput(v: string) {
    if (v === "") return true;
    return /^\d*(\.\d{0,2})?$/.test(v);
  }

  const filteredDetails = useMemo(() => {
    return (detailsWatch || [])
      .map((d, index) => ({ ...d, originalIndex: index }))
      .filter((d) => {
        const matchSearch = (d.manpowerName || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchSite = selectedFilterSiteId ? d.currentSiteId === Number(selectedFilterSiteId) : true;
        return matchSearch && matchSite;
      });
  }, [detailsWatch, searchTerm, selectedFilterSiteId]);

  const totalPages = Math.max(1, Math.ceil(filteredDetails.length / itemsPerPage));
  const paginatedDetails = filteredDetails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
              <FormRow cols={1} from="md">
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

            {isLoadingManpower ? (
              <div className="p-4 text-center text-muted-foreground">Loading manpower...</div>
            ) : detailsWatch && detailsWatch.length > 0 ? (
              <FormSection legend="Manpower Details">
                <FilterBar title="Filter Manpower">
                  <AppSelect
                    label="Site"
                    value={selectedFilterSiteId}
                    onValueChange={(v) => {
                      setSelectedFilterSiteId(v === "__ALL__" ? "" : v);
                      setCurrentPage(1);
                    }}
                    placeholder="All Sites"
                    triggerClassName="h-9 min-w-[180px]"
                  >
                    <AppSelect.Item value="__ALL__">All Sites</AppSelect.Item>
                    {siteOptions.map((opt) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  <div className="w-full sm:w-[250px] flex items-end">
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Search manpower name..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </FilterBar>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="p-2 text-center font-semibold w-12 border-r border-border">#</th>
                        <th className="p-2 text-left font-semibold border-r border-border">Manpower</th>
                        <th className="p-2 text-left font-semibold border-r border-border">Aadhar No</th>
                        <th className="p-2 text-left font-semibold border-r border-border">Site</th>
                        <th className="p-2 text-right font-semibold w-32 border-r border-border">Food Charges 1</th>
                        <th className="p-2 text-right font-semibold w-32">Food Charges 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDetails.map((d, index) => {
                        const i = d.originalIndex;
                        return (
                        <tr key={d?.manpowerId || i} className="border-b border-border hover:bg-muted/30">
                          <td className="p-2 border-r border-border font-medium text-center text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="p-2 border-r border-border font-medium">
                            {d?.manpowerName || "Unknown Manpower"}
                          </td>
                          <td className="p-2 border-r border-border">
                            {d?.aadharNo || "-"}
                          </td>
                          <td className="p-2 border-r border-border text-muted-foreground">
                            {d?.currentSiteName || "-"}
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
                      )})}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    total={filteredDetails.length}
                    perPage={itemsPerPage}
                    onPerPageChange={(val) => {
                      setItemsPerPage(val);
                      setCurrentPage(1);
                    }}
                    onPageChange={(p) => setCurrentPage(p)}
                    showPageNumbers
                    maxButtons={5}
                  />
                </div>
              </FormSection>
            ) : (
              <div className="text-center text-muted-foreground p-4">
                No manpower found.
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
