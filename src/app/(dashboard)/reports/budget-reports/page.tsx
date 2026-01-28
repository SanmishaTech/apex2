"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { ComboboxInput } from "@/components/common/combobox-input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type FormValues = {
  boqId: string;
};

type BoqListResponse = {
  data: Array<{ id: number; boqNo: string | null; workName?: string | null; site?: { site?: string | null } | null }>;
};

export default function BudgetReportsPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_SITE_BUDGETS)) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Budget reports.
      </div>
    );
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { boqId: "" },
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

  const selectedBoqId = watch("boqId");
  const selectedBoqLabel = useMemo(() => {
    const opt = boqOptions.find((o) => o.value === selectedBoqId);
    return opt?.label || "boq";
  }, [boqOptions, selectedBoqId]);

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
    const { boqId } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/site-budget-excel?boqId=${encodeURIComponent(boqId)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel
        .replace(/[^a-z0-9\- _]/gi, "")
        .replace(/\s+/g, "-");
      const filename = `budget-report-${safeBoq}-${today}.xlsx`;
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
          <AppCard.Title>Budget Reports</AppCard.Title>
          <AppCard.Description>Select BOQ and generate Excel report.</AppCard.Description>
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
            <div className="flex justify-end md:justify-start">
              <AppButton
                type="button"
                onClick={handleGenerate}
                disabled={downloading || boqsLoading || !selectedBoqId}
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
