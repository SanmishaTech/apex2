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
import { useProtectPage } from "@/hooks/use-protect-page";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type SubContractorWorkOrder = {
  id: number;
  workOrderNo: string;
  workOrderDate: string;
  site?: { id: number; site: string } | null;
  subContractor?: { id: number; name: string } | null;
  amount: number;
  approvalStatus?: string;
  status?: string;
  isApproved2?: boolean;
  createdAt: string;
};

type SubContractorWorkOrdersResponse = {
  data: SubContractorWorkOrder[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

export default function SubContractorWorkOrderBillsPage() {
  useProtectPage();
  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration("sub-contractor-work-order-bills-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    subContractor: "",
    sort: "workOrderDate",
    order: "desc",
  });
  const { page, perPage, search, site, subContractor, sort, order } =
    (qp as unknown) as {
      page: number;
      perPage: number;
      search: string;
      site: string;
      subContractor: string;
      sort: string;
      order: "asc" | "desc";
    };

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [subContractorDraft, setSubContractorDraft] = useState(subContractor);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setSiteDraft(site), [site]);
  useEffect(() => setSubContractorDraft(subContractor), [subContractor]);

  const filtersDirty = searchDraft !== search || siteDraft !== site || subContractorDraft !== subContractor;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), site: siteDraft, subContractor: subContractorDraft });
  }

  function resetFilters() {
    setSearchDraft("");
    setSiteDraft("");
    setSubContractorDraft("");
    setQp({ page: 1, search: "", site: "", subContractor: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (site) sp.set("site", site);
    if (subContractor) sp.set("subContractor", subContractor);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/sub-contractor-work-orders?${sp.toString()}`;
  }, [page, perPage, search, site, subContractor, sort, order]);

  const { data, error, isLoading } = useSWR<SubContractorWorkOrdersResponse>(query, apiGet);

  if (error) {
    toast.error((error as Error).message || "Failed to load sub contractor work orders");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<SubContractorWorkOrder>[] = [
    { key: "workOrderNo", header: "WO No.", sortable: true },
    { key: "site", header: "Site", accessor: (r) => r.site?.site || "-" },
    { key: "subContractor", header: "Sub Contractor", accessor: (r) => r.subContractor?.name || "-" },
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
        <AppCard.Title>Sub Contractor Work Orders (Approved 2)</AppCard.Title>
        <AppCard.Description>Select a work order to add bills.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search sub contractor work orders"
            placeholder="Search WO No., Quotation No., Note..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton size="sm" onClick={applyFilters} disabled={!filtersDirty} className="min-w-[84px]">
            Filter
          </AppButton>
          {(search || site || subContractor) && (
            <AppButton variant="secondary" size="sm" onClick={resetFilters} className="min-w-[84px]">
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          // show only Approved Level 2 items - accept either status string or boolean flag
          data={(data?.data || []).filter((wo) => wo.status === "APPROVED_LEVEL_2" || wo.approvalStatus === "APPROVED_LEVEL_2" || wo.isApproved2 === true)}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => (
            <div className="flex">
              {can(PERMISSIONS.CREATE_SUB_CONTRACTOR_WORK_ORDER_BILLS) && (
                <AppButton size="sm" variant="secondary" onClick={() => pushWithScrollSave(`/sub-contractor-work-order-bills/new?subContractorWorkOrderId=${row.id}`)}>
                  Add Bill
                </AppButton>
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
