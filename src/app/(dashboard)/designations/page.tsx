"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { AppButton, AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { DeleteButton } from "@/components/common/delete-button";
import { SortState } from "@/components/common/data-table";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { apiGet, apiDelete } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { EditButton } from "@/components/common/icon-button";
import type { DesignationsResponse, Designation } from "@/types/designations";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

export default function DesignationsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "designationName",
    order: "asc",
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
    return `/api/designations?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<DesignationsResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration("designations-list");

  if (error) {
    toast.error((error as Error).message || "Failed to load designations");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<Designation>[] = [
    {
      key: "designationName",
      header: "Designation Name",
      sortable: true,
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
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/designations/${id}`);
      toast.success("Designation deleted");
      await mutate();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete designation");
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Designations</AppCard.Title>
        <AppCard.Description>Manage master designations.</AppCard.Description>
        {can(PERMISSIONS.EDIT_STATES) && (
          <AppCard.Action>
            <div className="flex gap-2">
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/designations/new")}
              >
                Add
              </AppButton>
            </div>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search designations"
            placeholder="Search designations..."
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
          data={data?.data || []}
          columns={columns}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          loading={isLoading}
          emptyMessage="No designations found"
          renderRowActions={(row) => (
            <div className="flex items-center gap-2">
              {can(PERMISSIONS.EDIT_STATES) && (
                <EditButton
                  tooltip="Edit Designation"
                  aria-label="Edit Designation"
                  onClick={() => pushWithScrollSave(`/designations/${row.id}/edit`)}
                />
              )}
              {can(PERMISSIONS.DELETE_STATES) && (
                <DeleteButton
                  onDelete={() => handleDelete(row.id)}
                  itemLabel="designation"
                  title="Delete designation?"
                  description={`This will permanently remove ${row.designationName}. This action cannot be undone.`}
                />
              )}
            </div>
          )}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <Pagination
          page={data?.meta?.page || page}
          totalPages={data?.meta?.totalPages || 1}
          total={data?.meta?.total}
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
