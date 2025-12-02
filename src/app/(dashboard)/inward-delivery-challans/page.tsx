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
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { apiDelete } from "@/lib/api-client";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { Eye } from "lucide-react";
// Types

type IDCListItem = {
  id: number;
  inwardChallanNo: string;
  inwardChallanDate: string;
  challanNo: string;
  challanDate: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  billAmount: string | number | null;
  vendor: { id: number; vendorName: string } | null;
  site: { id: number; site: string } | null;
  purchaseOrder: { id: number; purchaseOrderNo?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

type IDCsResponse = {
  data: IDCListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function InwardDeliveryChallansPage() {
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

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
    });
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

  const { data, error, isLoading, mutate } = useSWR<IDCsResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || "Failed to load challans");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<IDCListItem>[] = [
    {
      key: "inwardChallanNo",
      header: "IDC No",
      sortable: true,
      accessor: (r) => r.inwardChallanNo,
      cellClassName: "font-medium whitespace-nowrap",
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
      key: "vendor",
      header: "Vendor",
      sortable: false,
      accessor: (r) => r.vendor?.vendorName || "—",
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
      key: "inwardChallanDate",
      header: "IDC Date",
      sortable: true,
      accessor: (r) => formatDate(r.inwardChallanDate),
      className: "whitespace-nowrap",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
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
      key: "createdAt",
      header: "Created",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) => formatDate(r.createdAt),
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: false,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) => formatRelativeTime(r.updatedAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

 

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Inward Delivery Challans</AppCard.Title>
        <AppCard.Description>
          Manage inward delivery challans.
        </AppCard.Description>
        <AppCard.Action>
          <Link href="/inward-delivery-challans/new">
            <AppButton size="sm" iconName="Plus" type="button">
              Add
            </AppButton>
          </Link>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search Challans"
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
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            return (
              <div className="flex">
                <Link href={`/inward-delivery-challans/${row.id}`}>
                  <AppButton
                    variant="secondary"
                    size="icon"
                    type="button"
                    aria-label="View Challan"
                  >
                    <Eye />
                  </AppButton>
                </Link>
              </div>
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
  );
}
