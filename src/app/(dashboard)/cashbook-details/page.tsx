"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

import { apiGet } from "@/lib/api-client";
import { AppButton } from "@/components/common/app-button";
import { AppCard } from "@/components/common/app-card";
import { DataTable, Column } from "@/components/common/data-table";
import { FilterBar } from "@/components/common";
import { ComboboxInput } from "@/components/common/combobox-input";
import { TextInput } from "@/components/common/text-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateDMY, formatNumber } from "@/lib/locales";

type FormValues = {
  siteId: string;
  boqId: string;
  fromDate: string;
  toDate: string;
  cashbookHeadIds: string[];
};

type CashbookDetailRow = {
  id: number;
  voucherDate: string;
  voucherNo: string | null;
  cashbookHeadId: number | null;
  cashbookHeadName: string;
  description: string;
  supportingBill: boolean;
  openingBalance: string | number | null;
  amountReceived: string | number | null;
  amountPaid: string | number | null;
  closingBalance: string | number | null;
  documentUrl: string | null;
  cashbookId: number;
};

export default function CashbookDetailsPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_CASHBOOKS)) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Cashbook details.
      </div>
    );
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      siteId: "",
      boqId: "",
      fromDate: "",
      toDate: "",
      cashbookHeadIds: [],
    },
  });

  const { control, watch, getValues, reset } = form;

  const selectedSiteId = watch("siteId");
  const resolvedSiteId =
    selectedSiteId && !Number.isNaN(Number(selectedSiteId))
      ? Number(selectedSiteId)
      : undefined;

  const fromDate = watch("fromDate");
  const toDate = watch("toDate");
  const boqId = watch("boqId");

  const [applied, setApplied] = useState<FormValues | null>(null);
  const shouldFetch = Boolean(
    applied?.siteId && applied?.boqId && applied?.fromDate && applied?.toDate
  );

  const { data: sitesData } = useSWR<{ data: { id: number; site: string }[] }>(
    "/api/sites?perPage=1000",
    apiGet
  );

  const { data: boqsData } = useSWR<{ data: { id: number; boqNo: string; workName: string }[] }>(
    resolvedSiteId ? `/api/boqs?perPage=1000&siteId=${resolvedSiteId}` : null,
    apiGet
  );

  const { data: cashbookHeadsData } = useSWR<{ data: { id: number; cashbookHeadName: string }[] }>(
    "/api/cashbook-heads?perPage=1000",
    apiGet
  );

  const siteOptions = useMemo(
    () =>
      (sitesData?.data || []).map((s) => ({
        value: String(s.id),
        label: s.site,
      })),
    [sitesData]
  );

  const boqOptions = useMemo(
    () =>
      (boqsData?.data || []).map((b) => ({
        value: String(b.id),
        label: b.boqNo || "",
      })),
    [boqsData]
  );

  const headOptions = useMemo(
    () =>
      (cashbookHeadsData?.data || []).map((h) => ({
        value: String(h.id),
        label: h.cashbookHeadName,
      })),
    [cashbookHeadsData]
  );

  const [exporting, setExporting] = useState(false);

  const detailsKey = useMemo(() => {
    if (!shouldFetch || !applied) return null;
    const qs = new URLSearchParams({
      siteId: String(applied.siteId),
      boqId: String(applied.boqId),
      fromDate: String(applied.fromDate),
      toDate: String(applied.toDate),
    });
    const headIdsCsv = (applied.cashbookHeadIds || []).filter(Boolean).join(",");
    if (headIdsCsv) qs.set("cashbookHeadIds", headIdsCsv);
    return `/api/cashbook-details?${qs.toString()}`;
  }, [shouldFetch, applied]);

  const { data: detailsRes, isLoading: detailsLoading } = useSWR<{ data: CashbookDetailRow[] }>(
    detailsKey,
    apiGet
  );

  const rows = detailsRes?.data || [];

  const formatAmount = (v: unknown) => {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return "0.00";
    return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const columns: Column<CashbookDetailRow>[] = useMemo(
    () => [
      {
        key: "voucherDate",
        header: "Date",
        cellClassName: "whitespace-nowrap",
        accessor: (r) => <div>{formatDateDMY(r.voucherDate)}</div>,
      },
      {
        key: "cashbookHeadName",
        header: "Cashbook Head",
        cellClassName: "max-w-[180px] whitespace-normal break-words",
        accessor: (r) => <div>{r.cashbookHeadName || "-"}</div>,
      },
      {
        key: "description",
        header: "Description",
        cellClassName: "max-w-[220px] whitespace-normal break-words",
        accessor: (r) => <div>{r.description || ""}</div>,
      },
      {
        key: "supportingBill",
        header: "Supporting Bill",
        cellClassName: "whitespace-nowrap",
        accessor: (r) => (
          <StatusBadge
            active={r.supportingBill}
            activeLabel="Yes"
            inactiveLabel="No"
          />
        ),
      },
      {
        key: "voucherNo",
        header: "Voucher No.",
        cellClassName: "whitespace-nowrap",
        accessor: (r) => <div>{r.voucherNo || "-"}</div>,
      },
      {
        key: "openingBalance",
        header: "Opening Balance",
        cellClassName: "whitespace-nowrap text-right tabular-nums",
        accessor: (r) => <div className="text-right">{formatAmount(r.openingBalance)}</div>,
      },
      {
        key: "amountReceived",
        header: "Amt. Received",
        cellClassName: "whitespace-nowrap text-right tabular-nums",
        accessor: (r) => <div className="text-right">{formatAmount(r.amountReceived)}</div>,
      },
      {
        key: "amountPaid",
        header: "Amt. Paid",
        cellClassName: "whitespace-nowrap text-right tabular-nums",
        accessor: (r) => <div className="text-right">{formatAmount(r.amountPaid)}</div>,
      },
      {
        key: "closingBalance",
        header: "Closing Balance",
        cellClassName: "whitespace-nowrap text-right tabular-nums",
        accessor: (r) => <div className="text-right">{formatAmount(r.closingBalance)}</div>,
      },
    ],
    []
  );

  function applyFilters() {
    const v = getValues();
    if (!v.siteId || !v.boqId || !v.fromDate || !v.toDate) {
      setApplied(null);
      return;
    }
    setApplied(v);
  }

  function resetFilters() {
    reset({ siteId: "", boqId: "", fromDate: "", toDate: "", cashbookHeadIds: [] });
    setApplied(null);
  }

  async function handleExportExcel() {
    if (!applied?.siteId || !applied?.boqId || !applied?.fromDate || !applied?.toDate) return;

    setExporting(true);
    try {
      const qs = new URLSearchParams({
        fromDate: applied.fromDate,
        toDate: applied.toDate,
        siteId: applied.siteId,
        boqId: applied.boqId,
      });
      const headIdsCsv = (applied.cashbookHeadIds || []).filter(Boolean).join(",");
      if (headIdsCsv) qs.set("cashbookHeadIds", headIdsCsv);
      window.open(`/api/reports/cashbook-details-excel?${qs.toString()}`, "_blank");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center justify-between gap-3">
            <div>
              <AppCard.Title>Cashbook Details</AppCard.Title>
              <AppCard.Description>
                Select Site, BOQ and date range to view cashbook details. Optionally filter by heads.
              </AppCard.Description>
            </div>
            <div className="flex items-center gap-2">
              <AppButton asChild size="sm" iconName="Plus">
                <Link href="/cashbooks/new">Add Cashbook</Link>
              </AppButton>
              <AppButton
                size="sm"
                variant="secondary"
                iconName="Download"
                type="button"
                onClick={handleExportExcel}
                disabled={!shouldFetch || exporting}
                isLoading={exporting}
              >
                Export Excel
              </AppButton>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-3">
              <ComboboxInput
                control={control}
                name="siteId"
                label="Site"
                required
                options={siteOptions}
                placeholder="Select site"
              />
              <ComboboxInput
                control={control}
                name="boqId"
                label="BOQ"
                required
                options={boqOptions}
                placeholder={resolvedSiteId ? "Select BOQ" : "Select site first"}
                disabled={!resolvedSiteId}
              />
              <TextInput
                control={control}
                name="fromDate"
                label="From Date"
                type="date"
                required
                span={1}
                spanFrom="md"
              />
              <TextInput
                control={control}
                name="toDate"
                label="To Date"
                type="date"
                required
                span={1}
                spanFrom="md"
              />

              <MultiSelectInput
                control={control}
                name="cashbookHeadIds"
                label="Cashbook Heads (Optional)"
                options={headOptions}
                className="w-full md:col-span-4"
              />

              <div className="flex items-end gap-2 md:col-span-4">
                <AppButton
                  size="sm"
                  type="button"
                  onClick={applyFilters}
                  disabled={!resolvedSiteId || !boqId || !fromDate || !toDate}
                  className="min-w-21"
                >
                  Filter
                </AppButton>
                {applied && (
                  <AppButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={resetFilters}
                    className="min-w-21"
                  >
                    Reset
                  </AppButton>
                )}
              </div>
            </div>
          </FilterBar>

          <div className="mt-6">
            <DataTable
              columns={columns}
              data={rows}
              loading={detailsLoading}
              emptyMessage={
                shouldFetch
                  ? "No records found"
                  : "Select Site, BOQ, From Date and To Date and click Filter"
              }
              getRowKey={(r) => r.id}
              dense
              stickyHeader
              tableClassName="text-[11px]"
            />
          </div>
        </AppCard.Content>
      </AppCard>
    </Form>
  );
}
