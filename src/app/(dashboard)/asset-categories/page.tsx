"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet, apiDelete } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";

import { FilterBar, AppSelect } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import { BulkAssetCategoriesUploadDialog } from "@/components/common/bulk-asset-categories-upload-dialog";

// Types

type AssetCategoryListItem = {
  id: number;
  category: string;
  assetGroupId: number;
  assetGroup: {
    assetGroupName: string;
  };
  createdAt: string;
  updatedAt: string;
};

type AssetCategoriesResponse = {
  data: AssetCategoryListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type AssetGroup = {
  id: number;
  assetGroupName: string;
};

export default function AssetCategoriesPage() {
  const { pushWithScrollSave } = useScrollRestoration("asset-categories-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "category",
    order: "asc",

    assetGroupId: "",
  });
  const { page, perPage, search, sort, order, assetGroupId } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: "asc" | "desc";

      assetGroupId: string;
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const [assetGroupIdDraft, setAssetGroupIdDraft] = useState(assetGroupId);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);

    setAssetGroupIdDraft(assetGroupId);
  }, [search, assetGroupId]);

  const filtersDirty =
    searchDraft !== search || assetGroupIdDraft !== assetGroupId;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      assetGroupId: assetGroupIdDraft,
    });
  }

  function resetFilters() {
    setSearchDraft("");

    setAssetGroupIdDraft("");
    setQp({ page: 1, search: "", assetGroupId: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);

    if (assetGroupId) sp.set("assetGroupId", assetGroupId);
    return `/api/asset-categories?${sp.toString()}`;
  }, [page, perPage, search, sort, order, assetGroupId]);

  const { data, error, isLoading, mutate } = useSWR<AssetCategoriesResponse>(
    query,
    apiGet
  );

  // Fetch asset groups for the dropdown
  const { data: assetGroups } = useSWR<{ data: AssetGroup[] }>(
    "/api/asset-groups?perPage=100",
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || "Failed to load asset categories");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<AssetCategoryListItem>[] = [
    {
      key: "category",
      header: "Category",
      sortable: true,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "assetGroup",
      header: "Asset Group",
      sortable: false,
      cellClassName: "text-muted-foreground whitespace-nowrap",

      accessor: (r) => r.assetGroup.assetGroupName,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) => formatDate(r.createdAt),
    },

    {
      key: "updatedAt",
      header: "Updated",
      sortable: false,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) => formatRelativeTime(r.updatedAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/asset-categories/${id}`);
      toast.success("Asset category deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Asset Categories</AppCard.Title>

        <AppCard.Description>Manage asset categories.</AppCard.Description>
        {can(PERMISSIONS.CREATE_ASSET_CATEGORIES) && (
          <AppCard.Action>
            <AppButton
              size="sm"
              iconName="Plus"
              type="button"
              onClick={() => pushWithScrollSave("/asset-categories/new")}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search asset categories"
            placeholder="Search categories..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />

          <AppSelect
            value={assetGroupIdDraft || "all"}
            onValueChange={(value) =>
              setAssetGroupIdDraft(value === "all" ? "" : value)
            }
            placeholder="All Asset Groups"
            className="min-w-[160px]"
          >
            <AppSelect.Item value="all">All Asset Groups</AppSelect.Item>
            {assetGroups?.data?.map((group) => (
              <AppSelect.Item key={group.id} value={String(group.id)}>
                {group.assetGroupName}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !assetGroupIdDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>

          {/* {can(PERMISSIONS.EDIT_ASSET_CATEGORIES) && (
            <AppButton
              variant='outline'
              size='sm'
              onClick={() => setUploadDialogOpen(true)}
              iconName='Upload'
              className='min-w-[84px]'
            >
              Upload
            </AppButton>
          )} */}

          {(search || assetGroupId) && (
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
        <BulkAssetCategoriesUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadSuccess={() => mutate()}
        />

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (
              !can(PERMISSIONS.EDIT_ASSET_CATEGORIES) &&
              !can(PERMISSIONS.DELETE_ASSET_CATEGORIES)
            )
              return null;
            return (
              <div className="flex">
                {can(PERMISSIONS.EDIT_ASSET_CATEGORIES) && (
                  <EditButton
                    tooltip="Edit Asset Category"
                    aria-label="Edit Asset Category"
                    onClick={() =>
                      pushWithScrollSave(`/asset-categories/${row.id}/edit`)
                    }
                  />
                )}
                {can(PERMISSIONS.DELETE_ASSET_CATEGORIES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="asset category"
                    title="Delete asset category?"
                    description={`This will permanently remove asset category "${row.category}". This action cannot be undone.`}
                  />
                )}
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
