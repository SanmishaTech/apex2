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
import { MoreHorizontal, FileText, Printer, Trash2, CheckCircle, DollarSign } from "lucide-react";

type SubContractorInvoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  siteId: number;
  site: {
    id: number;
    site: string;
  };
  subcontractorWorkOrder: {
    id: number;
    workOrderNo: string;
    subContractor: {
      id: number;
      name: string;
    };
  };
  grossAmount: number;
  netPayable: number;
  status: "PENDING" | "APPROVED" | "PAID";
  isAuthorized: boolean;
  createdById: number;
  createdBy?: { id: number; name: string };
  authorizedById?: number;
  authorizedBy?: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
  _count?: {
    subContractorInvoiceDetails: number;
  };
};

type SubContractorInvoicesResponse = {
  data: SubContractorInvoice[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function SubContractorInvoicesPage() {
  const { pushWithScrollSave } = useScrollRestoration("sub-contractor-invoices-list");
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    status: "",
    sort: "invoiceDate",
    order: "desc",
  });

  const { page, perPage, search, site, status, sort, order } = qp as any;

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [statusDraft, setStatusDraft] = useState(status);

  useEffect(() => {
    setSearchDraft(search);
    setSiteDraft(site);
    setStatusDraft(status);
  }, [search, site, status]);

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
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

  function StatusBadge({ status, isAuthorized }: { status: string; isAuthorized: boolean }) {
    const label = status === "PENDING" ? "Pending" : "Paid";
    const cls = status === "PAID" ? "bg-emerald-600" : "bg-amber-600";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}>
        {label}
      </span>
    );
  }

  function UserBadge({ name, className }: { name?: string | null; className: string }) {
    if (!name) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${className}`}>
        {name}
      </span>
    );
  }

  const { data, isLoading, mutate } = useSWR<SubContractorInvoicesResponse>(
    `/api/sub-contractor-invoices?${new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      search,
      site,
      status,
      sort,
      order,
    })}`,
    apiGet
  );

  const { data: sitesData } = useSWR<{ data: any[] }>("/api/sites?perPage=1000", apiGet);
  const sites = sitesData?.data || [];

  const handleAuthorize = async (id: number) => {
    if (!confirm("Are you sure you want to authorize this invoice?")) return;
    try {
      await apiPatch(`/api/sub-contractor-invoices/${id}`, { statusAction: "authorize" });
      toast.success("Invoice authorized successfully");
      mutate();
    } catch (e: any) {
      toast.error(e.message || "Failed to authorize invoice");
    }
  };

  const handleMarkPaid = async (id: number) => {
    if (!confirm("Are you sure you want to mark this invoice as paid?")) return;
    try {
      await apiPatch(`/api/sub-contractor-invoices/${id}`, { statusAction: "markPaid" });
      toast.success("Invoice marked as paid");
      mutate();
    } catch (e: any) {
      toast.error(e.message || "Failed to mark invoice as paid");
    }
  };

  const columns: Column<SubContractorInvoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice No.",
      sortable: true,
      accessor: (row) => <div className="font-medium">{row.invoiceNumber}</div>,
    },
    {
      key: "invoiceDate",
      header: "Date",
      sortable: true,
      accessor: (row) => formatDateDmy(row.invoiceDate),
    },
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site?.site || "—",
    },
    {
      key: "subContractor",
      header: "Sub Contractor",
      accessor: (row) => row.subcontractorWorkOrder?.subContractor?.name || "—",
    },
    {
      key: "workOrderNo",
      header: "WO No.",
      accessor: (row) => row.subcontractorWorkOrder?.workOrderNo || "—",
    },
    {
      key: "grossAmount",
      header: "Gross Amount",
      className: "text-right",
      cellClassName: "text-right",
      accessor: (row) => (row.grossAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    },
    {
      key: "netPayable",
      header: "Net Payable",
      className: "text-right",
      cellClassName: "text-right",
      accessor: (row) => (row.netPayable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} isAuthorized={row.isAuthorized} />,
    },
    {
      key: "createdBy",
      header: "Created By",
      accessor: (row) => <UserBadge name={row.createdBy?.name} className="bg-sky-600" />,
    },
    {
      key: "authorizedBy",
      header: "Authorized By",
      accessor: (row) => <UserBadge name={row.authorizedBy?.name} className="bg-pink-700" />,
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
            <DropdownMenuItem onClick={() => pushWithScrollSave(`/sub-contractor-invoices/${row.id}/view`)}>
              <FileText className="mr-2 h-4 w-4" /> View
            </DropdownMenuItem>

            {/* Always show Edit unless authorized */}
            {!row.isAuthorized && can(PERMISSIONS.EDIT_SUB_CONTRACTOR_INVOICES) && (
              <DropdownMenuItem onClick={() => pushWithScrollSave(`/sub-contractor-invoices/${row.id}`)}>
                <FileText className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}

            {/* Authorize action - Navigate to authorize page */}
            {can(PERMISSIONS.AUTHORIZE_SUB_CONTRACTOR_INVOICES) &&
              !row.isAuthorized &&
              row.createdById !== user?.id && (
                <DropdownMenuItem onClick={() => pushWithScrollSave(`/sub-contractor-invoices/${row.id}/authorize`)}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Authorize
                </DropdownMenuItem>
              )}

            {/* Mark as Paid action - for authorized pending invoices */}
            {can(PERMISSIONS.EDIT_SUB_CONTRACTOR_INVOICES) &&
              row.status === "PENDING" &&
              row.isAuthorized &&
              row.authorizedById !== user?.id && (
                <DropdownMenuItem onClick={() => handleMarkPaid(row.id)}>
                  <DollarSign className="mr-2 h-4 w-4" /> Mark as Paid
                </DropdownMenuItem>
              )}

            {/* Print action */}
            {can(PERMISSIONS.PRINT_SUB_CONTRACTOR_INVOICES) && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/sub-contractor-invoices/${row.id}/print`);
                    if (!res.ok) throw new Error("Failed to download PDF");
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `sub-contractor-invoice-${row.invoiceNumber || row.id}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error(e);
                    toast.error("Failed to download PDF");
                  }
                }}
              >
                <Printer className="mr-2 h-4 w-4" /> Print
              </DropdownMenuItem>
            )}

            {/* Delete action - only for non-authorized invoices */}
            {can(PERMISSIONS.DELETE_SUB_CONTRACTOR_INVOICES) &&
              !row.isAuthorized && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={async () => {
                    if (confirm("Are you sure you want to delete this invoice?")) {
                      try {
                        await apiDelete(`/api/sub-contractor-invoices/${row.id}`);
                        toast.success("Invoice deleted");
                        mutate();
                      } catch (e: any) {
                        toast.error(e.message || "Failed to delete");
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
        <h1 className="text-2xl font-bold">Sub Contractor Invoices</h1>
        <div className="flex items-center gap-2">
          {can(PERMISSIONS.CREATE_SUB_CONTRACTOR_INVOICES) && (
            <AppCard.Action>
              <AppButton size="sm" iconName="Plus" onClick={() => pushWithScrollSave("/sub-contractor-invoices/new")}>
                Add Invoice
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
                placeholder="Invoice No, WO No..."
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
              <AppSelect
                label="Status"
                value={statusDraft || "__none"}
                onValueChange={(v) => setStatusDraft(v === "__none" ? "" : v)}
                placeholder="All Statuses"
              >
                <AppSelect.Item value="__none">All Statuses</AppSelect.Item>
                <AppSelect.Item value="PENDING">Pending</AppSelect.Item>
                <AppSelect.Item value="PAID">Paid</AppSelect.Item>
              </AppSelect>
              <div className="flex items-end gap-2">
                <AppButton className="flex-1" onClick={applyFilters}>Filter</AppButton>
                <AppButton
                  variant="outline"
                  className="text-black dark:text-white"
                  onClick={() => {
                    setSearchDraft("");
                    setSiteDraft("");
                    setStatusDraft("");
                    setQp({ search: "", site: "", status: "", page: 1 });
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
          data={(data?.data || [])}
          loading={isLoading}
          sort={{ field: sort, order }}
          onSortChange={(next) => setQp({ sort: next.field, order: next.order })}
        />
        <div className="p-4 border-t">
          <Pagination
            page={data?.page || page}
            perPage={data?.perPage || perPage}
            totalPages={data?.totalPages || 1}
            onPageChange={(p) => setQp({ page: p })}
            onPerPageChange={(pp) => setQp({ perPage: pp, page: 1 })}
            showPageNumbers
          />
        </div>
      </AppCard>
    </div>
  );
}
