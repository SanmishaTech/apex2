"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "@/lib/toast";

import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PERMISSIONS } from "@/config/roles";

import { AppButton } from "@/components/common/app-button";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { DataTable, type Column, type SortState } from "@/components/common/data-table";
import FilterBar from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { Pagination } from "@/components/common/pagination";

import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileText, Printer, Trash2 } from "lucide-react";

type SubContractorWorkOrder = {
  id: number;
  workOrderNo: string;
  workOrderDate: string;
  deliveryDate: string;
  siteId: number;
  subContractorId: number;
  createdById: number;
  approved1ById?: number | null;
  approved2ById?: number | null;
  site: {
    id: number;
    site: string;
  };
  subContractor: {
    id: number;
    name: string;
  };
  createdBy?: { id: number; name: string } | null;
  approved1By?: { id: number; name: string } | null;
  approved2By?: { id: number; name: string } | null;
  totalAmount: number;
  status: string;
  isSuspended: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type SubContractorWorkOrdersResponse = {
  data: SubContractorWorkOrder[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

export default function SubContractorWorkOrdersPage() {
  const { pushWithScrollSave } = useScrollRestoration("sub-contractor-work-orders-list");
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    subContractor: "",
    status: "",
    sort: "workOrderDate",
    order: "desc",
  });

  const { page, perPage, search, site, subContractor, status, sort, order } = qp as any;

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [subContractorDraft, setSubContractorDraft] = useState(subContractor);
  const [statusDraft, setStatusDraft] = useState(status);

  useEffect(() => {
    setSearchDraft(search);
    setSiteDraft(site);
    setSubContractorDraft(subContractor);
    setStatusDraft(status);
  }, [search, site, subContractor, status]);

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
      subContractor: subContractorDraft,
      status: statusDraft,
      page: 1,
    });
  }

  function formatDateDmy(date?: string | Date | null) {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB");
  }

  function StatusBadge({ status, suspended }: { status?: string; suspended?: boolean }) {
    const label = suspended ? "Suspended" : prettyStatus(status);
    const cls = suspended
      ? "bg-rose-600"
      : status === "APPROVED_LEVEL_1"
        ? "bg-amber-600"
        : status === "APPROVED_LEVEL_2"
          ? "bg-sky-600"
          : status === "COMPLETED"
            ? "bg-emerald-600"
            : "bg-slate-600";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}>
        {label}
      </span>
    );
  }

  function prettyStatus(s?: string) {
    switch (s) {
      case "APPROVED_LEVEL_1": return "Approved 1";
      case "APPROVED_LEVEL_2": return "Approved 2";
      case "COMPLETED": return "Completed";
      case "SUSPENDED": return "Suspended";
      default: return "Draft";
    }
  }

  function UserBadge({ name, className }: { name?: string | null; className: string }) {
    if (!name) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${className}`}>
        {name}
      </span>
    );
  }

  const { data, isLoading, mutate } = useSWR<SubContractorWorkOrdersResponse>(
    `/api/sub-contractor-work-orders?${new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      search,
      site,
      subContractor,
      status,
      sort,
      order,
    })}`,
    apiGet
  );

  const { data: sitesData } = useSWR<{ data: any[] }>("/api/sites?perPage=1000", apiGet);
  const sites = sitesData?.data || [];

  const { data: subContractorsData } = useSWR<{ data: any[] }>("/api/sub-contractors?perPage=1000", apiGet);
  const subContractors = subContractorsData?.data || [];

  const columns: Column<SubContractorWorkOrder>[] = [
    {
      key: "workOrderNo",
      header: "WO No.",
      sortable: true,
      accessor: (row) => <div className="font-medium">{row.workOrderNo}</div>,
    },
    {
      key: "workOrderDate",
      header: "Date",
      sortable: true,
      accessor: (row) => formatDateDmy(row.workOrderDate),
    },
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site?.site || "—",
    },
    // removed SubContractor column per UI request
    {
      key: "totalAmount",
      header: "Amount",
      className: "text-right",
      cellClassName: "text-right",
      accessor: (row) => (row.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} suspended={row.isSuspended} />,
    },
    {
      key: "createdBy",
      header: "Created By",
      accessor: (row) => <UserBadge name={row.createdBy?.name} className="bg-sky-600" />,
    },
    {
      key: "approved1By",
      header: "Approved 1 By",
      accessor: (row) => <UserBadge name={row.approved1By?.name} className="bg-amber-600" />,
    },
    {
      key: "approved2By",
      header: "Approved 2 By",
      accessor: (row) => <UserBadge name={row.approved2By?.name} className="bg-emerald-600" />,
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      accessor: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => pushWithScrollSave(`/sub-contractor-work-orders/${row.id}`)}>
              <FileText className="mr-2 h-4 w-4" /> View / Edit
            </DropdownMenuItem>
            {can(PERMISSIONS.DELETE_SUB_CONTRACTOR_WORK_ORDERS) && row.status === "DRAFT" && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this work order?")) {
                    try {
                      await apiDelete(`/api/sub-contractor-work-orders/${row.id}`);
                      toast.success("Work order deleted");
                      mutate();
                    } catch (e) {
                      toast.error("Failed to delete");
                    }
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">SubContractor Work Orders</h1>
        <div className="flex items-center gap-2">
          {can(PERMISSIONS.CREATE_SUB_CONTRACTOR_WORK_ORDERS) && (
            <AppCard.Action>
              <AppButton size="sm" iconName="Plus" onClick={() => pushWithScrollSave("/sub-contractor-work-orders/new")}>
                Add Work Order
              </AppButton>
            </AppCard.Action>
          )}
        </div>
      </div>

      <AppCard>
        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <NonFormTextInput
                label="Search"
                placeholder="WO No, Note..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <NonFormTextInput
                label="Site"
                placeholder="Search site..."
                value={siteDraft}
                onChange={(e) => setSiteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <NonFormTextInput
                label="SubContractor"
                placeholder="Search subcontractor..."
                value={subContractorDraft}
                onChange={(e) => setSubContractorDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <div className="flex items-end gap-2">
                <AppButton className="flex-1" onClick={applyFilters}>Filter</AppButton>
                <AppButton
                  variant="outline"
                  className="text-black dark:text-white"
                  onClick={() => {
                    setSearchDraft("");
                    setSiteDraft("");
                    setSubContractorDraft("");
                    setStatusDraft("");
                    setQp({ search: "", site: "", subContractor: "", status: "", page: 1 });
                  }}
                >
                  Reset
                </AppButton>
              </div>
            </div>
          </FilterBar>
        </AppCard.Content>
      </AppCard>

      <AppCard>
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={{ field: sort, order }}
          onSortChange={(next) => setQp({ sort: next.field, order: next.order })}
        />
        <div className="p-4 border-t">
          <Pagination
            page={page}
            totalPages={data?.meta?.totalPages || 1}
            onPageChange={(p) => setQp({ page: p })}
          />
        </div>
      </AppCard>
    </div>
  );
}
