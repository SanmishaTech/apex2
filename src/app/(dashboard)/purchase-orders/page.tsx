"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "@/lib/toast";

import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

import { AppButton } from "@/components/common/app-button";
import { AppCard } from "@/components/common/app-card";
import { AppSelect } from "@/components/common/app-select";
import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FilterBar } from "@/components/common";
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
  site: {
    id: number;
    site: string;
  };
  vendor: {
    id: number;
    vendorName: string;
  };
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

interface Column<TData = any> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  align?: "left" | "right" | "center";
  accessor?: (row: TData) => React.ReactNode;
  render?: (row: TData) => React.ReactNode;
}

type SortState = {
  field: string;
  order: "asc" | "desc";
};

export default function PurchaseOrdersPage() {
  const searchParams = useSearchParams();
  const { pushWithScrollSave } = useScrollRestoration("purchase-orders-list");
  const { can } = usePermissions();
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

  function getAvailableActions(
    s?: string,
    isSuspended?: boolean
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
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "approve1", label: "Approve 1" });
        }
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_1":
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "approve2", label: "Approve 2" });
        }
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_2":
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "complete", label: "Complete" });
        }
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "SUSPENDED":
        if (can(PERMISSIONS.EDIT_PURCHASE_ORDERS)) {
          baseActions.push({ key: "unsuspend", label: "Unsuspend" });
        }
        break;

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

  // Fetch sites for filter
  const { data: sitesData } = useSWR<SitesResponse>("/api/sites?perPage=1000", apiGet);
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
  const [poForBillStatus, setPoForBillStatus] = useState<PurchaseOrder | null>(null);
  const [billStatusText, setBillStatusText] = useState("");

  const openApproval = (id: number, key: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend") => {
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
    setStatusAction({ action: key, po: data?.data.find(p => p.id === id) || null });
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

  const handlePrint = useCallback(async (po: PurchaseOrder) => {
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
  }, [toast]);

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "purchaseOrderNo",
      header: "PO No.",
      accessor: (row) => row.purchaseOrderNo,
      sortable: true,
      render: (row) => (
        <div className="font-medium">
          <div>{row.purchaseOrderNo}</div>
          <div className="text-sm text-muted-foreground">
            {formatDate(new Date(row.createdAt))}
          </div>
        </div>
      ),
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
      align: "right",
      accessor: (row) => row.amount || 0,
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => prettyStatus(row.approvalStatus),
      render: (row) => (
        <div className="flex items-center">
          <div
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              row.isSuspended
                ? "bg-yellow-100 text-yellow-800"
                : row.isComplete
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {prettyStatus(row.approvalStatus)}
            {row.isSuspended && " (Suspended)"}
          </div>
        </div>
      ),
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NonFormTextInput
                label="Search"
                placeholder="PO No., Quotation No., Note..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <AppSelect
                label="Site"
                value={siteDraft || "__none"}
                onValueChange={(v) => setSiteDraft(v === "__none" ? "" : v)}
                placeholder="All Sites"
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
              >
                <AppSelect.Item value="__none">All Vendors</AppSelect.Item>
                {vendors.map((v) => (
                  <AppSelect.Item key={v.id} value={v.id.toString()}>
                    {v.vendorName}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
            <div className="flex gap-2 mt-4">
              <AppButton
                size="sm"
                onClick={applyFilters}
                disabled={!filtersDirty}
                className="min-w-[84px]"
              >
                Filter
              </AppButton>
              {(search || site || vendor) && (
                <AppButton
                  variant="secondary"
                  size="sm"
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
                  className="min-w-[84px]"
                >
                  Reset
                </AppButton>
              )}
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
              renderRowActions={(po) =>
                !can(PERMISSIONS.EDIT_PURCHASE_ORDERS) &&
                !can(PERMISSIONS.DELETE_PURCHASE_ORDERS) ? null : (
                  <div className="flex gap-2">
                    {can(PERMISSIONS.EDIT_PURCHASE_ORDERS) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <AppButton
                            size="sm"
                            variant="secondary"
                            disabled={
                              po.approvalStatus === "SUSPENDED" ||
                              po.approvalStatus === "COMPLETED"
                            }
                          >
                            Actions
                          </AppButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              pushWithScrollSave(`/purchase-orders/${po.id}/edit`)
                            }
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemarkClick(po)}
                          >
                            Add Remark
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleBillStatusClick(po)}
                          >
                            Bill Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrint(po)}>
                            Print
                          </DropdownMenuItem>
                          {(() => {
                            const actions = getAvailableActions(
                              po.approvalStatus,
                              po.isSuspended
                            );
                            if (actions.length === 0) {
                              return null;
                            }
                            return actions.map((a) => (
                              <DropdownMenuItem
                                key={a.key}
                                onSelect={() => openApproval(po.id, a.key)}
                              >
                                {a.label}
                              </DropdownMenuItem>
                            ));
                          })()}
                          {can(PERMISSIONS.DELETE_PURCHASE_ORDERS) && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteClick(po)}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              }
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
              {(statusAction.action === "suspend" || statusAction.action === "complete") && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Warning: This action cannot be reverted.
                  </p>
                </div>
              )}
              {statusAction.action !== "suspend" && statusAction.action !== "complete" && (
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
            <Button onClick={handleRemarkSubmit}>
              Save Remark
            </Button>
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
            <Button onClick={handleBillStatusSubmit}>
              Save Bill Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}