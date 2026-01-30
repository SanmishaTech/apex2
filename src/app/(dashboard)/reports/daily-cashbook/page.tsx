"use client";

import { useMemo } from "react";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppSelect } from "@/components/common/app-select";
import { TextInput } from "@/components/common/text-input";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

type FormValues = {
  fromDate: string;
  toDate: string;
  siteId: string;
  boqId: string;
  format: "pdf" | "excel";
};

export default function DailyCashbookReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_CASHBOOKS)) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Cashbook reports.
      </div>
    );
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { fromDate: "", toDate: "", siteId: "", boqId: "", format: "excel" },
  });
  const { control, getValues, watch } = form;

  const { data: sitesData } = useSWR<{ data: { id: number; site: string }[] }>(
    "/api/sites?perPage=1000",
    apiGet
  );

  const siteOptions = useMemo(
    () => (sitesData?.data || []).map((s) => ({ value: s.id, label: s.site })),
    [sitesData]
  );

  const selectedSiteId = watch("siteId");
  const resolvedSiteId =
    selectedSiteId && !Number.isNaN(Number(selectedSiteId))
      ? Number(selectedSiteId)
      : undefined;
  const { data: boqsData } = useSWR<{
    data: { id: number; boqNo: string; workName: string }[];
  }>(resolvedSiteId ? `/api/boqs?perPage=1000&siteId=${resolvedSiteId}` : null, apiGet);

  const boqOptions = useMemo(
    () =>
      (boqsData?.data || []).map((b) => ({
        value: String(b.id),
        label: `${b.boqNo ?? ""}`,
      })),
    [boqsData]
  );

  function handleGenerate() {
    const { fromDate, toDate, siteId, boqId, format } = getValues();
    if (!fromDate || !toDate || !siteId || !boqId) {
      alert("All fields are mandatory");
      return;
    }
    const base =
      format === "excel"
        ? "/api/reports/daily-cashbook-excel"
        : "/api/reports/daily-cashbook-pdf";
    const url = `${base}?fromDate=${encodeURIComponent(
      fromDate
    )}&toDate=${encodeURIComponent(toDate)}&siteId=${siteId}&boqId=${boqId}`;
    window.open(url, "_blank");
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Daily Cashbook Report</AppCard.Title>
          <AppCard.Description>
            Select date range, site and BOQ. Generate PDF or Excel.
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextInput
              control={control}
              name="fromDate"
              label="From Date"
              type="date"
              required
            />
            <TextInput
              control={control}
              name="toDate"
              label="To Date"
              type="date"
              required
            />
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
        </AppCard.Content>
        <AppCard.Footer className="justify-end">
          <AppButton type="button" onClick={handleGenerate}>
            Generate
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    </Form>
  );
}
