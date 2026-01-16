"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect, useCallback } from "react";
import { apiGet, apiDelete, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { FilterBar } from "@/components/common"; // filter layout wrapper
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PERMISSIONS } from "@/config/roles";
import { formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useSearchParams } from "next/navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { EditButton } from "@/components/common/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Indent, IndentsResponse } from "@/types/indents";
import type { SitesResponse } from "@/types/sites";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForInput } from "@/lib/locales";

export default function IndentsPage() {
  const searchParams = useSearchParams();
  const { pushWithScrollSave } = useScrollRestoration("indents-list");
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    site: "",
    sort: "indentDate",
    order: "desc",
  });
  // Initialize current user early so subsequent effects can safely depend on it
  const { user } = useCurrentUser();
  const { page, perPage, search, site, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    site: string;
    sort: string;
    order: "asc" | "desc";
  };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  useEffect(() => {
    setSiteDraft(site);
  }, [site]);

  const filtersDirty = searchDraft !== search || siteDraft !== site;

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
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
    isSuspended?: boolean,
    isCreator?: boolean,
    isL1Approver?: boolean
  ): {
    key: "approve1" | "approve2" | "complete" | "suspend";
    label: string;
  }[] {
    const baseActions: {
      key: "approve1" | "approve2" | "complete" | "suspend";
      label: string;
    }[] = [];

    switch (s) {
      case "DRAFT":
      case "":
      case undefined:
        if (!isCreator && can(PERMISSIONS.APPROVE_INDENTS_L1)) {
          baseActions.push({ key: "approve1", label: "Approve 1" });
        }
        if (can(PERMISSIONS.SUSPEND_INDENTS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_1":
        if (
          !isCreator &&
          !isL1Approver &&
          can(PERMISSIONS.APPROVE_INDENTS_L2)
        ) {
          baseActions.push({ key: "approve2", label: "Approve 2" });
        }
        if (can(PERMISSIONS.SUSPEND_INDENTS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "APPROVED_LEVEL_2":
        if (can(PERMISSIONS.COMPLETE_INDENTS)) {
          baseActions.push({ key: "complete", label: "Complete" });
        }
        if (can(PERMISSIONS.SUSPEND_INDENTS)) {
          baseActions.push({ key: "suspend", label: "Suspend" });
        }
        break;

      case "SUSPENDED":
      case "COMPLETED":
      default:
        return [];
    }

    // Permission-based filter
    return baseActions;
  }

  function resetFilters() {
    setSearchDraft("");
    setSiteDraft("");
    setQp({ page: 1, search: "", site: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (site) sp.set("site", site);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/indents?${sp.toString()}`;
  }, [page, perPage, search, site, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<IndentsResponse>(
    query,
    apiGet
  );

  // Refetch when logged-in user changes so Approve options reflect correct permissions/creator/L1 gating
  useEffect(() => {
    mutate();
  }, [user?.id, mutate]);

  // Debug: Log when perPage or pagination data changes
  useEffect(() => {
    if (data?.meta) {
      console.log("Indents Pagination Debug:", {
        requestedPerPage: perPage,
        responsePerPage: data.meta.perPage,
        total: data.meta.total,
        totalPages: data.meta.totalPages,
        currentPage: data.meta.page,
        query,
      });
    }
  }, [data?.meta, perPage, query]);

  // Fetch sites for filter dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || "Failed to load indents");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<Indent>[] = [
    {
      key: "indentNo",
      header: "Indent No",
      sortable: true,
      accessor: (r) => r.indentNo || "—",
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "indentDate",
      header: "Indent Date",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      accessor: (r) => formatDate(r.indentDate),
    },
    {
      key: "approvalStatus",
      header: "Status",
      sortable: false,
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      accessor: (r) => prettyStatus(r.approvalStatus),
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "completedItems",
      header: "Completed Items",
      sortable: false,
      className: "text-center",
      cellClassName: "text-center text-muted-foreground",
      accessor: (r) => {
        const items = r.indentItems ?? [];
        const total = items.length;
        const completed = items.reduce((count, item) => {
          return item.purchaseOrderDetailId !== null &&
            item.purchaseOrderDetailId !== undefined
            ? count + 1
            : count;
        }, 0);
        return `${completed}/${total}`;
      },
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) => formatDate(r.createdAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/indents/${id}`);
      toast.success("Indent deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Pre-approval dialog state
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalIndentId, setApprovalIndentId] = useState<number | null>(null);
  const [approvalAction, setApprovalAction] = useState<
    "approve1" | "approve2" | "complete" | "suspend" | null
  >(null);
  const [confirmSuspendId, setConfirmSuspendId] = useState<number | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<number | null>(
    null
  );

  // Load target indent when dialog opens
  const { data: approvalIndent, isLoading: approvalLoading } = useSWR<Indent>(
    approvalOpen && approvalIndentId
      ? `/api/indents/${approvalIndentId}`
      : null,
    apiGet
  );

  // Editable fields per item
  type EditFields = {
    indentQty: number;
    approved1Qty?: string;
    approved2Qty?: string;
    remark?: string;
  };
  const [itemEdits, setItemEdits] = useState<Record<number, EditFields>>({});

  useEffect(() => {
    if (approvalIndent?.indentItems) {
      const next: Record<number, EditFields> = {};
      for (const it of approvalIndent.indentItems) {
        const indentQtyNum = Number(it.indentQty || 0);
        const approved1Raw = it.approved1Qty;
        const approved2Raw = it.approved2Qty;
        const approved1Coerced = Number(approved1Raw);
        const approved2Coerced = Number(approved2Raw);
        const approved1Num =
          !Number.isNaN(approved1Coerced) && approved1Coerced > 0
            ? approved1Coerced
            : indentQtyNum;
        const approved2Num =
          !Number.isNaN(approved2Coerced) && approved2Coerced > 0
            ? approved2Coerced
            : approved1Num;
        next[it.id] = {
          indentQty: indentQtyNum,
          approved1Qty: approved1Num.toFixed(4),
          approved2Qty: approved2Num.toFixed(4),
          remark: it.remark || "",
        };
      }
      setItemEdits(next);
    }
  }, [approvalIndent?.indentItems]);

  async function openApproval(
    id: number,
    action: "approve1" | "approve2" | "complete" | "suspend"
  ) {
    if (action === "suspend") {
      setConfirmSuspendId(id);
      return;
    }

    if (action === "complete") {
      setConfirmCompleteId(id);
      return;
    }

    setApprovalIndentId(id);
    setApprovalAction(action);
    setApprovalOpen(true);
  }

  const handleSuspendConfirm = useCallback(async () => {
    if (!confirmSuspendId) return;
    try {
      await apiPatch(`/api/indents/${confirmSuspendId}`, {
        statusAction: "suspend",
      });
      toast.success("Indent suspended");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || "Failed to suspend indent");
    } finally {
      setConfirmSuspendId(null);
    }
  }, [confirmSuspendId, mutate]);

  const handleCompleteConfirm = useCallback(async () => {
    if (!confirmCompleteId) return;
    try {
      await apiPatch(`/api/indents/${confirmCompleteId}`, {
        statusAction: "complete",
      });
      toast.success("Indent marked as completed");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || "Failed to complete indent");
    } finally {
      setConfirmCompleteId(null);
    }
  }, [confirmCompleteId, mutate]);

  const handleGeneratePO = useCallback(
    async (indentId: number, siteId?: number | null) => {
      try {
        // Add a cache-busting param to force fresh mount each time
        pushWithScrollSave(
          `/purchase-orders/new?indentId=${indentId}&siteId=${
            siteId ?? ""
          }&r=${Date.now()}`
        );
      } catch (e) {
        toast.error(
          (e as Error).message || "Failed to generate purchase order"
        );
      }
    },
    [pushWithScrollSave]
  );

  const MAX_DEC = 99999999.9999; // MySQL DECIMAL(12,4)
  const clampDec = (n: number) => Math.min(Math.max(0, n), MAX_DEC);
  const setEdit = useCallback(
    (id: number, field: keyof EditFields, value: string) => {
      setItemEdits((prev) => {
        let next: any;
        if (field === "indentQty") {
          next = value === "" ? 0 : clampDec(Number(value));
        } else if (field === "approved1Qty" || field === "approved2Qty") {
          next = value;
        } else {
          next = value;
        }
        return {
          ...prev,
          [id]: {
            ...prev[id],
            [field]: next,
          },
        };
      });
    },
    []
  );

  async function handleApproveConfirm() {
    if (!approvalIndent || !approvalIndentId || !approvalAction) return;

    try {
      const isApprove1 = approvalAction === "approve1";
      const approvedQtyField = isApprove1 ? "approved1Qty" : "approved2Qty";

      const parseQty = (v: unknown): number => {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const t = v.trim();
          if (!t || t === ".") return NaN;
          return Number(t);
        }
        return NaN;
      };

      // Require approved quantity for all items when not suspending
      if (approvalAction !== "suspend") {
        for (const it of approvalIndent.indentItems || []) {
          const aqRaw = itemEdits[it.id]?.[approvedQtyField];
          const aq =
            typeof aqRaw !== "undefined"
              ? parseQty(aqRaw)
              : typeof (it as any)[approvedQtyField] === "number"
                ? Number((it as any)[approvedQtyField])
                : parseQty((it as any).indentQty);
          if (Number.isNaN(aq)) {
            toast.error("Approved quantity is required for all items");
            return;
          }
        }
      }

      // Build payload with only allowed editable fields; other required fields kept as-is
      const includeItems = approvalAction !== "suspend";
      const payload = {
        indentItems: includeItems
          ? approvalIndent.indentItems?.map((it) => {
              const approvedQtyRaw = itemEdits[it.id]?.[approvedQtyField];
              const approvedQtyParsed =
                typeof approvedQtyRaw !== "undefined"
                  ? parseQty(approvedQtyRaw)
                  : typeof (it as any)[approvedQtyField] === "number"
                    ? Number((it as any)[approvedQtyField])
                    : parseQty((it as any).indentQty);
              const approvedQty = Number.isNaN(approvedQtyParsed)
                ? 0
                : approvedQtyParsed;

              return {
                id: Number(it.id), // ✅ include indent item ID
                itemId: Number(it.itemId!),
                closingStock: Number((it as any).closingStock ?? 0),
                remark: itemEdits[it.id]?.remark || it.remark || undefined,
                indentQty: clampDec(
                  itemEdits[it.id]?.indentQty ??
                    Number((it as any).indentQty || 0)
                ),
                [approvedQtyField]: clampDec(Number(approvedQty)),
              };
            }) || []
          : undefined,
        statusAction: approvalAction,
      };

      await apiPatch(`/api/indents/${approvalIndentId}`, payload);
      toast.success("Indent updated successfully");
      setApprovalOpen(false);
      setApprovalIndentId(null);
      setApprovalAction(null);
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update indent"
      );
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmSuspendId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmSuspendId(null);
        }}
        title="Suspend indent?"
        description="Suspending an indent cannot be reverted. Do you want to continue?"
        confirmText="Suspend"
        onConfirm={handleSuspendConfirm}
      />
      <ConfirmDialog
        open={confirmCompleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCompleteId(null);
        }}
        title="Mark indent as completed?"
        description="Completing an indent cannot be reverted. Do you want to continue?"
        confirmText="Continue"
        onConfirm={handleCompleteConfirm}
      />
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Indents</AppCard.Title>
          <AppCard.Description>Manage application indents.</AppCard.Description>
          {can(PERMISSIONS.CREATE_INDENTS) && (
            <AppCard.Action>
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/indents/new")}
              >
                Add
              </AppButton>
            </AppCard.Action>
          )}
        </AppCard.Header>
        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <NonFormTextInput
              aria-label="Search indents"
              placeholder="Search indents..."
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
              {sitesData?.data?.map((site) => (
                <AppSelect.Item key={site.id} value={String(site.id)}>
                  {site.site}
                </AppSelect.Item>
              ))}
            </AppSelect>
            <AppButton
              size="sm"
              onClick={applyFilters}
              disabled={!filtersDirty && !searchDraft && !siteDraft}
              className="min-w-[84px]"
            >
              Filter
            </AppButton>
            {(search || site) && (
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
          {/* Horizontal scroll wrapper for mobile */}
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={isLoading}
            sort={sortState}
            onSortChange={(s) => toggleSort(s.field)}
            stickyColumns={1}
            renderRowActions={(indent) => {
              const canAnyAction =
                can(PERMISSIONS.EDIT_INDENTS) ||
                can(PERMISSIONS.DELETE_INDENTS) ||
                can(PERMISSIONS.APPROVE_INDENTS_L1) ||
                can(PERMISSIONS.APPROVE_INDENTS_L2) ||
                can(PERMISSIONS.COMPLETE_INDENTS) ||
                can(PERMISSIONS.SUSPEND_INDENTS) ||
                can(PERMISSIONS.GENERATE_PO_FROM_INDENT);
              if (!canAnyAction) return null;
              return (
                <div className="flex gap-2">
                  {(can(PERMISSIONS.EDIT_INDENTS) ||
                    can(PERMISSIONS.APPROVE_INDENTS_L1) ||
                    can(PERMISSIONS.APPROVE_INDENTS_L2) ||
                    can(PERMISSIONS.COMPLETE_INDENTS) ||
                    can(PERMISSIONS.SUSPEND_INDENTS) ||
                    can(PERMISSIONS.GENERATE_PO_FROM_INDENT)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <AppButton
                          size="sm"
                          variant="secondary"
                          disabled={
                            indent.suspended ||
                            indent.approvalStatus === "SUSPENDED"
                          }
                        >
                          Actions
                        </AppButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(() => {
                          const items = indent.indentItems ?? [];
                          const completedCount = items.filter(
                            (item) =>
                              item.purchaseOrderDetailId !== null &&
                              item.purchaseOrderDetailId !== undefined
                          ).length;
                          const allItemsCompleted =
                            items.length > 0 && completedCount === items.length;
                          const canGeneratePo =
                            can(PERMISSIONS.GENERATE_PO_FROM_INDENT) &&
                            (indent.approvalStatus === "APPROVED_LEVEL_2" ||
                              indent.approvalStatus === "COMPLETED") &&
                            !indent.suspended &&
                            !allItemsCompleted;

                          return canGeneratePo ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                handleGeneratePO(
                                  indent.id,
                                  // Prefer explicit siteId if available, else nested site.id
                                  (indent as any).siteId ?? indent.site?.id ?? null
                                )
                              }
                            >
                              Generate PO
                            </DropdownMenuItem>
                          ) : null;
                        })()}
                        {(() => {
                          const actions = getAvailableActions(
                            indent.approvalStatus,
                            indent.suspended,
                            (indent as any).createdById === user?.id,
                            (indent as any).approved1ById === user?.id
                          );
                          const items = indent.indentItems ?? [];
                          const completedCount = items.filter(
                            (item) =>
                              item.purchaseOrderDetailId !== null &&
                              item.purchaseOrderDetailId !== undefined
                          ).length;
                          const allItemsCompleted =
                            items.length > 0 && completedCount === items.length;
                          const showGenerate =
                            can(PERMISSIONS.GENERATE_PO_FROM_INDENT) &&
                            (indent.approvalStatus === "APPROVED_LEVEL_2" ||
                              indent.approvalStatus === "COMPLETED") &&
                            !indent.suspended &&
                            !allItemsCompleted;
                          if (actions.length === 0 && !showGenerate) {
                            return (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No actions available
                              </div>
                            );
                          }
                          return actions.map((a) => (
                            <DropdownMenuItem
                              key={a.key}
                              onSelect={() => openApproval(indent.id, a.key)}
                            >
                              {a.label}
                            </DropdownMenuItem>
                          ));
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            }}
          />
        </AppCard.Content>
        <AppCard.Footer className="justify-end">
          <Pagination
            page={data?.meta?.page || page}
            totalPages={data?.meta?.totalPages || 1}
            perPage={data?.meta?.perPage || perPage}
            onPerPageChange={(val) => {
              console.log("Changing perPage from", perPage, "to", val);
              setQp({ page: 1, perPage: val });
            }}
            onPageChange={(p) => {
              console.log("Changing page from", page, "to", p);
              setQp({ page: p });
            }}
            showPageNumbers
            disabled={isLoading}
          />
        </AppCard.Footer>
      </AppCard>

      {/* Pre-approval Dialog */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Review and Approve Indent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {approvalLoading || !approvalIndent ? (
              <div className="p-4 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 w-[320px]">Item</th>
                      <th className="text-left p-3">Unit</th>
                      <th className="text-left p-3">Indent Qty</th>
                      <th className="text-left p-3 w-[160px]">
                        {approvalAction === "approve1"
                          ? "Approve 1 Qty"
                          : "Approved 1 Qty"}
                      </th>
                      {approvalAction === "approve2" && (
                        <th className="text-left p-3 w-[160px]">Approve 2 Qty</th>
                      )}
                      <th className="text-left p-3">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalIndent.indentItems?.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-3 align-top">
                          <div className="max-w-[320px] whitespace-normal break-words">
                            {it.item?.item} ({it.item?.itemCode})
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {it.item?.unit?.unitName}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {Number(it.indentQty || 0).toFixed(4)}
                        </td>
                        <td className="p-3 whitespace-nowrap w-[160px]">
                          {approvalAction === "approve1" ? (
                            <Input
                              type="text"
                              inputMode="decimal"
                              required
                              value={
                                itemEdits[it.id]?.approved1Qty ??
                                Number(it.indentQty ?? 0).toFixed(4)
                              }
                              placeholder={Number(it.indentQty ?? 0).toFixed(4)}
                              className="w-[140px]"
                              onChange={(e) => {
                                const next = e.target.value;
                                if (/^\d*(\.\d{0,4})?$/.test(next)) {
                                  setEdit(it.id, "approved1Qty", next);
                                }
                              }}
                            />
                          ) : (
                            Number(it.approved1Qty || 0).toFixed(4)
                          )}
                        </td>
                        {approvalAction === "approve2" && (
                          <td className="p-3 whitespace-nowrap w-[160px]">
                            <Input
                              type="text"
                              inputMode="decimal"
                              required
                              value={
                                itemEdits[it.id]?.approved2Qty ??
                                Number(it.approved1Qty ?? it.indentQty ?? 0).toFixed(4)
                              }
                              placeholder={Number(
                                it.approved1Qty ?? it.indentQty ?? 0
                              ).toFixed(4)}
                              className="w-[140px]"
                              onChange={(e) => {
                                const next = e.target.value;
                                if (/^\d*(\.\d{0,4})?$/.test(next)) {
                                  setEdit(it.id, "approved2Qty", next);
                                }
                              }}
                            />
                          </td>
                        )}

                        <td className="p-3 w-[320px]">
                          <Textarea
                            value={itemEdits[it.id]?.remark ?? it.remark ?? ""}
                            onChange={(e) =>
                              setEdit(it.id, "remark", e.target.value)
                            }
                            rows={2}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <AppButton
              variant="secondary"
              onClick={() => setApprovalOpen(false)}
            >
              Cancel
            </AppButton>
            <AppButton
              onClick={handleApproveConfirm}
              disabled={approvalLoading || !approvalIndent}
            >
              {approvalAction === "approve1"
                ? "Approve 1"
                : approvalAction === "approve2"
                ? "Approve 2"
                : approvalAction === "complete"
                ? "Complete"
                : "Suspend"}
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
