"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppButton, AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import type { SortState } from "@/components/common/data-table";
import { FilterBar } from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StockSiteRow {
  id: number;
  site: string;
  siteCode?: string | null;
  companyId?: number | null;
  itemCount: number;
}

export default function StockSitesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  const filtersDirty = searchDraft !== search;
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState<SortState>({ field: "site", order: "asc" });

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    sp.set("sort", sort.field === "itemCount" ? "itemCount" : "site");
    sp.set("order", sort.order);
    if (search) sp.set("search", search);
    return `/api/stocks/sites?${sp.toString()}`;
  }, [search, page, perPage, sort]);

  const { data, error, isLoading, mutate } = useSWR<{
    data: StockSiteRow[];
    meta?: { page: number; perPage: number; totalPages: number; total: number };
  }>(query, apiGet);
  if (error)
    toast.error((error as Error).message || "Failed to load stock sites");

  function applyFilters() {
    setSearch(searchDraft.trim());
    setPage(1);
  }
  function resetFilters() {
    setSearch("");
    setSearchDraft("");
    setPage(1);
  }

  const columns: Column<StockSiteRow>[] = [
    { key: "site", header: "Site", accessor: (r) => r.site, sortable: true },
    {
      key: "itemCount",
      header: "Items",
      accessor: (r) => String(r.itemCount),
      sortable: true,
      className: "whitespace-nowrap",
    },
  ];

  function onSortChange(s: SortState) {
    setSort(s);
    setPage(1);
  }

  async function onUpdateClosingStock() {
    try {
      setUpdating(true);
      const res = await apiPost<{ updated?: number; message?: string }>(
        "/api/stocks/update-closing",
        {},
        { showErrorToast: true }
      );
      const msg = (res as any)?.message || "Closing stock updated";
      toast.success(msg);
      await mutate();
    } catch (e) {
      // error toast handled by api client when showErrorToast is true
    } finally {
      setUpdating(false);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <div className="flex items-center justify-between mb-3">
          <div>
            <AppCard.Title>Stock</AppCard.Title>
            <AppCard.Description>
              Stock maintained per site.
            </AppCard.Description>
          </div>
          <AppButton
            size="sm"
            onClick={onUpdateClosingStock}
            disabled={updating}
          >
            {updating ? "Updating..." : "Update Closing Stock"}
          </AppButton>
        </div>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search">
          <NonFormTextInput
            aria-label="Search sites"
            placeholder="Search by site or code..."
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
          loading={isLoading}
          sort={sort}
          onSortChange={onSortChange}
          emptyMessage="No sites found"
          renderRowActions={(row) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AppButton size="sm" variant="secondary">
                  Actions
                </AppButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/stocks/opening/new?siteId=${row.id}`)
                  }
                >
                  Opening Stock
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/stocks/${row.id}/view`)}
                >
                  View stock
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />

        <div className="mt-4">
          <Pagination
            page={data?.meta?.page || page}
            totalPages={data?.meta?.totalPages || 1}
            perPage={data?.meta?.perPage || perPage}
            onPerPageChange={(val) => {
              setPerPage(val);
              setPage(1);
            }}
            onPageChange={(p) => setPage(p)}
            showPageNumbers
            disabled={isLoading}
          />
        </div>
      </AppCard.Content>
    </AppCard>
  );
}
