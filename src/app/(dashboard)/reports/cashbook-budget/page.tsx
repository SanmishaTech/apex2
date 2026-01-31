"use client";

import { useMemo } from "react";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppSelect } from "@/components/common/app-select";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

type FormValues = {
  month: string;
  siteId: string;
  boqId: string;
  format: "pdf" | "excel";
};

export default function CashbookBudgetReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.VIEW_CASHBOOK_BUDGET_REPORT)) {
    return <div className="text-muted-foreground">You do not have access to Cashbook Budget reports.</div>;
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { month: "", siteId: "", boqId: "", format: "excel" },
  });
  const { control, getValues, watch } = form;

  const { data: sitesData } = useSWR<{ data: { id: number; site: string }[] }>(
    can(PERMISSIONS.VIEW_CASHBOOK_BUDGET_REPORT) ? "/api/sites?perPage=1000" : null,
    apiGet
  );

  const siteOptions = useMemo(
    () => (sitesData?.data || []).map((s) => ({ value: s.id, label: s.site })),
    [sitesData]
  );

  const selectedSiteId = watch("siteId");
  const resolvedSiteId = selectedSiteId && !Number.isNaN(Number(selectedSiteId)) ? Number(selectedSiteId) : undefined;
  const { data: boqsData } = useSWR<{ data: { id: number; boqNo: string; workName: string }[] }>(
    resolvedSiteId ? `/api/boqs?perPage=1000&siteId=${resolvedSiteId}` : null,
    apiGet
  );

  const boqOptions = useMemo(
    () => (boqsData?.data || []).map((b) => ({ value: String(b.id), label: `${b.boqNo}${b.workName ? ' - ' + b.workName : ''}` })),
    [boqsData]
  );

  const monthOptions = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 11, 1);
    const opts: Array<{ value: string; label: string }> = [];
    const d = new Date(start);
    while (d <= end) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      const value = `${mm}-${yyyy}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      opts.push({ value, label });
      d.setMonth(d.getMonth() + 1);
    }
    return opts;
  }, []);

  function handleGenerate() {
    if (!can(PERMISSIONS.GENERATE_CASHBOOK_BUDGET_REPORT)) {
      alert("You do not have permission to generate this report");
      return;
    }
    const { month, siteId, boqId, format } = getValues();
    if (!month || !/^\d{2}-\d{4}$/.test(month)) {
      alert("Please enter month in MM-YYYY format");
      return;
    }
    if (!siteId || !boqId) {
      alert("Please select site and BOQ");
      return;
    }
    const base =
      format === "excel"
        ? "/api/reports/cashbook-budget-excel"
        : "/api/reports/cashbook-budget-pdf";
    const url = `${base}?month=${encodeURIComponent(month)}&siteId=${siteId}&boqId=${boqId}`;
    window.open(url, "_blank");
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Cashbook Budget Report</AppCard.Title>
          <AppCard.Description>Select month, site and BOQ. Generate PDF or Excel.</AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <AppSelect
                control={control}
                name="month"
                label="Month"
                placeholder="Select month"
                required
              >
                {monthOptions.map(({ value, label }) => (
                  <AppSelect.Item key={value} value={value}>
                    {label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div>
              <AppSelect
                control={control}
                name="siteId"
                label="Site"
                placeholder="Select site"
                required
              >
                {siteOptions.map((s) => (
                  <AppSelect.Item key={s.value} value={String(s.value)}>
                    {s.label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div>
              <AppSelect
                control={control}
                name="boqId"
                label="BOQ"
                placeholder="Select BOQ"
                disabled={!resolvedSiteId}
                required
              >
                {boqOptions.map((b) => (
                  <AppSelect.Item key={b.value} value={b.value}>
                    {b.label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div>
              <AppSelect
                control={control}
                name="format"
                label="Format"
                placeholder="Select format"
                required
              >
                <AppSelect.Item value="pdf">PDF</AppSelect.Item>
                <AppSelect.Item value="excel">Excel</AppSelect.Item>
              </AppSelect>
            </div>
          </div>
        </AppCard.Content>
        <AppCard.Footer className="justify-end">
          <AppButton
            type="button"
            onClick={handleGenerate}
            disabled={!can(PERMISSIONS.GENERATE_CASHBOOK_BUDGET_REPORT)}
          >
            Generate
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    </Form>
  );
}
