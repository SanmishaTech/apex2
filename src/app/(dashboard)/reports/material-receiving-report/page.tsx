"use client";

import { useMemo, useState } from "react";
import { Fragment } from "react";
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
  data: Array<{
    id: number;
    boqNo: string | null;
    workName?: string | null;
    site?: { site?: string | null } | null;
  }>;
};

type ReportLot = {
  id: number;
  label: string;
  date: string;
  source?: string;
  destination?: string;
};

type ReportRow = {
  itemId: number;
  materialName: string;
  unitName: string;
  closingQty: number;
  overallQty: number;
  overallQtyExists: boolean;
  receivedLotQty: number[];
  receivedTotal: number;
  transferredLotQty: number[];
  transferredTotal: number;
  totalReceived: number;
  balToBeSent: number;
};

type MaterialReceivingReportResponse = {
  meta: {
    boqId: number;
    boqNo: string;
    siteName: string;
    generatedAt: string;
    receivedLots: ReportLot[];
    transferredLots: ReportLot[];
  };
  rows: ReportRow[];
};

export default function MaterialReceivingReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_SITE_BUDGETS)) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Material Receiving Report.
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
  const [appliedFilters, setAppliedFilters] = useState<{ boqId: string } | null>(
    null
  );
  const [searchNonce, setSearchNonce] = useState(0);

  const reportUrl = useMemo(() => {
    if (!appliedFilters?.boqId) return null;
    return `/api/reports/material-receiving-report?boqId=${encodeURIComponent(
      appliedFilters.boqId
    )}&_ts=${searchNonce}`;
  }, [appliedFilters, searchNonce]);

  const {
    data: report,
    isLoading: reportLoading,
    mutate: mutateReport,
  } = useSWR<MaterialReceivingReportResponse>(reportUrl, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 0,
  });

  async function handleSearch() {
    const { boqId } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }

    setAppliedFilters({ boqId });
    setSearchNonce(Date.now());
    await mutateReport();
  }

  function handleReset() {
    form.reset({ boqId: "" });
    setAppliedFilters(null);
    setSearchNonce(0);
  }

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

  async function handleGenerateExcel() {
    const { boqId } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/material-receiving-report-excel?boqId=${encodeURIComponent(
        boqId
      )}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel
        .replace(/[^a-z0-9\- _]/gi, "")
        .replace(/\s+/g, "-");
      const filename = `material-receiving-report-${safeBoq}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  const receivedLots = report?.meta?.receivedLots || [];
  const transferredLots = report?.meta?.transferredLots || [];
  const rows = report?.rows || [];

  const showReport = Boolean(appliedFilters?.boqId);

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Material Receiving Report</AppCard.Title>
          <AppCard.Description>
            Select BOQ, search to view report, or generate Excel.
          </AppCard.Description>
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
            <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
              <AppButton
                type="button"
                onClick={handleSearch}
                disabled={boqsLoading || !selectedBoqId}
              >
                Search
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                onClick={handleReset}
                disabled={boqsLoading || (!selectedBoqId && !appliedFilters)}
              >
                Reset
              </AppButton>
              <AppButton
                type="button"
                onClick={handleGenerateExcel}
                disabled={downloading || boqsLoading || !selectedBoqId}
                isLoading={downloading}
              >
                Generate Excel
              </AppButton>
            </div>
          </div>
        </AppCard.Content>
      </AppCard>

      {showReport ? (
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Report</AppCard.Title>
            <AppCard.Description>
              {report?.meta?.boqNo ? `BOQ: ${report.meta.boqNo}` : ""}
              {report?.meta?.siteName ? ` | Site: ${report.meta.siteName}` : ""}
            </AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-300 text-xs">
                <thead>
                  <tr className="bg-sky-700 text-white">
                    <th rowSpan={2} className="text-left p-3 font-medium">
                      Sr No
                    </th>
                    <th rowSpan={2} className="text-left p-3 font-medium">
                      Material Name
                    </th>
                    <th rowSpan={2} className="text-left p-3 font-medium">
                      Unit
                    </th>
                    <th rowSpan={2} className="text-right p-3 font-medium">
                      Closing Qty
                    </th>
                    <th rowSpan={2} className="text-right p-3 font-medium">
                      Overall Qty
                    </th>

                    <th
                      colSpan={receivedLots.length * 3 + 1}
                      className="text-center p-3 font-medium"
                    >
                      Received lots
                    </th>
                    <th
                      colSpan={transferredLots.length * 3 + 1}
                      className="text-center p-3 font-medium"
                    >
                      Transferred Lots
                    </th>

                    <th rowSpan={2} className="text-right p-3 font-medium">
                      Total Received
                    </th>
                    <th rowSpan={2} className="text-right p-3 font-medium">
                      Bal to be sent
                    </th>
                  </tr>
                  <tr className="bg-sky-700 text-white">
                    {receivedLots.map((l) => (
                      <th
                        key={`rh-${l.id}`}
                        colSpan={3}
                        className="text-center p-3 font-medium"
                      >
                        {l.label}
                      </th>
                    ))}
                    <th className="text-right p-3 font-medium">Total</th>

                    {transferredLots.map((l) => (
                      <th
                        key={`th-${l.id}`}
                        colSpan={3}
                        className="text-center p-3 font-medium"
                      >
                        {l.label}
                      </th>
                    ))}
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                  <tr className="bg-sky-50 text-sky-900">
                    <th className="text-left p-3 font-medium" colSpan={5}></th>

                    {receivedLots.map((l) => (
                      <Fragment key={`rsub-${l.id}`}>
                        <th
                          key={`rdate-${l.id}`}
                          className="text-left p-3 font-medium whitespace-nowrap"
                        >
                          Date
                        </th>
                        <th
                          key={`rqty-${l.id}`}
                          className="text-right p-3 font-medium whitespace-nowrap"
                        >
                          Qty
                        </th>
                        <th
                          key={`rsrc-${l.id}`}
                          className="text-left p-3 font-medium whitespace-nowrap"
                        >
                          Source
                        </th>
                      </Fragment>
                    ))}
                    <th className="text-right p-3 font-medium whitespace-nowrap"></th>

                    {transferredLots.map((l) => (
                      <Fragment key={`tsub-${l.id}`}>
                        <th
                          key={`tdate-${l.id}`}
                          className="text-left p-3 font-medium whitespace-nowrap"
                        >
                          Date
                        </th>
                        <th
                          key={`tqty-${l.id}`}
                          className="text-right p-3 font-medium whitespace-nowrap"
                        >
                          Qty
                        </th>
                        <th
                          key={`tdst-${l.id}`}
                          className="text-left p-3 font-medium whitespace-nowrap"
                        >
                          Destination
                        </th>
                      </Fragment>
                    ))}
                    <th className="text-right p-3 font-medium whitespace-nowrap"></th>
                    <th className="text-right p-3 font-medium"></th>
                    <th className="text-right p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoading ? (
                    <tr>
                      <td
                        className="p-4 text-muted-foreground"
                        colSpan={
                          4 +
                          (receivedLots.length * 3 + 1) +
                          (transferredLots.length * 3 + 1) +
                          2
                        }
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        className="p-4 text-muted-foreground"
                        colSpan={
                          4 +
                          (receivedLots.length * 3 + 1) +
                          (transferredLots.length * 3 + 1) +
                          2
                        }
                      >
                        No data.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr
                        key={r.itemId}
                        className={
                          "border-t hover:bg-muted/30 " +
                          (idx % 2 === 0 ? "bg-white" : "bg-slate-50")
                        }
                      >
                        <td className="p-3 whitespace-nowrap">{idx + 1}</td>
                        <td className="p-3 min-w-60 font-medium">
                          {r.materialName}
                        </td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {r.unitName}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {Number(r.closingQty || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {r.overallQtyExists ? (
                            Number(r.overallQty || 0).toFixed(2)
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              Does Not Exist
                            </span>
                          )}
                        </td>

                        {receivedLots.map((l, li) => (
                          <Fragment key={`r-${r.itemId}-${l.id}`}>
                            <td
                              key={`rdate-${r.itemId}-${l.id}`}
                              className="p-3 whitespace-nowrap text-muted-foreground"
                            >
                              {l.date}
                            </td>
                            <td
                              key={`rqty-${r.itemId}-${l.id}`}
                              className="p-3 text-right whitespace-nowrap"
                            >
                              {r.receivedLotQty?.[li]
                                ? Number(r.receivedLotQty[li]).toFixed(2)
                                : ""}
                            </td>
                            <td
                              key={`rsrc-${r.itemId}-${l.id}`}
                              className="p-3 whitespace-nowrap text-muted-foreground"
                            >
                              {l.source || ""}
                            </td>
                          </Fragment>
                        ))}
                        <td className="p-3 text-right whitespace-nowrap font-semibold">
                          {r.receivedTotal ? r.receivedTotal.toFixed(2) : ""}
                        </td>

                        {transferredLots.map((l, li) => (
                          <Fragment key={`t-${r.itemId}-${l.id}`}>
                            <td
                              key={`tdate-${r.itemId}-${l.id}`}
                              className="p-3 whitespace-nowrap text-muted-foreground"
                            >
                              {l.date}
                            </td>
                            <td
                              key={`tqty-${r.itemId}-${l.id}`}
                              className="p-3 text-right whitespace-nowrap"
                            >
                              {r.transferredLotQty?.[li]
                                ? Number(r.transferredLotQty[li]).toFixed(2)
                                : ""}
                            </td>
                            <td
                              key={`tdst-${r.itemId}-${l.id}`}
                              className="p-3 whitespace-nowrap text-muted-foreground"
                            >
                              {l.destination || ""}
                            </td>
                          </Fragment>
                        ))}
                        <td className="p-3 text-right whitespace-nowrap font-semibold">
                          {r.transferredTotal ? r.transferredTotal.toFixed(2) : ""}
                        </td>

                        <td className="p-3 text-right whitespace-nowrap font-semibold">
                          {r.totalReceived ? r.totalReceived.toFixed(2) : ""}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap font-semibold">
                          {r.balToBeSent ? r.balToBeSent.toFixed(2) : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AppCard.Content>
        </AppCard>
      ) : null}
    </Form>
  );
}
