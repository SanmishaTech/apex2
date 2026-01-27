"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppSelect } from "@/components/common/app-select";
import { ComboboxInput } from "@/components/common/combobox-input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type FormValues = {
  boqId: string;
  month: string;
};

type BoqListResponse = {
  data: Array<{
    id: number;
    boqNo: string | null;
    site?: { id: number; site: string } | null;
  }>;
};

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

export default function BoqTargetReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_BOQS)) {
    return <div className="text-muted-foreground">You do not have access to BOQ Target report.</div>;
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { boqId: "", month: "" },
  });
  const { control, getValues, watch } = form;

  const { data: boqsData, isLoading: boqsLoading } = useSWR<BoqListResponse>(
    "/api/boqs?perPage=1000&sort=boqNo&order=desc",
    apiGet
  );

  const boqOptions = useMemo(() => {
    return (boqsData?.data || []).map((b) => {
      const boqNo = b.boqNo || "—";
      const siteName = b.site?.site ? ` - ${b.site.site}` : "";
      return { value: String(b.id), label: `${boqNo}${siteName}` };
    });
  }, [boqsData]);

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);

  const selectedBoqId = watch("boqId");
  const selectedBoqLabel = useMemo(() => {
    const opt = boqOptions.find((o) => o.value === selectedBoqId);
    return opt?.label || "boq";
  }, [boqOptions, selectedBoqId]);

  const selectedMonth = watch("month");

  const [downloading, setDownloading] = useState(false);

  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleGenerate() {
    const { boqId, month } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/boq-target-report-excel?boqId=${encodeURIComponent(boqId)}&month=${encodeURIComponent(month)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel.replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-");
      const safeMonth = String(month).replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-");
      const filename = `boq-target-report-${safeBoq}-${safeMonth}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>BOQ Target Report</AppCard.Title>
          <AppCard.Description>Select BOQ and Month and generate Excel report.</AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <ComboboxInput
                control={control}
                name="boqId"
                label="BOQ"
                required
                options={boqOptions}
                placeholder={boqsLoading ? "Loading..." : "Select BOQ"}
              />
            </div>

            <div>
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
            </div>

            <div className="md:col-span-3 flex justify-end">
              <AppButton
                type="button"
                onClick={handleGenerate}
                disabled={downloading || boqsLoading || !selectedBoqId || !selectedMonth}
                isLoading={downloading}
              >
                Generate Excel
              </AppButton>
            </div>
          </div>
        </AppCard.Content>
      </AppCard>
    </Form>
  );
}
