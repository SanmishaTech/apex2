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
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Types

type ODCListItem = {
  id: number;
  outwardChallanNo: string;
  outwardChallanDate: string;
  challanNo: string;
  challanDate: string;
  fromSite: { id: number; site: string } | null;
  toSite: { id: number; site: string } | null;
  createdById: number;
  approved1ById?: number | null;
  isApproved1: boolean;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
};

type ODCsResponse = {
  data: ODCListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function OutwardDeliveryChallansPage() {
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
    return `/api/outward-delivery-challans?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<ODCsResponse>(
    query,
    apiGet
  );
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  if (error) toast.error((error as Error).message || "Failed to load challans");

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<ODCListItem>[] = [
    {
      key: "outwardChallanNo",
      header: "ODC No",
      sortable: true,
      accessor: (r) => r.outwardChallanNo,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "fromSite",
      header: "From Site",
      sortable: false,
      accessor: (r) => r.fromSite?.site || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "toSite",
      header: "To Site",
      sortable: false,
      accessor: (r) => r.toSite?.site || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "outwardChallanDate",
      header: "ODC Date",
      sortable: true,
      accessor: (r) => formatDate(r.outwardChallanDate),
      className: "whitespace-nowrap",
    },
    {
      key: "isApproved1",
      header: "Approved",
      sortable: false,
      accessor: (r) => (r.isApproved1 ? "Yes" : "No"),
      className: "whitespace-nowrap",
    },
    {
      key: "isAccepted",
      header: "Accepted",
      sortable: false,
      accessor: (r) => (r.isAccepted ? "Yes" : "No"),
      className: "whitespace-nowrap",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      accessor: (r) => formatDate(r.createdAt),
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: false,
      accessor: (r) => formatRelativeTime(r.updatedAt),
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
  ];
  const sortState: SortState = { field: sort, order };

  const canCreate = can(PERMISSIONS.CREATE_OUTWARD_DELIVERY_CHALLAN);

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Outward Delivery Challans</AppCard.Title>
        <AppCard.Description>
          Manage outward delivery challans.
        </AppCard.Description>
        <AppCard.Action>
          {canCreate && (
            <Link href="/outward-delivery-challans/new">
              <AppButton size="sm" iconName="Plus" type="button">
                Add
              </AppButton>
            </Link>
          )}
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search Challans"
            placeholder="Search by ODC No, Challan No, Site..."
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
            const uid = (user as any)?.id as number | undefined;
            const canView = can(PERMISSIONS.READ_OUTWARD_DELIVERY_CHALLAN);
            const canApprove =
              can(PERMISSIONS.APPROVE_OUTWARD_DELIVERY_CHALLAN) &&
              !row.isApproved1 &&
              uid !== row.createdById;
            const canAccept =
              can(PERMISSIONS.ACCEPT_OUTWARD_DELIVERY_CHALLAN) &&
              row.isApproved1 &&
              !row.isAccepted &&
              uid !== row.createdById &&
              uid !== (row.approved1ById ?? undefined);
            const any = canView || canApprove || canAccept;
            if (!any) return null;

            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <AppButton size="sm" variant="secondary" type="button">
                    Actions
                  </AppButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canView && (
                    <DropdownMenuItem asChild>
                      <Link href={`/outward-delivery-challans/${row.id}`}>
                        View
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canApprove && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/outward-delivery-challans/${row.id}/approve`}
                      >
                        Approve
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canAccept && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/outward-delivery-challans/${row.id}/accept`}
                      >
                        Accept
                      </Link>
                    </DropdownMenuItem>
                  )}
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
  );
}
