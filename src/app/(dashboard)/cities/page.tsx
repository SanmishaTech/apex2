"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { FilterBar } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { BulkCitiesUploadDialog } from "@/components/common/bulk-cities-upload-dialog";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import { apiDelete } from "@/lib/api-client";
import { CitiesResponse, City } from "@/types/cities";
import { State } from "@/types/states";

export default function CitiesPage() {
  const { pushWithScrollSave } = useScrollRestoration("cities-list");
  const [importOpen, setImportOpen] = useState(false);

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    stateId: "",
    sort: "city",
    order: "asc",
  });
  const { page, perPage, search, stateId, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    stateId: string;
    sort: string;
    order: "asc" | "desc";
  };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [stateIdDraft, setStateIdDraft] = useState(stateId);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  useEffect(() => {
    setStateIdDraft(stateId);
  }, [stateId]);

  const filtersDirty = searchDraft !== search || stateIdDraft !== stateId;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      stateId: stateIdDraft,
    });
  }

  function resetFilters() {
    setSearchDraft("");
    setStateIdDraft("");
    setQp({ page: 1, search: "", stateId: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (stateId) sp.set("stateId", stateId);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/cities?${sp.toString()}`;
  }, [page, perPage, search, stateId, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<CitiesResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();

  // Fetch states for filter dropdown
  const { data: statesData } = useSWR<{ data: State[] }>(
    "/api/states?perPage=100",
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load cities");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<City>[] = [
    {
      key: "city",
      header: "City Name",
      sortable: true,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "state",
      header: "State",
      sortable: false,
      accessor: (r) => r.state?.state || "-",
      cellClassName: "whitespace-nowrap",
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
      await apiDelete(`/api/cities/${id}`);
      toast.success("City deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Cities</AppCard.Title>
        <AppCard.Description>Manage application cities.</AppCard.Description>
        {can(PERMISSIONS.EDIT_CITIES) && (
          <AppCard.Action>
            <div className="flex gap-2">
              <AppButton
                size="sm"
                variant="outline"
                iconName="Upload"
                type="button"
                onClick={() => setImportOpen(true)}
              >
                Import
              </AppButton>
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/cities/new")}
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
            aria-label="Search cities"
            placeholder="Search cities..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppSelect
            value={stateIdDraft || "__all"}
            onValueChange={(v) => setStateIdDraft(v === "__all" ? "" : v)}
            placeholder="State"
          >
            <AppSelect.Item value="__all">All States</AppSelect.Item>
            {statesData?.data?.map((state: State) => (
              <AppSelect.Item key={state.id} value={String(state.id)}>
                {state.state}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !stateIdDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {(search || stateId) && (
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
          renderRowActions={(city) => {
            if (
              !can(PERMISSIONS.EDIT_CITIES) &&
              !can(PERMISSIONS.DELETE_CITIES)
            )
              return null;
            return (
              <div className="flex">
                {can(PERMISSIONS.EDIT_CITIES) && (
                  <EditButton
                    tooltip="Edit City"
                    aria-label="Edit City"
                    onClick={() =>
                      pushWithScrollSave(`/cities/${city.id}/edit`)
                    }
                  />
                )}
                {can(PERMISSIONS.DELETE_CITIES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(city.id)}
                    itemLabel="city"
                    title="Delete city?"
                    description={`This will permanently remove ${city.city}. This action cannot be undone.`}
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
      <BulkCitiesUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onUploadSuccess={() => mutate()}
      />
    </AppCard>
  );
}
