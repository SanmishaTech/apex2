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
import { ViewButton, EditButton } from "@/components/common/icon-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { SubContractor, SubContractorsResponse } from "@/types/sub-contractors";

export default function SubContractorsPage() {
  const { pushWithScrollSave } = useScrollRestoration("sub-contractors-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "name",
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
    return `/api/sub-contractors?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { can } = usePermissions();

  const { data, error, isLoading, mutate } = useSWR<SubContractorsResponse>(
    can(PERMISSIONS.READ_SUB_CONTRACTORS) ? query : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || "Failed to load sub contractors");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<SubContractor>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">Code: {r.code}</div>
        </div>
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      accessor: (r) => (
        <div>
          <div>{r.contactPerson || "—"}</div>
        </div>
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "city",
      header: "City/State",
      accessor: (r) => (
        <div className="text-sm">
          {r.city?.city || "—"}
          {r.state?.state && (
            <div className="text-xs text-muted-foreground">
              {r.state.state}
            </div>
          )}
        </div>
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "panNumber",
      header: "PAN Number",
      accessor: (r) => r.panNumber || "—",
      cellClassName: "font-mono text-sm whitespace-nowrap",
    },
    {
      key: "gstNumber",
      header: "GST Number",
      accessor: (r) => r.gstNumber || "—",
      cellClassName: "font-mono text-sm whitespace-nowrap",
    },
    {
        key: "bank",
        header: "Bank Details",
        accessor: (r) => (
          <div className="text-sm">
            {r.bankName || "—"}
            {r.accountNumber && (
              <div className="text-xs text-muted-foreground">
                A/C: {r.accountNumber}
              </div>
            )}
          </div>
        ),
        cellClassName: "whitespace-nowrap",
    }
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/sub-contractors/${id}`);
      toast.success("Sub Contractor deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Sub Contractors</AppCard.Title>
        <AppCard.Description>Manage sub contractors.</AppCard.Description>
        {can(PERMISSIONS.CREATE_SUB_CONTRACTORS) && (
          <AppCard.Action>
            <AppButton
              size="sm"
              iconName="Plus"
              type="button"
              onClick={() => pushWithScrollSave("/sub-contractors/new")}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search">
          <NonFormTextInput
            aria-label="Search sub contractors"
            placeholder="Search name, code, pan, gst..."
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
          emptyMessage={can(PERMISSIONS.READ_SUB_CONTRACTORS) ? "No sub contractors found" : "No permission to read sub contractors"}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(sub) => {
            return (
              <div className="flex">
                {can(PERMISSIONS.VIEW_SUB_CONTRACTORS) && (
                  <ViewButton
                    tooltip="View Sub Contractor"
                    aria-label="View Sub Contractor"
                    onClick={() => pushWithScrollSave(`/sub-contractors/${sub.id}/view`)}
                  />
                )}
                {can(PERMISSIONS.EDIT_SUB_CONTRACTORS) && (
                  <EditButton
                    tooltip="Edit Sub Contractor"
                    aria-label="Edit Sub Contractor"
                    onClick={() => pushWithScrollSave(`/sub-contractors/${sub.id}/edit`)}
                  />
                )}
                {can(PERMISSIONS.DELETE_SUB_CONTRACTORS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(sub.id)}
                    itemLabel="sub contractor"
                    title="Delete sub contractor?"
                    description={`This will permanently remove ${sub.name}. This action cannot be undone.`}
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
