"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import type { SortState } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { useProtectPage } from "@/hooks/use-protect-page";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { apiGet } from "@/lib/api-client";

interface Row {
  id: number;
  boqId: number;
  boqNo: string;
  siteId: number | null;
  site: string;
  itemId: number;
  description: string;
  qty: number;
  unit: string | null;
  orderedQty: number;
  remainingQty: number;
  rate: number;
  amount: number;
  orderedAmount: number;
  remainingAmount: number;
}

interface ListResponse {
  data: Row[];
  meta?: { page: number; perPage: number; totalPages: number; total: number };
}

export default function WorkDoneListPage() {
  useProtectPage();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    siteId: "",
    sort: "boqNo",
    order: "asc",
  });

  const { page, perPage, search, siteId, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    siteId: string;
    sort: string;
    order: "asc" | "desc";
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(siteId);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setSiteDraft(siteId), [siteId]);

  const filtersDirty = searchDraft !== search || siteDraft !== siteId;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), siteId: siteDraft });
  }
  function clearFilters() {
    setSearchDraft("");
    setSiteDraft("");
    setQp({ page: 1, search: "", siteId: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    sp.set("sort", sort);
    sp.set("order", order);
    if (search) sp.set("search", search);
    if (siteId) sp.set("siteId", siteId);
    return `/api/boqs/work-done?${sp.toString()}`;
  }, [page, perPage, search, siteId, sort, order]);

  const { data, isLoading } = useSWR<ListResponse>(query, apiGet);
  const { data: sitesOptions } = useSWR<any>("/api/sites/options", apiGet);

  const columns: Column<Row>[] = [
    { key: "boqNo", header: "BOQ Code", accessor: (r) => r.boqNo, sortable: true },
    { key: "description", header: "BOQ Item Description", accessor: (r) => r.description, sortable: true },
    { key: "site", header: "Site", accessor: (r) => r.site || "-", sortable: true },
    { key: "qty", header: "BOQ Qty", accessor: (r) => Number(r.qty || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "unit", header: "Unit", accessor: (r) => r.unit || "-", sortable: true },
    { key: "orderedQty", header: "Ordered Qty", accessor: (r) => Number(r.orderedQty || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "remainingQty", header: "Remaining Qty", accessor: (r) => Number(r.remainingQty || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "rate", header: "Rate", accessor: (r) => Number(r.rate || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "amount", header: "BOQ Amount", accessor: (r) => Number(r.amount || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "orderedAmount", header: "Ordered Amount", accessor: (r) => Number(r.orderedAmount || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
    { key: "remainingAmount", header: "Remaining Amount", accessor: (r) => Number(r.remainingAmount || 0).toFixed(2), sortable: true, className: "text-right", cellClassName: "text-right" },
  ];

  function onSortChange(s: SortState) {
    const newOrder = sort === s.field && order === "asc" ? "desc" : "asc";
    setQp({ sort: s.field, order: newOrder });
  }

  return (
    <AppCard>
      <AppCard.Header>
        <div>
          <AppCard.Title>Work Done</AppCard.Title>
          <AppCard.Description>List of BOQ items with ordered/remaining quantities and amounts.</AppCard.Description>
        </div>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search work done"
            placeholder="Search by BOQ code or item..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppSelect
            value={siteDraft || "__all"}
            onValueChange={(v) => setSiteDraft(v === "__all" ? "" : v)}
            placeholder="Site"
          >
            <AppSelect.Item value="__all">All Sites</AppSelect.Item>
            {(sitesOptions?.data || []).map((s: any) => (
              <AppSelect.Item key={s.id} value={String(s.id)}>
                {s.site}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <button
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90 h-9 px-4"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !siteDraft}
          >
            Filter
          </button>
          {(search || siteId) && (
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:opacity-90 h-9 px-4"
              onClick={clearFilters}
            >
              Reset
            </button>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={{ field: sort, order }}
          onSortChange={(s) => onSortChange(s)}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <Pagination
          page={data?.meta?.page || page}
          totalPages={data?.meta?.totalPages || 1}
          total={data?.meta?.total}
          perPage={data?.meta?.perPage || perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          disabled={isLoading}
        />
      </AppCard.Footer>
    </AppCard>
  );
}
