"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet, apiDelete } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { FilterBar } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";

// Types

type DailyProgressListItem = {
  id: number;
  siteId: number;
  boqId: number;
  progressDate: string;
  amount: string | number | null;
  createdBy: { id: number; name: string } | null;
  updatedBy: { id: number; name: string } | null;
  site: { id: number; site: string } | null;
  boq: { id: number; boqNo: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

type DailyProgressResponse = {
  data: DailyProgressListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function DailyProgressPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "progressDate",
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

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

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
    return `/api/daily-progresses?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<DailyProgressResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error(
      (error as Error).message || "Failed to load Daily Progress records"
    );
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<DailyProgressListItem>[] = [
    {
      key: "progressDate",
      header: "Progress Date",
      sortable: true,
      accessor: (r) => formatDate(r.progressDate),
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "boq",
      header: "B.O.Q. No.",
      sortable: false,
      accessor: (r) => r.boq?.boqNo || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      accessor: (r) => (r.amount != null ? String(r.amount) : "—"),
      className: "text-right tabular-nums whitespace-nowrap",
    },
    {
      key: "createdBy",
      header: "Created By",
      sortable: false,
      accessor: (r) => r.createdBy?.name || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "updatedBy",
      header: "Updated By",
      sortable: false,
      accessor: (r) => r.updatedBy?.name || "—",
      className: "whitespace-nowrap",
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

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/daily-progresses/${id}`);
      toast.success("Daily Progress deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Daily Progress</AppCard.Title>
        <AppCard.Description>
          Manage daily progress entries.
        </AppCard.Description>
        {can(PERMISSIONS.EDIT_DAILY_PROGRESSES) && (
          <AppCard.Action>
            <Link href="/daily-progresses/new">
              <AppButton size="sm" iconName="Plus" type="button">
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search Daily Progress"
            placeholder="Search by Site or BOQ..."
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
            if (
              !can(PERMISSIONS.EDIT_DAILY_PROGRESSES) &&
              !can(PERMISSIONS.DELETE_DAILY_PROGRESSES)
            )
              return null;
            return (
              <div className="flex">
                {can(PERMISSIONS.EDIT_DAILY_PROGRESSES) && (
                  <Link href={`/daily-progresses/${row.id}/edit`}>
                    <EditButton
                      tooltip="Edit Daily Progress"
                      aria-label="Edit Daily Progress"
                    />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_DAILY_PROGRESSES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="Daily Progress"
                    title="Delete Daily Progress?"
                    description={`This will permanently remove Daily Progress record #${row.id}. This action cannot be undone.`}
                  />
                )}
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
