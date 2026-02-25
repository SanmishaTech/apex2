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
import { AppSelect } from "@/components/common/app-select";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import type { SitesResponse } from "@/types/sites";

type OverallSiteBudgetListItem = {
  id: number;
  siteId: number;
  site: { id: number; site: string } | null;
  boqId: number;
  boq: { id: number; boqNo: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

type OverallSiteBudgetsResponse = {
  data: OverallSiteBudgetListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const ALL_VALUE = "__ALL__";

export default function OverallSiteBudgetsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    siteId: "",
    sort: "createdAt",
    order: "desc",
  });

  const { page, perPage, search, siteId, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      siteId: string;
      sort: string;
      order: "asc" | "desc";
    };

  const { can } = usePermissions();
  const canReadSites = can(PERMISSIONS.READ_SITES) || can(PERMISSIONS.VIEW_SITES);

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteIdDraft, setSiteIdDraft] = useState(siteId);

  useEffect(() => {
    setSearchDraft(search);
    setSiteIdDraft(siteId);
  }, [search, siteId]);

  const { data: sitesData } = useSWR<SitesResponse>(
    canReadSites ? "/api/sites?perPage=100" : null,
    apiGet
  );

  const filtersDirty = searchDraft !== search || siteIdDraft !== siteId;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      siteId: siteIdDraft,
    });
  }

  function resetFilters() {
    setSearchDraft("");
    setSiteIdDraft("");
    setQp({ page: 1, search: "", siteId: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (siteId) sp.set("siteId", siteId);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/overall-site-budgets?${sp.toString()}`;
  }, [page, perPage, search, siteId, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<OverallSiteBudgetsResponse>(
    query,
    apiGet
  );

  useEffect(() => {
    if (error)
      toast.error(
        (error as Error).message || "Failed to load overall site budgets"
      );
  }, [error]);

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/overall-site-budgets/${id}`);
      toast.success("Overall Site Budget deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const columns: Column<OverallSiteBudgetListItem>[] = [
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "boq",
      header: "BOQ No.",
      sortable: false,
      accessor: (r) => r.boq?.boqNo || `BOQ ${r.boqId}` || "—",
      cellClassName: "font-medium whitespace-nowrap",
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

  const siteOptions = (sitesData?.data || []).map((s) => ({
    value: String(s.id),
    label: s.site,
  }));

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Overall Site Budgets</AppCard.Title>
        <AppCard.Description>Manage overall site budgets.</AppCard.Description>
        {can(PERMISSIONS.CREATE_OVERALL_SITE_BUDGETS) && (
          <AppCard.Action>
            <Link href="/overall-site-budgets/new">
              <AppButton size="sm" iconName="Plus" type="button">
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          {canReadSites ? (
            <AppSelect
              label="Site"
              value={siteIdDraft || undefined}
              onValueChange={(v) => setSiteIdDraft(v === ALL_VALUE ? "" : v)}
              placeholder="All Sites"
              triggerClassName="h-9 min-w-[180px]"
            >
              <AppSelect.Item value={ALL_VALUE}>All Sites</AppSelect.Item>
              {siteOptions.map((opt) => (
                <AppSelect.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </AppSelect.Item>
              ))}
            </AppSelect>
          ) : null}

          <NonFormTextInput
            aria-label="Search Overall Site Budgets"
            placeholder="Search by Site, BOQ..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />

          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className="min-w-21"
          >
            Filter
          </AppButton>

          {(filtersDirty || search || siteId || searchDraft || siteIdDraft) && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="min-w-21"
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
              !can(PERMISSIONS.EDIT_OVERALL_SITE_BUDGETS) &&
              !can(PERMISSIONS.DELETE_OVERALL_SITE_BUDGETS)
            )
              return null;

            return (
              <div className="flex">
                {can(PERMISSIONS.EDIT_OVERALL_SITE_BUDGETS) && (
                  <Link href={`/overall-site-budgets/${row.siteId}/edit/${row.id}`}>
                    <EditButton
                      tooltip="Edit Overall Site Budget"
                      aria-label="Edit Overall Site Budget"
                    />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_OVERALL_SITE_BUDGETS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="overall site budget"
                    title="Delete overall site budget?"
                    description={
                      `This will permanently remove Overall Site Budget for BOQ "${
                        row.boq?.boqNo || row.boqId
                      }". This action cannot be undone.`
                    }
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
