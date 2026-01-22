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
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { formatDate } from "@/lib/utils";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { AppSelect } from "@/components/common/app-select";

type WorkOrder = {
  id: number;
  workOrderNo: string;
  workOrderDate: string;
  site?: { id: number; site: string } | null;
  vendor?: { id: number; vendorName: string } | null;
  amount: number;
  approvalStatus?: string;
  createdAt: string;
};

type WorkOrdersResponse = {
  data: WorkOrder[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

export default function WorkOrderBillsPage() {
  const { pushWithScrollSave } = useScrollRestoration("work-order-bills-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    vendor: "",
    sort: "workOrderDate",
    order: "desc",
  });
  const { page, perPage, search, site, vendor, sort, order } =
    (qp as unknown) as {
      page: number;
      perPage: number;
      search: string;
      site: string;
      vendor: string;
      sort: string;
      order: "asc" | "desc";
    };

  // Local filter draft state
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [vendorDraft, setVendorDraft] = useState(vendor);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setSiteDraft(site), [site]);
  useEffect(() => setVendorDraft(vendor), [vendor]);

  const filtersDirty = searchDraft !== search || siteDraft !== site || vendorDraft !== vendor;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), site: siteDraft, vendor: vendorDraft });
  }

  function resetFilters() {
    setSearchDraft("");
    setSiteDraft("");
    setVendorDraft("");
    setQp({ page: 1, search: "", site: "", vendor: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (site) sp.set("site", site);
    if (vendor) sp.set("vendor", vendor);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/work-orders?${sp.toString()}`;
  }, [page, perPage, search, site, vendor, sort, order]);

  const { data, error, isLoading } = useSWR<WorkOrdersResponse>(query, apiGet);

  if (error) {
    toast.error((error as Error).message || "Failed to load work orders");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<WorkOrder>[] = [
    { key: "workOrderNo", header: "WO No.", sortable: true },
    { key: "site", header: "Site", accessor: (r) => r.site?.site || "-" },
    { key: "vendor", header: "Vendor", accessor: (r) => r.vendor?.vendorName || "-" },
    {
      key: "amount",
      header: "Amount",
      accessor: (r) => r.amount,
      className: "text-right",
      cellClassName: "text-right",
    },
    { key: "workOrderDate", header: "WO Date", accessor: (r) => formatDate(r.workOrderDate), sortable: true },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Work Orders (Approved 2)</AppCard.Title>
        <AppCard.Description>Select a work order to add bills.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search work orders"
            placeholder="Search WO No., Quotation No., Note..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          {/* Optionally add Site/Vendor filters later */}
          <AppButton size="sm" onClick={applyFilters} disabled={!filtersDirty} className="min-w-[84px]">
            Filter
          </AppButton>
          {(search || site || vendor) && (
            <AppButton variant="secondary" size="sm" onClick={resetFilters} className="min-w-[84px]">
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={(data?.data || []).filter((wo) => wo.approvalStatus === "APPROVED_LEVEL_2")}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => (
            <div className="flex">
              <AppButton size="sm" variant="secondary" onClick={() => pushWithScrollSave(`/work-order-bills/new?workOrderId=${row.id}`)}>
                Add Bill
              </AppButton>
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
