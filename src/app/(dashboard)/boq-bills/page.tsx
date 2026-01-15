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
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { BoqBillsResponse, BoqBill } from "@/types/boq-bills";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BillListItem = BoqBill;

export default function BoqBillsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "billDate",
    order: "desc",
  });

  const { page, perPage, search, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    sort: string;
    order: "asc" | "desc";
  };

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim() });
  }

  function resetFilters() {
    setSearchDraft("");
    setQp({ page: 1, search: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/boq-bills?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<BoqBillsResponse>(query, apiGet);
  const { can } = usePermissions();

  if (error) toast.error((error as Error).message || "Failed to load BOQ bills");

  const columns: Column<BillListItem>[] = [
    {
      key: "billNumber",
      header: "Bill No.",
      sortable: true,
      accessor: (r) => r.billNumber,
      className: "whitespace-nowrap",
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "billName",
      header: "Bill Name",
      sortable: false,
      accessor: (r) => r.billName,
      className: "min-w-[220px]",
    },
    {
      key: "billDate",
      header: "Bill Date",
      sortable: true,
      accessor: (r) => (r.billDate ? formatDate(r.billDate) : "—"),
      className: "whitespace-nowrap",
    },
    {
      key: "boq",
      header: "BOQ No.",
      sortable: false,
      accessor: (r) => r.boq?.boqNo || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.boq?.site?.site || "—",
      className: "whitespace-nowrap",
    },
    {
      key: "totalAmount",
      header: "Total Amount",
      sortable: false,
      accessor: (r) => String((r as any).totalAmount ?? "—"),
      className: "whitespace-nowrap",
      cellClassName: "text-right tabular-nums",
    },
  ];

  const sortState: SortState = { field: sort, order };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<number | null>(null);

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/boq-bills/${id}`);
      toast.success("BOQ bill deleted");
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  function openDeleteDialog(id: number, billNumber: string) {
    setBillToDelete(id);
    setDeleteDialogOpen(true);
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>BOQ Bills</AppCard.Title>
        <AppCard.Description>Manage BOQ bills.</AppCard.Description>
        {can(PERMISSIONS.CREATE_BOQ_BILLS) && (
          <AppCard.Action>
            <Link href="/boq-bills/new">
              <AppButton size="sm" iconName="Plus" type="button">
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search BOQ Bills"
            placeholder="Search by Bill No, Bill Name, BOQ No..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {search && (
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
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => setQp({ sort: s.field, order: s.order })}
          stickyColumns={1}
          renderRowActions={(row) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AppButton size="sm" variant="secondary" type="button">
                  Options
                </AppButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild disabled={!can(PERMISSIONS.EDIT_BOQ_BILLS)}>
                  <Link href={`/boq-bills/${row.id}/edit`}>Edit Bill</Link>
                </DropdownMenuItem>
                {can(PERMISSIONS.DELETE_BOQ_BILLS) && (
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={() => openDeleteDialog(row.id, row.billNumber)}
                  >
                    Delete Bill
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete BOQ bill?"
        description={`This will permanently remove the selected bill. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          if (billToDelete) {
            handleDelete(billToDelete);
            setDeleteDialogOpen(false);
            setBillToDelete(null);
          }
        }}
      />
    </AppCard>
  );
}


// Calculate qty * rate in report excecla n ui and in form also.