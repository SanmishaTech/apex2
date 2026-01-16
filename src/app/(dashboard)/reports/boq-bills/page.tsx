"use client";

import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppSelect } from "@/components/common/app-select";
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
    site?: { id: number; site: string } | null;
  }>;
};

type MatrixResponse = {
  meta: {
    boqId: number;
    boqNo: string | null;
    workName: string | null;
    site?: { id: number; site: string } | null;
  };
  bills: Array<{ id: number; label: string }>;
  rows: Array<{
    boqItemId: number;
    description: string;
    unit: string;
    boqQty: number;
    rate: number;
    boqAmount: number;
    totalUpto: { qty: number; amount: number };
    bills: Record<string, { qty: number; amount: number }>;
    isGroup: boolean;
  }>;
};

export default function BoqBillsReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_BOQ_BILLS)) {
    return <div className="text-muted-foreground">You do not have access to BOQ Bills reports.</div>;
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { boqId: "" },
  });
  const { control, getValues, watch } = form;

  const { data: boqsData, isLoading } = useSWR<BoqListResponse>(
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

  const resolvedBoqId = selectedBoqId && !Number.isNaN(Number(selectedBoqId)) ? Number(selectedBoqId) : undefined;
  const { data: matrixData, isLoading: matrixLoading } = useSWR<MatrixResponse>(
    resolvedBoqId ? `/api/reports/boq-bills?boqId=${resolvedBoqId}` : null,
    apiGet
  );

  const totals = useMemo(() => {
    if (!matrixData) return null;
    let boqQty = 0;
    let boqAmount = 0;
    let totalUptoQty = 0;
    let totalUptoAmount = 0;

    const billQtyById = new Map<number, number>();
    const billAmountById = new Map<number, number>();
    for (const b of matrixData.bills) {
      billQtyById.set(b.id, 0);
      billAmountById.set(b.id, 0);
    }

    for (const r of matrixData.rows || []) {
      boqQty += Number(r.boqQty || 0);
      boqAmount += Number(r.boqAmount || 0);
      totalUptoQty += Number(r.totalUpto?.qty || 0);
      totalUptoAmount += Number(r.totalUpto?.amount || 0);
      for (const b of matrixData.bills) {
        const v = r.bills?.[String(b.id)] || { qty: 0, amount: 0 };
        billQtyById.set(b.id, Number(billQtyById.get(b.id) || 0) + Number(v.qty || 0));
        billAmountById.set(b.id, Number(billAmountById.get(b.id) || 0) + Number(v.amount || 0));
      }
    }

    return {
      boqQty,
      boqAmount,
      totalUptoQty,
      totalUptoAmount,
      billQtyById,
      billAmountById,
    };
  }, [matrixData]);

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
      const url = `/api/reports/boq-bills-excel?boqId=${encodeURIComponent(boqId)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel.replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-");
      const filename = `boq-bills-report-${safeBoq}-${today}.xlsx`;
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
          <AppCard.Title>BOQ Bills Report</AppCard.Title>
          <AppCard.Description>Select BOQ and generate Excel report.</AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <AppSelect
                control={control}
                name="boqId"
                label="BOQ"
                placeholder={isLoading ? "Loading..." : "Select BOQ"}
                required
              >
                {boqOptions.map((b) => (
                  <AppSelect.Item key={b.value} value={b.value}>
                    {b.label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div className="flex justify-end">
              <AppButton
                type="button"
                onClick={handleGenerate}
                disabled={downloading || isLoading || !resolvedBoqId}
                isLoading={downloading}
              >
                Generate Excel
              </AppButton>
            </div>
          </div>

          {resolvedBoqId && (
            <div className="mt-6">
              {matrixLoading && <div className="text-sm text-muted-foreground">Loading report...</div>}

              {!matrixLoading && matrixData && (
                <div className="w-full overflow-x-auto border rounded-md">
                  <table className="w-full min-w-max text-sm border-collapse">
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className="px-3 py-2 text-left font-medium w-[320px] border bg-blue-600 text-white whitespace-nowrap"
                        >
                          Description of item
                        </th>
                        <th rowSpan={2} className="px-3 py-2 text-left font-medium border bg-blue-600 text-white">
                          Unit
                        </th>
                        <th rowSpan={2} className="px-3 py-2 text-right font-medium border bg-blue-600 text-white whitespace-nowrap">
                          BOQ QTY
                        </th>
                        <th rowSpan={2} className="px-3 py-2 text-right font-medium border bg-blue-600 text-white whitespace-nowrap">
                          Rate
                        </th>
                        <th rowSpan={2} className="px-3 py-2 text-right font-medium border bg-blue-600 text-white whitespace-nowrap">
                          BOQ AMOUNT
                        </th>

                        <th colSpan={2} className="px-3 py-2 text-center font-medium border bg-yellow-300 text-black whitespace-nowrap">
                          Total Upto date billed
                        </th>

                        {matrixData.bills.map((b) => (
                          <th
                            key={b.id}
                            colSpan={2}
                            className="px-3 py-2 text-center font-medium border bg-yellow-300 text-black whitespace-nowrap"
                          >
                            {b.label}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        <th className="px-3 py-1 text-right font-medium border bg-yellow-300 text-black whitespace-nowrap">Qty</th>
                        <th className="px-3 py-1 text-right font-medium border bg-yellow-300 text-black whitespace-nowrap">Amount</th>
                        {matrixData.bills.map((b) => (
                          <Fragment key={b.id}>
                            <th className="px-3 py-1 text-right font-medium border bg-yellow-300 text-black whitespace-nowrap">Qty</th>
                            <th className="px-3 py-1 text-right font-medium border bg-yellow-300 text-black whitespace-nowrap">Amount</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matrixData.rows.map((r) => (
                        <tr key={r.boqItemId} className={r.isGroup ? "bg-muted/20" : ""}>
                          <td className="px-3 py-2 text-left align-top whitespace-normal break-words w-[320px] max-w-[320px] border border-gray-300 dark:border-gray-700">
                            {r.description}
                          </td>
                          <td className="px-3 py-2 text-left whitespace-nowrap border border-gray-300 dark:border-gray-700">{r.unit}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700">{Number(r.boqQty || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700">{Number(r.rate || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700">{Number(r.boqAmount || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">{Number(r.totalUpto?.qty || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">{Number(r.totalUpto?.amount || 0).toFixed(2)}</td>
                          {matrixData.bills.map((b) => {
                            const v = r.bills?.[String(b.id)] || { qty: 0, amount: 0 };
                            return (
                              <Fragment key={b.id}>
                                <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">
                                  {Number(v.qty || 0).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">
                                  {Number(v.amount || 0).toFixed(2)}
                                </td>
                              </Fragment>
                            );
                          })}
                        </tr>
                      ))}

                      {totals && (
                        <tr className="font-semibold">
                          <td className="px-3 py-2 text-left border border-gray-300 dark:border-gray-700">TOTAL</td>
                          <td className="px-3 py-2 text-left border border-gray-300 dark:border-gray-700"></td>
                          <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700">{totals.boqQty.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-left border border-gray-300 dark:border-gray-700"></td>

                          <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700">{totals.boqAmount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">{totals.totalUptoQty.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">{totals.totalUptoAmount.toFixed(2)}</td>
                          {matrixData.bills.map((b) => (
                            <Fragment key={b.id}>
                              <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">
                                {Number(totals.billQtyById.get(b.id) || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right border border-gray-300 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-950/30">
                                {Number(totals.billAmountById.get(b.id) || 0).toFixed(2)}
                              </td>
                            </Fragment>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </AppCard.Content>
      </AppCard>
    </Form>
  );
}
