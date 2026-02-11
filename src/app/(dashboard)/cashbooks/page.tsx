"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet, apiDelete, apiPatch } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { FilterBar } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useProtectPage } from "@/hooks/use-protect-page";
import { PERMISSIONS } from "@/config/roles";
import { formatDateDMY } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import Link from "next/link";
import type { Cashbook, CashbooksResponse } from "@/types/cashbooks";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function CashbooksPage() {
  useProtectPage();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    isVoucher: "",
    approval1Pending: "",
    approval2Pending: "",
    sort: "voucherDate",
    order: "desc",
  });
  const {
    page,
    perPage,
    search,
    isVoucher,
    approval1Pending,
    approval2Pending,
    sort,
    order,
  } = qp;

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [isVoucherDraft, setIsVoucherDraft] = useState(isVoucher);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
    setIsVoucherDraft(isVoucher);
  }, [search, isVoucher]);

  const filtersDirty = searchDraft !== search || isVoucherDraft !== isVoucher;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), isVoucher: isVoucherDraft });
  }

  function resetFilters() {
    setSearchDraft("");
    setIsVoucherDraft("");
    setQp({ page: 1, search: "", isVoucher: "" });
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

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (isVoucher) sp.set("isVoucher", isVoucher);
    if (approval1Pending) sp.set("approval1Pending", approval1Pending);
    if (approval2Pending) sp.set("approval2Pending", approval2Pending);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/cashbooks?${sp.toString()}`;
  }, [page, perPage, search, isVoucher, approval1Pending, approval2Pending, sort, order]);

  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const { data, error, isLoading, mutate } = useSWR<CashbooksResponse>(
    can(PERMISSIONS.VIEW_CASHBOOKS) ? query : null,
    apiGet
  );

  const { pushWithScrollSave } = useScrollRestoration("cashbooks-list");

  if (!can(PERMISSIONS.VIEW_CASHBOOKS)) {
    return null;
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/cashbooks/${id}`);
      toast.success("Cashbook deleted successfully");
      mutate(); // Refresh the data
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete cashbook"
      );
    }
  }

  async function handleBulkApprove2() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Please select at least one cashbook");
      return;
    }
    if (!canApprove2Any) {
      toast.error("You do not have permission to approve (Level 2)");
      return;
    }

    try {
      const results = await Promise.allSettled(
        ids.map((id) => apiPatch(`/api/cashbooks/${id}`, { statusAction: "approve2" }))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      if (ok > 0) toast.success(`Approved ${ok} cashbook(s) (Level 2)`);
      if (failed > 0) toast.error(`Failed to approve ${failed} cashbook(s)`);
      setSelectedIds(new Set());
      mutate();
    } catch (e) {
      toast.error((e as Error).message || "Failed to approve cashbooks");
    }
  }

  function toggleSort(field: string) {
    if (sort === field) {
      const newOrder = order === "asc" ? "desc" : "asc";
      setQp({ order: newOrder });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const sortState: SortState = { field: sort, order: order as "asc" | "desc" };

  const approval1Mode = approval1Pending === "1";
  const approval2Mode = approval2Pending === "1";
  const approvalMode = approval1Mode ? "approve1" : approval2Mode ? "approve2" : null;
  const canApprove1Any = can(PERMISSIONS.APPROVE_CASHBOOKS_L1);
  const canApprove2Any = can(PERMISSIONS.APPROVE_CASHBOOKS_L2);

  useEffect(() => {
    if (approval1Mode && !canApprove1Any) {
      toast.error("You do not have permission to approve (Level 1)");
      setQp({ approval1Pending: "", approval2Pending: "" });
      return;
    }
    if (approval2Mode && !canApprove2Any) {
      toast.error("You do not have permission to approve (Level 2)");
      setQp({ approval2Pending: "", approval1Pending: "" });
    }
  }, [approval1Mode, approval2Mode, canApprove1Any, canApprove2Any, setQp]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    // When list changes (pagination/filter), drop selection to avoid accidental approvals
    setSelectedIds(new Set());
  }, [query]);

  const visibleRows = (data?.data || []) as Cashbook[];

  const selectableIds = useMemo(() => {
    if (!approvalMode) return [] as number[];
    return visibleRows
      .filter((cashbook) => {
        const isCreator =
          typeof cashbook.createdById === "number" &&
          typeof user?.id === "number" &&
          cashbook.createdById === user.id;

        if (approvalMode === "approve1") {
          return canApprove1Any && !cashbook.isApproved1 && !isCreator;
        }

        const isL1Approver =
          typeof cashbook.approved1ById === "number" &&
          typeof user?.id === "number" &&
          cashbook.approved1ById === user.id;

        return (
          canApprove2Any &&
          !!cashbook.isApproved1 &&
          !cashbook.isApproved2 &&
          !isCreator &&
          !isL1Approver
        );
      })
      .map((r) => r.id);
  }, [approvalMode, visibleRows, user?.id, canApprove1Any, canApprove2Any]);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));

  function toggleSelectAll(next: boolean) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) {
        for (const id of selectableIds) n.add(id);
      } else {
        for (const id of selectableIds) n.delete(id);
      }
      return n;
    });
  }

  function toggleSelectOne(id: number, next: boolean) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function handleBulkApprove1() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Please select at least one cashbook");
      return;
    }
    if (!canApprove1Any) {
      toast.error("You do not have permission to approve (Level 1)");
      return;
    }

    try {
      const results = await Promise.allSettled(
        ids.map((id) => apiPatch(`/api/cashbooks/${id}`, { statusAction: "approve1" }))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      if (ok > 0) toast.success(`Approved ${ok} cashbook(s) (Level 1)`);
      if (failed > 0) toast.error(`Failed to approve ${failed} cashbook(s)`);
      setSelectedIds(new Set());
      mutate();
    } catch (e) {
      toast.error((e as Error).message || "Failed to approve cashbooks");
    }
  }

  const columns: Column<Cashbook>[] = [
    ...(approvalMode
      ? ([
          {
            key: "__select",
            header: (
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleSelectAll(!!v)}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all"
                />
              </div>
            ),
            accessor: (cashbook) => {
              const isCreator =
                typeof cashbook.createdById === "number" &&
                typeof user?.id === "number" &&
                cashbook.createdById === user.id;

              const isL1Approver =
                typeof cashbook.approved1ById === "number" &&
                typeof user?.id === "number" &&
                cashbook.approved1ById === user.id;

              const canSelect =
                approvalMode === "approve1"
                  ? canApprove1Any && !cashbook.isApproved1 && !isCreator
                  : canApprove2Any &&
                    !!cashbook.isApproved1 &&
                    !cashbook.isApproved2 &&
                    !isCreator &&
                    !isL1Approver;
              return (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={selectedIds.has(cashbook.id)}
                    onCheckedChange={(v) => toggleSelectOne(cashbook.id, !!v)}
                    disabled={!canSelect}
                    aria-label={`Select cashbook ${cashbook.id}`}
                  />
                </div>
              );
            },
            sortable: false,
            className: "w-10",
            cellClassName: "w-10",
          },
        ] as Column<Cashbook>[])
      : []),
    {
      key: "voucherNo",
      header: "Voucher No",
      sortable: true,
      accessor: (cashbook) => (
        <div className="font-medium">{cashbook.voucherNo || "N/A"}</div>
      ),
    },
    {
      key: "voucherDate",
      header: "Voucher Date",
      sortable: true,
      accessor: (cashbook) => <div>{formatDateDMY(cashbook.voucherDate)}</div>,
    },
    {
      key: "site",
      header: "Site",
      accessor: (cashbook) => <div>{cashbook.site?.site || "N/A"}</div>,
    },
    {
      key: "boq",
      header: "BOQ",
      accessor: (cashbook) => <div>{cashbook.boq?.boqNo || "N/A"}</div>,
    },
    {
      key: "details",
      header: "Details Count",
      accessor: (cashbook) => (
        <div className="text-center">
          {(cashbook as any)?._count?.cashbookDetails ?? cashbook.cashbookDetails?.length ?? 0} items
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      accessor: (cashbook) => (
        <div className="text-sm text-muted-foreground">
          {formatDateDMY(cashbook.createdAt)}
        </div>
      ),
    },
    {
      key: "createdBy",
      header: "Created By",
      sortable: false,
      accessor: (r) => <UserBadge name={r.createdBy?.name ?? null} className="bg-sky-600" />,
      className: "whitespace-nowrap",
    },
    {
      key: "approved1By",
      header: "Approved 1 By",
      sortable: false,
      accessor: (r) => <UserBadge name={r.approved1By?.name ?? null} className="bg-emerald-600" />,
      className: "whitespace-nowrap",
    },
    {
      key: "approved2By",
      header: "Approved 2 By",
      sortable: false,
      accessor: (r) => <UserBadge name={r.approved2By?.name ?? null} className="bg-violet-600" />,
      className: "whitespace-nowrap",
    },
  ];

  if (error) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <div className="text-center text-red-600">
            Failed to load cashbooks. Please try again.
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <div className="flex items-center justify-between">
          <div>
            <AppCard.Title>Cashbooks</AppCard.Title>
            <AppCard.Description>
              Manage application cashbook vouchers.
            </AppCard.Description>
          </div>
          <AppCard.Action>
            {canApprove1Any && (
              <div className="flex items-center gap-2">
                <AppButton
                  size="sm"
                  variant={approval1Mode ? "secondary" : "default"}
                  type="button"
                  onClick={() =>
                    setQp({
                      page: 1,
                      approval1Pending: approval1Mode ? "" : "1",
                      approval2Pending: "",
                    })
                  }
                >
                  {approval1Mode ? "Exit Pending Approval 1" : "Pending Approval 1"}
                </AppButton>

                {approval1Mode && (
                  <AppButton
                    size="sm"
                    type="button"
                    onClick={handleBulkApprove1}
                    disabled={selectedIds.size === 0 || isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve 1 (Selected)
                  </AppButton>
                )}
              </div>
            )}

            {canApprove2Any && (
              <div className="flex items-center gap-2">
                <AppButton
                  size="sm"
                  variant={approval2Mode ? "secondary" : "default"}
                  type="button"
                  onClick={() =>
                    setQp({
                      page: 1,
                      approval2Pending: approval2Mode ? "" : "1",
                      approval1Pending: "",
                    })
                  }
                >
                  {approval2Mode ? "Exit Pending Approval 2" : "Pending Approval 2"}
                </AppButton>

                {approval2Mode && (
                  <AppButton
                    size="sm"
                    type="button"
                    onClick={handleBulkApprove2}
                    disabled={selectedIds.size === 0 || isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve 2 (Selected)
                  </AppButton>
                )}
              </div>
            )}

            {can(PERMISSIONS.CREATE_CASHBOOKS) && (
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/cashbooks/new")}
              >
                Add Cashbook
              </AppButton>
            )}
          </AppCard.Action>
        </div>
      </AppCard.Header>

      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search cashbooks"
            placeholder="Search cashbooks..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="flex-1"
          />
          <AppSelect
            value={isVoucherDraft || "__all"}
            onValueChange={(v) => setIsVoucherDraft(v === "__all" ? "" : v)}
            placeholder="Is Voucher"
          >
            <AppSelect.Item value="__all">
              File Attachment Status
            </AppSelect.Item>
            <AppSelect.Item value="yes">With Attachment</AppSelect.Item>
            <AppSelect.Item value="no">Without Attachment</AppSelect.Item>
          </AppSelect>
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !isVoucherDraft}
            className="min-w-21"
          >
            Filter
          </AppButton>
          {(search || isVoucher) && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="min-w-21"
            >
              Reset
            </AppButton>
          )}
        </FilterBar>

        <div className="w-full overflow-x-auto">
          <div className="min-w-max">
            <DataTable
              columns={columns}
              data={data?.data || []}
              loading={isLoading}
              sort={sortState}
              onSortChange={(s) => toggleSort(s.field)}
              stickyColumns={approvalMode ? 2 : 1}
              renderRowActions={(cashbook) => {
                const isCreator =
                  typeof cashbook.createdById === "number" &&
                  typeof user?.id === "number" &&
                  cashbook.createdById === user.id;
                const isL1Approver =
                  typeof cashbook.approved1ById === "number" &&
                  typeof user?.id === "number" &&
                  cashbook.approved1ById === user.id;

                const canView = can(PERMISSIONS.VIEW_CASHBOOKS);
                const canEdit =
                  can(PERMISSIONS.EDIT_CASHBOOKS) &&
                  !cashbook.isApproved1 &&
                  !cashbook.isApproved2;
                const canDelete =
                  can(PERMISSIONS.DELETE_CASHBOOKS) &&
                  !cashbook.isApproved1 &&
                  !cashbook.isApproved2;
                const canApprove1 =
                  can(PERMISSIONS.APPROVE_CASHBOOKS_L1) &&
                  !cashbook.isApproved1 &&
                  !isCreator;
                const canApprove2 =
                  can(PERMISSIONS.APPROVE_CASHBOOKS_L2) &&
                  !!cashbook.isApproved1 &&
                  !cashbook.isApproved2 &&
                  !isCreator &&
                  !isL1Approver;

                if (!canView && !canEdit && !canDelete && !canApprove1 && !canApprove2)
                  return null;
                return (
                  <div className="flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <AppButton size="sm" variant="secondary">
                          Actions
                        </AppButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canView && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              pushWithScrollSave(`/cashbooks/${cashbook.id}/view`);
                            }}
                          >
                            View
                          </DropdownMenuItem>
                        )}

                        {canEdit && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              pushWithScrollSave(`/cashbooks/${cashbook.id}/edit`);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                        )}

                        {canApprove1 && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              pushWithScrollSave(`/cashbooks/${cashbook.id}/approve1`);
                            }}
                          >
                            Approve 1
                          </DropdownMenuItem>
                        )}

                        {canApprove2 && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              pushWithScrollSave(`/cashbooks/${cashbook.id}/approve2`);
                            }}
                          >
                            Approve 2
                          </DropdownMenuItem>
                        )}

                        {canDelete && (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                            }}
                          >
                            <DeleteButton
                              onDelete={() => handleDelete(String(cashbook.id))}
                              itemLabel="cashbook"
                              title="Delete cashbook?"
                              description={`This will permanently remove cashbook voucher ${
                                cashbook.voucherNo || cashbook.id
                              }. This action cannot be undone.`}
                            >
                              <span className="w-full">Delete</span>
                            </DeleteButton>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              }}
            />
          </div>
        </div>
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
        <Pagination
          page={data?.page || page}
          totalPages={data?.totalPages || 1}
          total={data?.total}
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
