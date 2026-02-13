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

type PurchaseOrder = {
  id: number;
  purchaseOrderNo: string;
  purchaseOrderDate: string;
  deliveryDate: string;
  siteId: number;
  vendorId: number;
  createdById: number;
  approved1ById?: number | null;
  approved2ById?: number | null;
  poStatus?: "ORDER_PLACED" | "IN_TRANSIT" | "RECEIVED" | "HOLD" | "OPEN" | null;
  site: {
    id: number;
    site: string;
  };
  vendor: {
    id: number;
    vendorName: string;
  };
  createdBy?: { id: number; name: string } | null;
  approved1By?: { id: number; name: string } | null;
  approved2By?: { id: number; name: string } | null;
  amount: number;
  approvalStatus: string;
  isSuspended: boolean;
  isComplete: boolean;
  remarks?: string;
  billStatus?: string;
  createdAt: string;
  updatedAt: string;
};

type PurchaseOrdersResponse = {
  data: PurchaseOrder[];
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

type VendorsResponse = {
  data: Array<{ id: number; vendorName: string }>;
};

export default function PurchaseOrdersPage() {
  const { pushWithScrollSave } = useScrollRestoration("purchase-orders-list");
  const { can } = usePermissions();
  const { user } = useCurrentUser();
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    vendor: "",
    sort: "purchaseOrderDate",
    order: "desc",
  });
  const { page, perPage, search, site, vendor, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      site: string;
      vendor: string;
      sort: string;
      order: "asc" | "desc";
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);
  const [vendorDraft, setVendorDraft] = useState(vendor);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setSiteDraft(site);
  }, [site]);

  useEffect(() => {
    setVendorDraft(vendor);
  }, [vendor]);

  const filtersDirty =
    searchDraft !== search || siteDraft !== site || vendorDraft !== vendor;

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
      vendor: vendorDraft,
      page: 1, // Reset to first page when filters change
    });
  }

  function formatDateDmy(date?: string | Date | null) {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB");
  }

  function IndentLikeStatusBadge({
    status,
    suspended,
  }: {
    status?: string;
    suspended?: boolean;
  }) {
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
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
      >
        {label}
      </span>
    );
  }

  function prettyStatus(s?: string) {
    switch (s) {
      case "APPROVED_LEVEL_1":
        return "Approved 1";
      case "APPROVED_LEVEL_2":
        return "Approved 2";
      case "COMPLETED":
        return "Completed";
      case "SUSPENDED":
        return "Suspended";
      default:
        return "Draft";
    }
  }

  function prettyPOStatus(s?: string | null) {
    switch ((s || "OPEN").toUpperCase()) {
      case "ORDER_PLACED":
        return "Order Placed";
      case "IN_TRANSIT":
        return "In Transit";
      case "RECEIVED":
        return "Received";
      case "HOLD":
        return "Hold";
      default:
        return "Open";
    }
  }

  function POStatusBadge({ status }: { status?: string | null }) {
    const value = (status || "OPEN").toUpperCase();
    const cls =
      value === "HOLD"
        ? "bg-rose-600"
        : value === "RECEIVED"
          ? "bg-emerald-600"
          : value === "IN_TRANSIT"
            ? "bg-sky-600"
            : value === "ORDER_PLACED"
              ? "bg-amber-600"
              : "bg-slate-600";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${cls}`}
      >
        {prettyPOStatus(value)}
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

  function getAvailableActions(
    s?: string,
    isSuspended?: boolean,
    isCreator?: boolean,
    isL1Approver?: boolean
  ): Array<{
    key: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend";
    label: string;
  }> {
    const baseActions: Array<{
      key: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend";
      label: string;
    }> = [];

    switch (s) {
      case "DRAFT":
      case "":
      case undefined:
        if (can(PERMISSIONS.APPROVE_PURCHASE_ORDERS_L1) && !isCreator) {
          baseActions.push({ key: "approve1", label: "Approve 1" });
        }
        if (can(PERMISSIONS.SUSPEND_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_1":
        if (
          can(PERMISSIONS.APPROVE_PURCHASE_ORDERS_L2) &&
          !isCreator &&
          !isL1Approver
        ) {
          baseActions.push({ key: "approve2", label: "Approve 2" });
        }
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_2":
        if (can(PERMISSIONS.COMPLETE_PURCHASE_ORDERS)) {
          baseActions.push({ key: "complete", label: "Complete" });
        }
        if (can(PERMISSIONS.SUSPEND_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "SUSPENDED":
        return [];

      case "COMPLETED":
      default:
        return [];
    }

    return baseActions;
  }

  // Fetch purchase orders
  const { data, isLoading, mutate } = useSWR<PurchaseOrdersResponse>(
    `/api/purchase-orders?${new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      search: search,
      site: site,
      vendor: vendor,
      sort: sort,
      order: order,
    })}`,
    apiGet
  );

  // Refetch list when logged-in user changes so creator/approver gating updates immediately
  useEffect(() => {
    mutate();
  }, [user?.id, mutate]);

  // Fetch sites for filter
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=1000",
    apiGet
  );
  const sites = sitesData?.data || [];

  // Fetch vendors for filter
  const { data: vendorsData } = useSWR<VendorsResponse>(
    "/api/vendors?perPage=1000",
    apiGet
  );
  const vendors = vendorsData?.data || [];

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [statusAction, setStatusAction] = useState<{
    action: string;
    po: PurchaseOrder | null;
  }>({ action: "", po: null });
  const [remarks, setRemarks] = useState("");
  const [showRemarkDialog, setShowRemarkDialog] = useState(false);
  const [poForRemark, setPoForRemark] = useState<PurchaseOrder | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [showBillStatusDialog, setShowBillStatusDialog] = useState(false);
  const [poForBillStatus, setPoForBillStatus] = useState<PurchaseOrder | null>(
    null
  );
  const [billStatusText, setBillStatusText] = useState("");

  const [showUpdateStatusDialog, setShowUpdateStatusDialog] = useState(false);
  const [poForUpdateStatus, setPoForUpdateStatus] = useState<PurchaseOrder | null>(
    null
  );
  const [poStatusDraft, setPoStatusDraft] = useState<
    "OPEN" | "ORDER_PLACED" | "IN_TRANSIT" | "RECEIVED" | "HOLD"
  >("OPEN");

  const openApproval = (
    id: number,
    key: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend"
  ) => {
    // Navigate to approval page for approve1 and approve2
    if (key === "approve1") {
      pushWithScrollSave(`/purchase-orders/${id}/approve1`);
      return;
    }
    if (key === "approve2") {
      pushWithScrollSave(`/purchase-orders/${id}/approve2`);
      return;
    }
    // For other actions, show the dialog
    setStatusAction({
      action: key,
      po: data?.data.find((p) => p.id === id) || null,
    });
  };

  const handleDeleteClick = (po: PurchaseOrder) => {
    setPoToDelete(po);
    setShowDeleteConfirm(true);
  };

  const handleRemarkClick = (po: PurchaseOrder) => {
    setPoForRemark(po);
    setRemarkText(po.remarks || "");
    setShowRemarkDialog(true);
  };

  const handleBillStatusClick = (po: PurchaseOrder) => {
    setPoForBillStatus(po);
    setBillStatusText(po.billStatus || "");
    setShowBillStatusDialog(true);
  };

  const handleUpdateStatusClick = (po: PurchaseOrder) => {
    setPoForUpdateStatus(po);
    setPoStatusDraft((po.poStatus || "OPEN") as any);
    setShowUpdateStatusDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!poToDelete) return;

    try {
      await apiDelete(`/api/purchase-orders/${poToDelete.id}`);
      toast.success("Purchase order deleted successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to delete purchase order");
    } finally {
      setShowDeleteConfirm(false);
      setPoToDelete(null);
    }
  };

  const handleUpdateStatusSubmit = async () => {
    if (!poForUpdateStatus) return;

    try {
      await apiPatch(`/api/purchase-orders/${poForUpdateStatus.id}`, {
        poStatus: poStatusDraft,
      });

      toast.success("PO status updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update PO status");
    } finally {
      setShowUpdateStatusDialog(false);
      setPoForUpdateStatus(null);
      setPoStatusDraft("OPEN");
    }
  };

  const handleStatusAction = async () => {
    if (!statusAction.po) return;

    try {
      await apiPatch(`/api/purchase-orders/${statusAction.po.id}`, {
        statusAction: statusAction.action,
        remarks: remarks,
      });

      toast.success("Purchase order updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update purchase order");
    } finally {
      setStatusAction({ action: "", po: null });
      setRemarks("");
    }
  };

  const handleRemarkSubmit = async () => {
    if (!poForRemark) return;

    try {
      await apiPatch(`/api/purchase-orders/${poForRemark.id}`, {
        remarks: remarkText,
      });

      toast.success("Remark updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update remark");
    } finally {
      setShowRemarkDialog(false);
      setPoForRemark(null);
      setRemarkText("");
    }
  };

  const handleBillStatusSubmit = async () => {
    if (!poForBillStatus) return;

    try {
      await apiPatch(`/api/purchase-orders/${poForBillStatus.id}`, {
        billStatus: billStatusText,
      });

      toast.success("Bill status updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update bill status");
    } finally {
      setShowBillStatusDialog(false);
      setPoForBillStatus(null);
      setBillStatusText("");
    }
  };

  const handlePrint = useCallback(
    async (po: PurchaseOrder) => {
      try {
        const res = await fetch(`/api/purchase-orders/${po.id}/print`);
        if (!res.ok) {
          throw new Error("Failed to download purchase order PDF");
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `purchase-order-${po.purchaseOrderNo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(error);
        toast.error("Failed to download purchase order PDF");
      }
    },
    [toast]
  );

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "purchaseOrderNo",
      header: "PO No.",
      sortable: true,
      accessor: (row) => (
        <div className="font-medium">
          <div>{row.purchaseOrderNo}</div>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (row) => formatDateDmy(row.createdAt),
    },
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site?.site || "-",
    },
    {
      key: "vendor",
      header: "Vendor",
      accessor: (row) => row.vendor?.vendorName || "-",
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      cellClassName: "text-right",
      accessor: (row) => row.amount || 0,
    },
    {
      key: "approvalStatus",
      header: "Approval Status",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      accessor: (row) => (
        <IndentLikeStatusBadge
          status={row.approvalStatus}
          suspended={!!row.isSuspended}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      accessor: (row) => <POStatusBadge status={(row as any).poStatus ?? null} />,
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
      key: "approved1By",
      header: "Approve 1 By",
      sortable: false,
      accessor: (row) => (
        <UserBadge
          name={row.approved1By?.name ?? null}
          className="bg-emerald-600"
        />
      ),
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "approved2By",
      header: "Approve 2 By",
      sortable: false,
      accessor: (row) => (
        <UserBadge
          name={row.approved2By?.name ?? null}
          className="bg-violet-600"
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
        <h1 className="text-2xl font-bold">Purchase Orders</h1>

        {can(PERMISSIONS.CREATE_PURCHASE_ORDERS) && (
          <AppCard.Action>
            <AppButton
              size="sm"
              iconName="Plus"
              type="button"
              onClick={() => pushWithScrollSave("/purchase-orders/new")}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </div>

      <AppCard>
        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <div className="col-span-full grid grid-cols-4 gap-3 items-start">
              <div className="flex flex-col gap-2 min-w-0">
                <NonFormTextInput
                  label="Search"
                  placeholder="PO No., Quotation No., Note..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                  containerClassName="min-w-0"
                />
                {(search || site || vendor) && (
                  <AppButton
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      setSiteDraft("");
                      setVendorDraft("");
                      setQp({
                        search: "",
                        site: "",
                        vendor: "",
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
                label="Vendor"
                value={vendorDraft || "__none"}
                onValueChange={(v) => setVendorDraft(v === "__none" ? "" : v)}
                placeholder="All Vendors"
                triggerClassName="h-9"
                className="min-w-0"
              >
                <AppSelect.Item value="__none">All Vendors</AppSelect.Item>
                {vendors.map((v) => (
                  <AppSelect.Item key={v.id} value={v.id.toString()}>
                    {v.vendorName}
                  </AppSelect.Item>
                ))}
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
              renderRowActions={(po) => {
                const showPrint =
                  po.approvalStatus === "APPROVED_LEVEL_2" ||
                  po.approvalStatus === "COMPLETED";
                const isSuspended = po.approvalStatus === "SUSPENDED";
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <AppButton
                        size="sm"
                        variant="secondary"
                      >
                        Actions
                      </AppButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          pushWithScrollSave(`/purchase-orders/${po.id}/view`)
                        }
                      >
                        View
                      </DropdownMenuItem>

                      {isSuspended ? null : (
                        <>
                      {can(PERMISSIONS.EDIT_PURCHASE_ORDERS) &&
                      po.approvalStatus === "DRAFT" ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            pushWithScrollSave(`/purchase-orders/${po.id}/edit`)
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                      ) : null}
                      {showPrint && (
                        <DropdownMenuItem onClick={() => handlePrint(po)}>
                          Print
                        </DropdownMenuItem>
                      )}
                      {can(PERMISSIONS.UPDATE_PURCHASE_ORDER_REMARKS) ? (
                        <DropdownMenuItem onClick={() => handleRemarkClick(po)}>
                          Add Remark
                        </DropdownMenuItem>
                      ) : null}
                      {can(PERMISSIONS.UPDATE_PURCHASE_ORDER_BILL_STATUS) ? (
                        <DropdownMenuItem
                          onClick={() => handleBillStatusClick(po)}
                        >
                          Bill Status
                        </DropdownMenuItem>
                      ) : null}

                      <DropdownMenuItem onClick={() => handleUpdateStatusClick(po)}>
                        Update Status
                      </DropdownMenuItem>
                      {(() => {
                        const actions = getAvailableActions(
                          po.approvalStatus,
                          po.isSuspended,
                          po.createdById === user?.id,
                          po.approved1ById === user?.id
                        );
                        if (actions.length === 0) return null;
                        return actions.map((a) => (
                          <DropdownMenuItem
                            key={a.key}
                            onSelect={() => openApproval(po.id, a.key)}
                          >
                            {a.label}
                          </DropdownMenuItem>
                        ));
                      })()}
                        </>
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
        title="Delete Purchase Order"
        description={`Are you sure you want to delete purchase order ${poToDelete?.purchaseOrderNo}? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
      />

      <Dialog
        open={!!statusAction.po}
        onOpenChange={(open) => {
          if (!open) setStatusAction({ action: "", po: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction.action === "approve1" &&
                "Approve Purchase Order (Level 1)"}
              {statusAction.action === "approve2" &&
                "Approve Purchase Order (Level 2)"}
              {statusAction.action === "complete" && "Mark as Complete"}
              {statusAction.action === "suspend" && "Suspend Purchase Order"}
              {statusAction.action === "unsuspend" &&
                "Unsuspend Purchase Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p>
                Are you sure you want to {statusAction.action} purchase order{" "}
                <strong>{statusAction.po?.purchaseOrderNo}</strong>?
              </p>
              {(statusAction.action === "suspend" ||
                statusAction.action === "complete") && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Warning: This action cannot be reverted.
                  </p>
                </div>
              )}
              {statusAction.action !== "suspend" &&
                statusAction.action !== "complete" && (
                  <Textarea
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusAction({ action: "", po: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusAction}>
              {statusAction.action === "approve1" && "Approve Level 1"}
              {statusAction.action === "approve2" && "Approve Level 2"}
              {statusAction.action === "complete" && "Mark as Complete"}
              {statusAction.action === "suspend" && "Suspend"}
              {statusAction.action === "unsuspend" && "Unsuspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUpdateStatusDialog}
        onOpenChange={setShowUpdateStatusDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <AppSelect
              label="PO Status"
              value={poStatusDraft}
              onValueChange={(v) => setPoStatusDraft(v as any)}
              placeholder="Select PO Status"
            >
              <AppSelect.Item value="OPEN">Open</AppSelect.Item>
              <AppSelect.Item value="ORDER_PLACED">Order Placed</AppSelect.Item>
              <AppSelect.Item value="IN_TRANSIT">In Transit</AppSelect.Item>
              <AppSelect.Item value="RECEIVED">Received</AppSelect.Item>
              <AppSelect.Item value="HOLD">Hold</AppSelect.Item>
            </AppSelect>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpdateStatusDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateStatusSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRemarkDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRemarkDialog(false);
            setPoForRemark(null);
            setRemarkText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Remark</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p>
                Add remark for purchase order{" "}
                <strong>{poForRemark?.purchaseOrderNo}</strong>
              </p>
              <Textarea
                placeholder="Enter remark..."
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemarkDialog(false);
                setPoForRemark(null);
                setRemarkText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRemarkSubmit}>Save Remark</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBillStatusDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowBillStatusDialog(false);
            setPoForBillStatus(null);
            setBillStatusText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bill Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p>
                Update bill status for purchase order{" "}
                <strong>{poForBillStatus?.purchaseOrderNo}</strong>
              </p>
              <Textarea
                placeholder="Enter bill status..."
                value={billStatusText}
                onChange={(e) => setBillStatusText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBillStatusDialog(false);
                setPoForBillStatus(null);
                setBillStatusText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleBillStatusSubmit}>Save Bill Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
