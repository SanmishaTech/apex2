"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet, apiDelete } from "@/lib/api-client";
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
import { PERMISSIONS } from "@/config/roles";
import { formatDateDMY } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import Link from "next/link";
import type { Cashbook, CashbooksResponse } from "@/types/cashbooks";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function CashbooksPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    isVoucher: "",
    sort: "voucherDate",
    order: "desc",
  });
  const { page, perPage, search, isVoucher, sort, order } = qp;

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

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (isVoucher) sp.set("isVoucher", isVoucher);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/cashbooks?${sp.toString()}`;
  }, [page, perPage, search, isVoucher, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<CashbooksResponse>(
    query,
    apiGet
  );

  const { pushWithScrollSave } = useScrollRestoration("cashbooks-list");
  const { can } = usePermissions();
  const { user } = useCurrentUser();

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

  function toggleSort(field: string) {
    if (sort === field) {
      const newOrder = order === "asc" ? "desc" : "asc";
      setQp({ order: newOrder });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const sortState: SortState = { field: sort, order: order as "asc" | "desc" };

  const columns: Column<Cashbook>[] = [
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

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(cashbook) => {
            const isCreator =
              typeof cashbook.createdById === "number" &&
              typeof user?.id === "number" &&
              cashbook.createdById === user.id;
            const isL1Approver =
              typeof cashbook.approved1ById === "number" &&
              typeof user?.id === "number" &&
              cashbook.approved1ById === user.id;

            const canEdit = can(PERMISSIONS.EDIT_CASHBOOKS);
            const canDelete = can(PERMISSIONS.DELETE_CASHBOOKS);
            const canApprove1 =
              can(PERMISSIONS.APPROVE_CASHBOOKS_L1) && !cashbook.isApproved1 && !isCreator;
            const canApprove2 =
              can(PERMISSIONS.APPROVE_CASHBOOKS_L2) &&
              !!cashbook.isApproved1 &&
              !cashbook.isApproved2 &&
              !isCreator &&
              !isL1Approver;

            if (!canEdit && !canDelete && !canApprove1 && !canApprove2) return null;
            return (
              <div className="flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <AppButton size="sm" variant="secondary">
                      Actions
                    </AppButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
