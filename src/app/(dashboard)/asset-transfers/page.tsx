"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { AppCard } from "@/components/common/app-card";
import { DataTable, SortState } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppButton } from "@/components/common/app-button";
import { DeleteButton } from "@/components/common/delete-button";
import { EditButton } from "@/components/common/icon-button";
import { useProtectPage } from "@/hooks/use-protect-page";
import { usePermissions } from "@/hooks/use-permissions";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { PERMISSIONS } from "@/config/roles";
import useSWR from "swr";
import { toast } from "@/lib/toast";
import { apiDelete, apiPatch } from "@/lib/api-client";
import {
  AssetTransfer,
  AssetTransfersResponse,
  ASSET_TRANSFER_STATUS_COLORS,
} from "@/types/asset-transfers";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AssetTransfersPage() {
  useProtectPage();

  const { pushWithScrollSave } = useScrollRestoration("asset-transfers-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "createdAt",
    order: "desc",
  });
  const { page, perPage, search, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    sort: string;
    order: "asc" | "desc";
  };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
    });
  }

  function clearFilters() {
    setSearchDraft("");
    setQp({ page: 1, search: "" });
  }

  const { can } = usePermissions();

  const canEdit = can(PERMISSIONS.READ_ASSET_TRANSFERS);
  const canCreate = can(PERMISSIONS.CREATE_ASSET_TRANSFERS);
  const canDelete = can(PERMISSIONS.DELETE_ASSET_TRANSFERS);
  const canApprove = can(PERMISSIONS.APPROVE_ASSET_TRANSFERS);

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    sort,
    order,
    ...(search && { search }),
  });

  const { data, error, isLoading, mutate } = useSWR<AssetTransfersResponse>(
    `/api/asset-transfers?${queryParams}`,
    fetcher
  );

  const sortState: SortState = { field: sort, order };

  function toggleSort(field: string) {
    const newOrder = sort === field && order === "asc" ? "desc" : "asc";
    setQp({ sort: field, order: newOrder });
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/asset-transfers/${id}`);
      toast.success("Asset transfer deleted successfully");
      mutate(); // Refresh the data
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete asset transfer"
      );
    }
  };

  const handleApprove = async (id: number, status: "Accepted" | "Rejected") => {
    try {
      await apiPatch(`/api/asset-transfers/${id}`, {
        status,
        approvedById: 1, // TODO: Get current user ID
      });
      toast.success(`Asset transfer ${status.toLowerCase()} successfully`);
      mutate(); // Refresh the data
    } catch (error) {
      console.error("Approve error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${status.toLowerCase()} asset transfer`
      );
    }
  };

  const columns = [
    {
      key: "challanNo",
      header: "Challan No",
      sortable: true,
      accessor: (transfer: AssetTransfer) => (
        <span className="font-medium text-blue-600">{transfer.challanNo}</span>
      ),
    },
    {
      key: "challanDate",
      header: "Challan Date",
      sortable: true,
      accessor: (transfer: AssetTransfer) =>
        new Date(transfer.challanDate).toLocaleDateString(),
    },
    {
      key: "transferType",
      header: "Transfer Type",
      sortable: true,
      accessor: (transfer: AssetTransfer) => (
        <Badge
          variant={
            transfer.transferType === "New Assign" ? "default" : "secondary"
          }
        >
          {transfer.transferType}
        </Badge>
      ),
    },
    {
      key: "fromSite",
      header: "From Site",
      sortable: false,
      accessor: (transfer: AssetTransfer) => transfer.fromSite?.site || "-",
    },
    {
      key: "toSite",
      header: "To Site",
      sortable: false,
      accessor: (transfer: AssetTransfer) => transfer.toSite?.site || "-",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (transfer: AssetTransfer) => (
        <Badge
          variant="secondary"
          className={
            ASSET_TRANSFER_STATUS_COLORS[
              transfer.status as keyof typeof ASSET_TRANSFER_STATUS_COLORS
            ]
          }
        >
          {transfer.status}
        </Badge>
      ),
    },
    {
      key: "assetsCount",
      header: "Assets",
      sortable: false,
      accessor: (transfer: AssetTransfer) =>
        `${transfer.transferItems?.length || 0} asset${
          (transfer.transferItems?.length || 0) !== 1 ? "s" : ""
        }`,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      accessor: (transfer: AssetTransfer) =>
        new Date(transfer.createdAt).toLocaleDateString(),
    },
  ];

  if (error) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <div className="text-center text-red-600">
            Failed to load asset transfers. Please try again.
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
            <h1 className="text-2xl font-bold">Asset Transfers</h1>
            <p className="text-muted-foreground mt-1">
              Manage asset assignments and transfers between sites
            </p>
          </div>
          {canCreate && (
            <AppButton
              onClick={() => pushWithScrollSave("/asset-transfers/new")}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Transfer
            </AppButton>
          )}
        </div>
      </AppCard.Header>

      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search asset transfers"
            placeholder="Search by challan no, type, status, site, or remarks..."
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
              onClick={clearFilters}
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
          onSortChange={(s) => toggleSort(s.field)}
          renderRowActions={(transfer) => {
            const showActions = true; // Always show view action for users with read permission
            if (!showActions) return null;

            return (
              <div className="flex items-center gap-1">
                <EditButton
                  tooltip="View Transfer"
                  aria-label="View Transfer"
                  onClick={() =>
                    pushWithScrollSave(`/asset-transfers/${transfer.id}`)
                  }
                />
                {canApprove && transfer.status === "Pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(transfer.id, "Accepted")}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Accept Transfer"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(transfer.id, "Rejected")}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Reject Transfer"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDelete && transfer.status === "Pending" && (
                  <DeleteButton
                    onDelete={() => handleDelete(transfer.id)}
                    itemLabel="asset transfer"
                    title="Delete asset transfer?"
                    description={`This will permanently remove transfer ${transfer.challanNo}. This action cannot be undone.`}
                  />
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
  );
}
