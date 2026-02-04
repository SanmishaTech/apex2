"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { AppButton, AppCard } from "@/components/common";
import { AppCombobox } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import type { SortState } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { useProtectPage } from "@/hooks/use-protect-page";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";

type Row = {
  id: number;
  siteId: number;
  site: string;
  itemId: number;
  item: string;
  unit: string | null;
  openingQty: number;
  closingQty: number;
};

type OverallResponse = {
  data: Row[];
  meta?: { page: number; perPage: number; totalPages: number; total: number };
};


export default function OverallStockPage() {
  useProtectPage();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    siteId: "",
    itemId: "",
    sort: "site",
    order: "asc",
  });

  const { page, perPage, search, siteId, itemId, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    siteId: string;
    itemId: string;
    sort: string;
    order: "asc" | "desc";
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(siteId);
  const [itemDraft, setItemDraft] = useState(itemId);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setSiteDraft(siteId), [siteId]);
  useEffect(() => setItemDraft(itemId), [itemId]);

  const filtersDirty =
    searchDraft !== search || siteDraft !== siteId || itemDraft !== itemId;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), siteId: siteDraft, itemId: itemDraft });
  }
  function clearFilters() {
    setSearchDraft("");
    setSiteDraft("");
    setItemDraft("");
    setQp({ page: 1, search: "", siteId: "", itemId: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    sp.set("sort", sort);
    sp.set("order", order);
    if (search) sp.set("search", search);
    if (siteId) sp.set("siteId", siteId);
    if (itemId) sp.set("itemId", itemId);
    return `/api/stocks/overall?${sp.toString()}`;
  }, [page, perPage, search, siteId, itemId, sort, order]);

  const { data, isLoading } = useSWR<OverallResponse>(query, apiGet);
  const { data: sitesOptions } = useSWR<any>("/api/sites/options", apiGet);
  const itemsOptionsKey = useMemo(() => {
    return siteDraft
      ? `/api/items/options?siteId=${siteDraft}`
      : "/api/items/options?assignedOnly=true";
  }, [siteDraft]);
  const { data: itemsOptions } = useSWR<any>(itemsOptionsKey, apiGet);

  const [exporting, setExporting] = useState(false);

  const itemComboboxOptions = useMemo(() => {
    const opts = (itemsOptions?.data || []).map((it: any) => ({
      value: String(it.id),
      label: it.itemCode ? `${it.itemCode} - ${it.item}` : String(it.item || ""),
    }));
    return [{ value: "", label: "All Items" }, ...opts];
  }, [itemsOptions]);

  async function handleExport() {
    setExporting(true);
    try {
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      if (siteId) sp.set("siteId", siteId);
      if (itemId) sp.set("itemId", itemId);
      if (sort) sp.set("sort", sort);
      if (order) sp.set("order", order);

      const url = `/api/stocks/overall/export?${sp.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast.error(`Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `overall_stock_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast.error(e?.message || "Failed to export overall stock");
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Row>[] = [
    { key: "site", header: "Site name", accessor: (r) => r.site, sortable: true },
    { key: "item", header: "Item", accessor: (r) => r.item, sortable: true },
    { key: "unit", header: "Unit", accessor: (r) => r.unit || "-", sortable: true },
    {
      key: "openingQty",
      header: "Opening Qty",
      accessor: (r) => Number(r.openingQty || 0).toFixed(4),
      sortable: true,
      className: "text-right whitespace-nowrap",
      cellClassName: "text-right whitespace-nowrap",
    },
    {
      key: "closingQty",
      header: "Closing Qty",
      accessor: (r) => Number(r.closingQty || 0).toFixed(4),
      sortable: true,
      className: "text-right whitespace-nowrap",
      cellClassName: "text-right whitespace-nowrap",
    },
  ];

  function onSortChange(s: SortState) {
    const newOrder = sort === s.field && order === "asc" ? "desc" : "asc";
    setQp({ sort: s.field, order: newOrder });
  }

  return (
    <AppCard>
      <AppCard.Header>
        <div>
          <AppCard.Title>Overall Stock</AppCard.Title>
          <AppCard.Description>All sites and items with stock.</AppCard.Description>
        </div>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search overall stock"
            placeholder="Search by site or item..."
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
          <div className="w-full">
            <label className="sr-only">Item</label>
            <AppCombobox
              value={itemDraft || ""}
              onValueChange={(v) => setItemDraft(v || "")}
              options={itemComboboxOptions}
              placeholder="All Items"
              searchPlaceholder="Search item..."
              emptyText="No items found."
            />
          </div>
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !siteDraft && !itemDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {(search || siteId || itemId) && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={clearFilters}
              className="min-w-[84px]"
            >
              Reset
            </AppButton>
          )}
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleExport}
            isLoading={exporting}
            disabled={exporting}
            className="min-w-[84px]"
          >
            Export
          </AppButton>
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
