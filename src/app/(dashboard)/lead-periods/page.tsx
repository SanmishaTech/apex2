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
import { AppCombobox } from "@/components/common/app-combobox";
import { DataTable, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { useProtectPage } from "@/hooks/use-protect-page";
import { PERMISSIONS } from "@/config/roles";
import { formatDateDMY } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useRouter } from "next/navigation";
import { Edit, Plus } from "lucide-react";

interface LeadPeriod {
  id: number;
  siteId: number;
  itemId: number;
  period: number;
  site: { site: string };
  item: { item: string; itemCode: string };
  createdAt: string;
}

interface LeadPeriodsResponse {
  data: LeadPeriod[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export default function LeadPeriodsPage() {
  useProtectPage();
  const router = useRouter();
  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration("lead-periods-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    siteId: "",
    search: "",
  });

  const { page, perPage, siteId, search } = qp;
  const [siteIdDraft, setSiteIdDraft] = useState(siteId);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    setSiteIdDraft(siteId);
    setSearchDraft(search);
  }, [siteId, search]);

  const { data: sitesData } = useSWR<{ data: any[] }>("/api/sites?perPage=1000", apiGet);
  const sitesOptions = useMemo(() => {
    const opts = (sitesData?.data || []).map(s => ({ value: s.id.toString(), label: s.site }));
    return [{ value: "all", label: "All Sites" }, ...opts];
  }, [sitesData]);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (siteId && siteId !== "all") sp.set("siteId", siteId);
    if (search) sp.set("search", search);
    return `/api/lead-periods?${sp.toString()}`;
  }, [page, perPage, siteId, search]);

  const { data, isLoading, mutate } = useSWR<LeadPeriodsResponse>(
    can(PERMISSIONS.VIEW_LEAD_PERIODS) ? query : null, 
    apiGet
  );

  function applyFilters() {
    setQp({ page: 1, siteId: siteIdDraft, search: searchDraft });
  }

  function resetFilters() {
    setSiteIdDraft("");
    setSearchDraft("");
    setQp({ page: 1, siteId: "", search: "" });
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/lead-periods/${id}`);
      toast.success("Lead period deleted");
      mutate();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  const columns: Column<any>[] = [
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site?.site,
    },
    {
      key: "itemsCount",
      header: "Items Count",
      accessor: (row) => row._count?.leadPeriodDetails || 0,
    },
    {
      key: "updatedAt",
      header: "Last Updated",
      accessor: (row) => formatDateDMY(row.updatedAt),
    },
  ];

  if (!can(PERMISSIONS.VIEW_LEAD_PERIODS)) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Periods</h1>
          <p className="text-muted-foreground">Manage item lead times by site.</p>
        </div>
        {can(PERMISSIONS.CREATE_LEAD_PERIODS) && (
          <AppButton onClick={() => pushWithScrollSave("/lead-periods/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead Period
          </AppButton>
        )}
      </div>

      <AppCard>
        <AppCard.Header className="pb-3">
          <FilterBar title="Search & Filter">
            <div className="col-span-full grid grid-cols-4 gap-3 items-end">
              <div className="col-span-2 md:col-span-1">
                <label className="text-sm font-medium mb-1.5 block">Site</label>
                <AppCombobox
                  value={siteIdDraft || "all"}
                  onValueChange={setSiteIdDraft}
                  options={sitesOptions}
                  placeholder="Select site"
                  searchPlaceholder="Search site..."
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <NonFormTextInput
                  label="Search Item"
                  placeholder="Item name or code..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  containerClassName="min-w-0"
                />
              </div>
              <AppButton 
                size="sm" 
                onClick={applyFilters} 
                isLoading={isLoading}
                disabled={siteIdDraft === siteId && searchDraft === search}
              >
                Filter
              </AppButton>
              <AppButton 
                size="sm" 
                variant="secondary" 
                onClick={resetFilters} 
                disabled={!siteIdDraft && !searchDraft}
              >
                Reset
              </AppButton>
            </div>
          </FilterBar>
        </AppCard.Header>
        <AppCard.Content>
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={isLoading}
            emptyMessage="No lead periods found."
            renderRowActions={(row) => (
              <div className="flex items-center gap-2">
                {can(PERMISSIONS.EDIT_LEAD_PERIODS) && (
                  <AppButton
                    variant="ghost"
                    size="icon"
                    onClick={() => pushWithScrollSave(`/lead-periods/${row.id}/edit`)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </AppButton>
                )}
                {can(PERMISSIONS.DELETE_LEAD_PERIODS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="lead period"
                    className="h-8 w-8"
                  />
                )}
              </div>
            )}
          />
        </AppCard.Content>
        <AppCard.Footer className="flex justify-end py-4">
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
    </div>
  );
}
