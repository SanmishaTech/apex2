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
import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Column, type SortState } from "@/components/common/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate } from "@/lib/utils";

type SalesInvoice = {
  id: number;
  invoiceNumber: string;
  revision: string;
  invoiceDate: string;
  fromDate: string;
  toDate: string;
  siteId: number;
  boqId: number;
  billingAddressId: number;
  grossAmount: number;
  tds: number;
  wct: number;
  lwf: number;
  other: number;
  totalAmount: number;
  authorizedById?: number | null;
  createdById: number;
  site: {
    id: number;
    site: string;
  };
  boq: {
    id: number;
    workName: string;
    boqNo: string;
  };
  billingAddress: {
    id: number;
    companyName: string;
  };
  authorizedBy?: { id: number; name: string } | null;
  createdBy?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

type SalesInvoicesResponse = {
  data: SalesInvoice[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

type SitesResponse = {
  data: Array<{ id: number; site: string }>;
};

type BoqsResponse = {
  data: Array<{ id: number; workName: string }>;
};

export default function SalesInvoicesPage() {
  const { pushWithScrollSave } = useScrollRestoration("sales-invoices-list");
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    boq: "",
    authorized: "",
    sort: "invoiceDate",
    order: "desc",
  });
  const { page, perPage, search, site, boq, authorized, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      site: string;
      boq: string;
      authorized: string;
      sort: string;
      order: "asc" | "desc";
    };

  // Local filter draft state
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [boqDraft, setBoqDraft] = useState(boq);
  const [authorizedDraft, setAuthorizedDraft] = useState(authorized);

  // Sync drafts when query params change externally
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setSiteDraft(site);
  }, [site]);

  useEffect(() => {
    setBoqDraft(boq);
  }, [boq]);

  useEffect(() => {
    setAuthorizedDraft(authorized);
  }, [authorized]);

  const filtersDirty =
    searchDraft !== search ||
    siteDraft !== site ||
    boqDraft !== boq ||
    authorizedDraft !== authorized;

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
      boq: boqDraft,
      authorized: authorizedDraft,
      page: 1,
    });
  }

  function formatDateDmy(date?: string | Date | null) {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB");
  }

  function AuthorizationBadge({
    authorizedById,
  }: {
    authorizedById?: number | null;
  }) {
    const isAuthorized = authorizedById !== null && authorizedById !== undefined;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${
          isAuthorized ? "bg-emerald-600" : "bg-amber-600"
        }`}
      >
        {isAuthorized ? "Authorized" : "Draft"}
      </span>
    );
  }

  function UserBadge({
    name,
    className,
  }: {
    name?: string | null;
    className: string;
  }) {
    if (!name) return <span className="text-muted-foreground">—</span>;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${className}`}
      >
        {name}
      </span>
    );
  }

  // Fetch sales invoices
  const { data, isLoading, mutate } = useSWR<SalesInvoicesResponse>(
    `/api/sales-invoices?${new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      search: search,
      site: site,
      boq: boq,
      authorized: authorized,
      sort: sort,
      order: order,
    })}`,
    apiGet
  );

  // Refetch list when logged-in user changes
  useEffect(() => {
    mutate();
  }, [user?.id, mutate]);

  // Fetch sites for filter
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=1000",
    apiGet
  );
  const sites = sitesData?.data || [];

  // Fetch BOQs for filter
  const { data: boqsData } = useSWR<BoqsResponse>(
    "/api/boqs?perPage=1000",
    apiGet
  );
  const boqs = boqsData?.data || [];

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null);
  const [statusAction, setStatusAction] = useState<{
    action: string;
    invoice: SalesInvoice | null;
  }>({ action: "", invoice: null });
  const [remarks, setRemarks] = useState("");

  const handleDeleteClick = (invoice: SalesInvoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  const openStatusAction = (
    id: number,
    key: "authorize" | "unauthorize"
  ) => {
    setStatusAction({
      action: key,
      invoice: data?.data.find((i) => i.id === id) || null,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    try {
      await apiDelete(`/api/sales-invoices/${invoiceToDelete.id}`);
      toast.success("Sales invoice deleted successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to delete sales invoice");
    } finally {
      setShowDeleteConfirm(false);
      setInvoiceToDelete(null);
    }
  };

  const handleStatusAction = async () => {
    if (!statusAction.invoice) return;

    try {
      await apiPatch(`/api/sales-invoices/${statusAction.invoice.id}`, {
        statusAction: statusAction.action,
      });

      toast.success(`Sales invoice ${statusAction.action}d successfully`);
      mutate();
    } catch (error) {
      toast.error(`Failed to ${statusAction.action} sales invoice`);
    } finally {
      setStatusAction({ action: "", invoice: null });
      setRemarks("");
    }
  };

  const handlePrint = useCallback(
    async (invoice: SalesInvoice) => {
      try {
        const res = await fetch(`/api/sales-invoices/${invoice.id}/print`);
        if (!res.ok) {
          throw new Error("Failed to download sales invoice PDF");
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sales-invoice-${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(error);
        toast.error("Failed to download sales invoice PDF");
      }
    },
    [toast]
  );

  const columns: Column<SalesInvoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice No.",
      sortable: true,
      accessor: (row) => (
        <div className="font-medium">
          <div>{row.invoiceNumber}</div>
          <div className="text-xs text-muted-foreground">Rev: {row.revision}</div>
        </div>
      ),
    },
    {
      key: "invoiceDate",
      header: "Invoice Date",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (row) => formatDateDmy(row.invoiceDate),
    },
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site?.site || "-",
    },
    {
      key: "boq",
      header: "BOQ",
      accessor: (row) => row.boq?.boqNo || row.boq?.workName || "-",
    },
    {
      key: "totalAmount",
      header: "Total Amount",
      className: "text-right",
      cellClassName: "text-right",
      accessor: (row) => row.totalAmount || 0,
    },
    {
      key: "authorizedById",
      header: "Status",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      accessor: (row) => <AuthorizationBadge authorizedById={row.authorizedById} />,
    },
    {
      key: "createdBy",
      header: "Created By",
      sortable: false,
      accessor: (row) => (
        <UserBadge name={row.createdBy?.name ?? null} className="bg-sky-600" />
      ),
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "authorizedBy",
      header: "Authorized By",
      sortable: false,
      accessor: (row) => (
        <UserBadge
          name={row.authorizedBy?.name ?? null}
          className="bg-emerald-600"
        />
      ),
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
  ];

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const sortState: SortState = { field: sort, order };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales Invoices</h1>

        <div className="flex items-center gap-2">
          {can(PERMISSIONS.CREATE_SALES_INVOICES) && (
            <AppCard.Action>
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/sales-invoices/new")}
              >
                Add
              </AppButton>
            </AppCard.Action>
          )}
        </div>
      </div>

      <AppCard>
        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <div className="col-span-full grid grid-cols-5 gap-3 items-start">
              <div className="flex flex-col gap-2 min-w-0">
                <NonFormTextInput
                  label="Search"
                  placeholder="Invoice No., Site, BOQ..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                  containerClassName="min-w-0"
                />
                {(search || site || boq || authorized) && (
                  <AppButton
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      setSiteDraft("");
                      setBoqDraft("");
                      setAuthorizedDraft("");
                      setQp({
                        search: "",
                        site: "",
                        boq: "",
                        authorized: "",
                        page: 1,
                      });
                    }}
                    className="h-9 w-full"
                  >
                    Reset
                  </AppButton>
                )}
              </div>
              <AppSelect
                label="Site"
                value={siteDraft || "__none"}
                onValueChange={(v) => setSiteDraft(v === "__none" ? "" : v)}
                placeholder="All Sites"
                triggerClassName="h-9"
                className="min-w-0"
              >
                <AppSelect.Item value="__none">All Sites</AppSelect.Item>
                {sites.map((s) => (
                  <AppSelect.Item key={s.id} value={s.id.toString()}>
                    {s.site}
                  </AppSelect.Item>
                ))}
              </AppSelect>
              <AppSelect
                label="BOQ"
                value={boqDraft || "__none"}
                onValueChange={(v) => setBoqDraft(v === "__none" ? "" : v)}
                placeholder="All BOQs"
                triggerClassName="h-9"
                className="min-w-0"
              >
                <AppSelect.Item value="__none">All BOQs</AppSelect.Item>
                {boqs.map((b) => (
                  <AppSelect.Item key={b.id} value={b.id.toString()}>
                    {b.workName}
                  </AppSelect.Item>
                ))}
              </AppSelect>
              <AppSelect
                label="Status"
                value={authorizedDraft || "__none"}
                onValueChange={(v) => setAuthorizedDraft(v === "__none" ? "" : v)}
                placeholder="All"
                triggerClassName="h-9"
                className="min-w-0"
              >
                <AppSelect.Item value="__none">All</AppSelect.Item>
                <AppSelect.Item value="true">Authorized</AppSelect.Item>
                <AppSelect.Item value="false">Draft</AppSelect.Item>
              </AppSelect>
              <AppButton
                type="button"
                onClick={applyFilters}
                disabled={!filtersDirty}
                className="mt-5 h-9 w-full"
              >
                Filter
              </AppButton>
            </div>
          </FilterBar>

          <div className="mt-6">
            <DataTable
              columns={columns}
              data={data?.data || []}
              loading={isLoading}
              sort={sortState}
              onSortChange={(s) => toggleSort(s.field)}
              stickyColumns={1}
              minTableWidth={1200}
              renderRowActions={(invoice) => {
                const isAuthorized = invoice.authorizedById !== null && invoice.authorizedById !== undefined;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <AppButton size="sm" variant="secondary">
                        Actions
                      </AppButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          pushWithScrollSave(`/sales-invoices/${invoice.id}/view`)
                        }
                      >
                        View
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handlePrint(invoice)}>
                        Print
                      </DropdownMenuItem>

                      {!isAuthorized && (
                        <>
                          {can(PERMISSIONS.EDIT_SALES_INVOICES) && (
                            <DropdownMenuItem
                              onSelect={() =>
                                pushWithScrollSave(`/sales-invoices/${invoice.id}/edit`)
                              }
                            >
                              Edit
                            </DropdownMenuItem>
                          )}

                          {can(PERMISSIONS.DELETE_SALES_INVOICES) && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(invoice)}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </>
                      )}

                      {!isAuthorized && can(PERMISSIONS.AUTHORIZE_SALES_INVOICES) && (
                        <DropdownMenuItem
                          onSelect={() =>
                            pushWithScrollSave(`/sales-invoices/${invoice.id}/authorize`)
                          }
                        >
                          Authorize
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }}
            />

            <div className="mt-4">
              <Pagination
                page={data?.meta?.page || page}
                totalPages={data?.meta?.totalPages || 1}
                perPage={data?.meta?.perPage || perPage}
                onPerPageChange={(val) => setQp({ perPage: val, page: 1 })}
                onPageChange={(p) => setQp({ page: p })}
                showPageNumbers
                disabled={isLoading}
              />
            </div>
          </div>
        </AppCard.Content>
      </AppCard>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(false);
        }}
        title="Delete Sales Invoice"
        description={`Are you sure you want to delete sales invoice ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
      />

      <Dialog
        open={!!statusAction.invoice}
        onOpenChange={(open) => {
          if (!open) setStatusAction({ action: "", invoice: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction.action === "authorize" && "Authorize Sales Invoice"}
              {statusAction.action === "unauthorize" && "Unauthorize Sales Invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p>
                Are you sure you want to {statusAction.action} sales invoice{" "}
                <strong>{statusAction.invoice?.invoiceNumber}</strong>?
              </p>
              {statusAction.action === "authorize" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Warning: Once authorized, the invoice cannot be edited.
                  </p>
                </div>
              )}
              {statusAction.action === "unauthorize" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Warning: This will revert the invoice to draft status.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusAction({ action: "", invoice: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusAction}>
              {statusAction.action === "authorize" && "Authorize"}
              {statusAction.action === "unauthorize" && "Unauthorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
