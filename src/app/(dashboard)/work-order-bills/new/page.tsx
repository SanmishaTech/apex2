"use client";

import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { apiGet, apiDelete } from "@/lib/api-client";
import { WorkOrderBillForm } from "../work-order-bill-form";
import { AppCard } from "@/components/common/app-card";
import { DataTable, Column } from "@/components/common/data-table";
import { WorkOrderBill, WorkOrderBillsResponse } from "@/types/work-order-bills";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { Pagination } from "@/components/common/pagination";
import { EditButton } from "@/components/common/icon-button";
import { DeleteButton } from "@/components/common/delete-button";
import { toast } from "@/lib/toast";
import { useMemo } from "react";

const BILL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatBillDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return BILL_DATE_FORMATTER.format(date);
}

export default function NewWorkOrderBillPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const workOrderId = sp?.get("workOrderId");
  const woId = workOrderId ? parseInt(workOrderId) : NaN;

  const [qp, setQp] = useQueryParamsState({ page: 1, perPage: 10, sort: "billDate", order: "desc" });
  const { page, perPage, sort, order } = (qp as unknown) as {
    page: number;
    perPage: number;
    sort: string;
    order: "asc" | "desc";
  };

  const query = useMemo(() => {
    if (!Number.isFinite(woId)) return null as any;
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    sp.set("workOrderId", String(woId));
    sp.set("sort", sort);
    sp.set("order", order);
    return `/api/work-order-bills?${sp.toString()}`;
  }, [woId, page, perPage, sort, order]);

  const { data, isLoading, mutate } = useSWR<WorkOrderBillsResponse>(query, apiGet);
  const { data: workOrder } = useSWR<{ id: number; workOrderNo: string }>(
    Number.isFinite(woId) ? `/api/work-orders/${woId}` : null,
    apiGet
  );

  const columns: Column<WorkOrderBill>[] = [
    { key: "billNo", header: "Bill No.", sortable: true },
    {
      key: "billDate",
      header: "Bill Date",
      sortable: true,
      accessor: (row) => formatBillDate(row.billDate),
    },
    {
      key: "billAmount",
      header: "Amount",
      accessor: (r) => r.billAmount,
      className: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "paidAmount",
      header: "Paid",
      accessor: (r) => r.paidAmount,
      className: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "deductionTax",
      header: "Deduction / Tax",
      accessor: (r) => r.deductionTax,
      className: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "dueAmount",
      header: "Due",
      accessor: (r) => r.dueAmount,
      className: "text-right",
      cellClassName: "text-right",
    },
    { key: "status", header: "Status" },
  ];

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/work-order-bills/${id}`);
      toast.success("Bill deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <WorkOrderBillForm
        mode="create"
        initial={{ workOrderId: workOrderId ? parseInt(workOrderId) : undefined }}
        mutate={mutate}
      />
      {Number.isFinite(woId) && (
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>{`Bills for Work Order - ${
              workOrder?.workOrderNo ?? `#${woId}`
            }`}</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            <DataTable
              columns={columns}
              data={data?.data || []}
              loading={isLoading}
              renderRowActions={(row) => (
                <div className="flex">
                  <EditButton
                    tooltip="Edit Bill"
                    aria-label="Edit Bill"
                    onClick={() => router.push(`/work-order-bills/${row.id}/edit`)}
                  />
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="bill"
                    title="Delete bill?"
                    description={`This will permanently remove ${row.billNo}. This action cannot be undone.`}
                  />
                </div>
              )}
            />
          </AppCard.Content>
          <AppCard.Footer className="justify-end">
            <Pagination
              page={(data as any)?.page || (data as any)?.meta?.page || page}
              totalPages={(data as any)?.totalPages || (data as any)?.meta?.totalPages || 1}
              total={(data as any)?.total || (data as any)?.meta?.total || undefined}
              perPage={perPage}
              onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
              onPageChange={(p) => setQp({ page: p })}
              showPageNumbers
              disabled={isLoading}
            />
          </AppCard.Footer>
        </AppCard>
      )}
    </div>
  );
}
