"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { FilterBar } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type BillListItem = {
  id: number;
  inwardChallanNo: string;
  inwardChallanDate: string;
  challanNo: string;
  challanDate: string;
  purchaseOrder: { id: number; purchaseOrderNo?: string | null } | null;
  site: { id: number; site: string } | null;
  vendor: { id: number; vendorName: string } | null;
  billNo: string | null;
  billDate: string | null;
  dueDate: string | null;
  billAmount: number | string | null;
  totalPaidAmount: number | string | null;
  dueAmount: number | string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
};

type BillsResponse = {
  data: BillListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function InwardBillsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "createdAt",
    order: "desc",
  });
  const { page, perPage, search, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    sort: string;
    order: "asc" | "desc";
  };

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim() });
  }
  function resetFilters() {
    setSearchDraft("");
    setQp({ page: 1, search: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/inward-delivery-challans?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<BillsResponse>(query, apiGet);
  const { can } = usePermissions();

  // page-based edit flow; no dialog state needed

  if (error) toast.error((error as Error).message || "Failed to load bills");

  const columns: Column<BillListItem>[] = [
    {
      key: "inwardChallanNo",
      header: "Inward Challan No",
      sortable: true,
      accessor: (r) => r.inwardChallanNo,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "challanNo",
      header: "Challan No",
      sortable: false,
      accessor: (r) => r.challanNo || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "purchaseOrder",
      header: "PO No",
      sortable: false,
      accessor: (r) => r.purchaseOrder?.purchaseOrderNo || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "vendor",
      header: "Vendor",
      sortable: false,
      accessor: (r) => r.vendor?.vendorName || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "billNo",
      header: "Bill No",
      sortable: false,
      accessor: (r) => r.billNo || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "billDate",
      header: "Bill Date",
      sortable: true,
      accessor: (r) => (r.billDate ? formatDate(r.billDate) : "—"),
      className: "whitespace-nowrap",
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      accessor: (r) => (r.dueDate ? formatDate(r.dueDate) : "—"),
      className: "whitespace-nowrap",
    },
    {
      key: "billAmount",
      header: "Bill Amount",
      sortable: true,
      accessor: (r) => (r.billAmount != null ? String(r.billAmount) : "—"),
      className: "whitespace-nowrap",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "totalPaidAmount",
      header: "Total Paid",
      sortable: true,
      accessor: (r) =>
        r.totalPaidAmount != null ? String(r.totalPaidAmount) : "—",
      className: "whitespace-nowrap",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "dueAmount",
      header: "Due Amount",
      sortable: false,
      accessor: (r) =>
        r.dueAmount != null
          ? String(r.dueAmount)
          : String(
              Math.max(
                0,
                Number(
                  (Number(r.billAmount || 0) - Number(r.totalPaidAmount || 0)).toFixed(2)
                )
              )
            ),
      className: "whitespace-nowrap",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
      className: "whitespace-nowrap",
    },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <>
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Inward Bills</AppCard.Title>
        <AppCard.Description>Manage inward bills.</AppCard.Description>
        <AppCard.Action>
          <AppButton size="sm" type="button" disabled>
            Edit
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search Bills"
            placeholder="Search by IDC No, Challan No, Vendor, Site..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {search && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="min-w-[84px]"
            >
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => setQp({ sort: s.field, order: s.order })}
          stickyColumns={1}
          renderRowActions={(row) => {
            const canEdit = can(PERMISSIONS.EDIT_INWARD_BILL);
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <AppButton size="sm" variant="secondary" type="button">
                    Actions
                  </AppButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild disabled={!canEdit}>
                    <Link href={`/inward-bills/${row.id}/edit`}>Edit Bill</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <Pagination
          page={data?.page || page}
          totalPages={data?.totalPages || 1}
          total={data?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
      </AppCard.Footer>
    </AppCard>
    {/* page-based edit at /inward-bills/[id]/edit */}
    </>
  );
}
