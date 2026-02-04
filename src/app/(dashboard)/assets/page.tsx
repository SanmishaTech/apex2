"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { AppCard } from "@/components/common/app-card";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common";
import { TextInput } from "@/components/common/text-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
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
import { apiDelete } from "@/lib/api-client";
import { Asset, AssetsResponse, ASSET_STATUS_OPTIONS } from "@/types/assets";
import { BulkAssetsUploadDialog } from "@/components/common/bulk-assets-upload-dialog";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FilterValues = {
  search: string;
  status: string[];
  assetGroupId: string[];
  site: string[];
};

export default function AssetsPage() {
  useProtectPage();
  const { pushWithScrollSave } = useScrollRestoration("assets-list");

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    status: "",
    assetGroupId: "",
    site: "",
    sort: "createdAt",
    order: "desc",
  });
  const { page, perPage, search, status, assetGroupId, site, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      status: string;
      assetGroupId: string;
      site: string;
      sort: string;
      order: "asc" | "desc";
    };

  const form = useForm<FilterValues>({
    mode: "onChange",
    defaultValues: {
      search: search || "",
      status: status ? status.split(",").filter(Boolean) : [],
      assetGroupId: assetGroupId ? assetGroupId.split(",").filter(Boolean) : [],
      site: site ? site.split(",").filter(Boolean) : [],
    },
  });

  const { control, reset, getValues, watch } = form;
  const watched = watch();

  useEffect(() => {
    reset({
      search: search || "",
      status: status ? status.split(",").filter(Boolean) : [],
      assetGroupId: assetGroupId ? assetGroupId.split(",").filter(Boolean) : [],
      site: site ? site.split(",").filter(Boolean) : [],
    });
  }, [search, status, assetGroupId, site, reset]);

  const filtersDirty = useMemo(() => {
    const v = watched;
    const statusCsv = (v.status || []).filter(Boolean).join(",");
    const assetGroupCsv = (v.assetGroupId || []).filter(Boolean).join(",");
    const siteCsv = (v.site || []).filter(Boolean).join(",");
    return (
      (v.search || "") !== (search || "") ||
      statusCsv !== (status || "") ||
      assetGroupCsv !== (assetGroupId || "") ||
      siteCsv !== (site || "")
    );
  }, [watched, search, status, assetGroupId, site]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  function applyFilters() {
    const v = getValues();
    setQp({
      page: 1,
      search: (v.search || "").trim(),
      status: (v.status || []).filter(Boolean).join(","),
      assetGroupId: (v.assetGroupId || []).filter(Boolean).join(","),
      site: (v.site || []).filter(Boolean).join(","),
    });
  }

  function clearFilters() {
    reset({ search: "", status: [], assetGroupId: [], site: [] });
    setQp({ page: 1, search: "", status: "", assetGroupId: "", site: "" });
  }

  const { can } = usePermissions();

  const canEdit = can(PERMISSIONS.EDIT_ASSETS);
  const canCreate = can(PERMISSIONS.CREATE_ASSETS);
  const canDelete = can(PERMISSIONS.DELETE_ASSETS);

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    sort,
    order,
    ...(search && { search }),
    ...(status && { status }),
    ...(assetGroupId && { assetGroupId }),
    ...(site && { currentSiteId: site }),
  });

  const { data, error, isLoading, mutate } = useSWR<AssetsResponse>(
    `/api/assets?${queryParams}`,
    fetcher
  );

  // Fetch sites for filter dropdown
  const { data: sitesData } = useSWR<{ data: { id: number; site: string }[] }>(
    "/api/sites/options",
    fetcher
  );

  const { data: assetGroupsData } = useSWR<{ data: { id: number; assetGroupName: string }[] }>(
    "/api/asset-groups?perPage=1000",
    fetcher
  );

  const siteOptions = useMemo(
    () =>
      (sitesData?.data || []).map((s) => ({
        value: String(s.id),
        label: s.site,
      })),
    [sitesData]
  );

  const statusOptions = useMemo(
    () =>
      (ASSET_STATUS_OPTIONS || []).map((o) => ({
        value: String(o.value),
        label: String(o.label),
      })),
    []
  );

  const assetGroupOptions = useMemo(
    () =>
      (assetGroupsData?.data || []).map((g) => ({
        value: String(g.id),
        label: g.assetGroupName,
      })),
    [assetGroupsData]
  );

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      if (status) sp.set("status", status);
      if (assetGroupId) sp.set("assetGroupId", assetGroupId);
      if (site) sp.set("currentSiteId", site);
      if (sort) sp.set("sort", sort);
      if (order) sp.set("order", order);

      const url = `/api/assets/export?${sp.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast.error(`Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `assets_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast.error(e?.message || "Failed to export assets");
    } finally {
      setExporting(false);
    }
  }

  const sortState: SortState = { field: sort, order };

  function toggleSort(field: string) {
    const newOrder = sort === field && order === "asc" ? "desc" : "asc";
    setQp({ sort: field, order: newOrder });
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/assets/${id}`);
      toast.success("Asset deleted successfully");
      mutate(); // Refresh the data
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete asset"
      );
    }
  };

  const columns = [
    {
      key: "assetNo",
      header: "Asset No",
      sortable: true,
      accessor: (asset: Asset) => (
        <span className="font-medium text-blue-600">{asset.assetNo}</span>
      ),
    },
    {
      key: "assetName",
      header: "Asset Name",
      sortable: true,
      accessor: (asset: Asset) => (
        <div>
          <div className="font-medium">{asset.assetName}</div>
          {asset.make && (
            <div className="text-sm text-muted-foreground">{asset.make}</div>
          )}
        </div>
      ),
    },
    {
      key: "assetGroup",
      header: "Asset Group",
      sortable: false,
      accessor: (asset: Asset) => asset.assetGroup?.assetGroupName || "-",
    },
    {
      key: "assetCategory",
      header: "Asset Category",
      sortable: false,
      accessor: (asset: Asset) => asset.assetCategory?.category || "-",
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (asset: Asset) => asset.currentSite?.site || "-",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (asset: Asset) => (
        <Badge
          variant={asset.status === "Working" ? "default" : "secondary"}
          className={
            asset.status === "Working" ? "bg-green-100 text-green-800" : ""
          }
        >
          {asset.status}
        </Badge>
      ),
    },
    {
      key: "useStatus",
      header: "Use Status",
      sortable: true,
      accessor: (asset: Asset) => (
        <Badge
          variant={asset.useStatus === "In Use" ? "default" : "secondary"}
          className={
            asset.useStatus === "In Use"
              ? "bg-blue-100 text-blue-800"
              : "bg-orange-100 text-orange-800"
          }
        >
          {asset.useStatus}
        </Badge>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      sortable: true,
      accessor: (asset: Asset) => asset.supplier || "-",
    },
    {
      key: "purchaseDate",
      header: "Purchase Date",
      sortable: true,
      accessor: (asset: Asset) =>
        asset.purchaseDate
          ? new Date(asset.purchaseDate).toLocaleDateString()
          : "-",
    },
  ];

  if (error) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <div className="text-center text-red-600">
            Failed to load assets. Please try again.
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Assets</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization's assets
            </p>
          </div>
          {canCreate && (
            <AppButton
              onClick={() => pushWithScrollSave("/assets/new")}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </AppButton>
          )}
        </div>
        </AppCard.Header>

        <AppCard.Content>
          <FilterBar title="Search & Filter">
            <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-2">
              <TextInput
                control={control}
                name="search"
                placeholder="Search by asset number, name, make, or supplier..."
                span={4}
                spanFrom="md"
                className="h-9"
              />
              <MultiSelectInput
                control={control}
                name="status"
                label="Status"
                placeholder="Select status..."
                options={statusOptions}
                size="sm"
                span={4}
                spanFrom="md"
              />
              <MultiSelectInput
                control={control}
                name="assetGroupId"
                label="Asset"
                placeholder="Select asset group..."
                options={assetGroupOptions}
                size="sm"
                span={4}
                spanFrom="md"
              />
              <MultiSelectInput
                control={control}
                name="site"
                label="Sites"
                placeholder="Select sites..."
                options={siteOptions}
                size="sm"
                span={4}
                spanFrom="md"
              />
            </div>
            <AppButton
              size="sm"
              onClick={applyFilters}
              disabled={!filtersDirty}
              className="min-w-21"
              type="button"
            >
              Filter
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleExport}
              iconName="Download"
              className="min-w-21"
              disabled={exporting}
              type="button"
            >
              Export
            </AppButton>
          {/* <AppButton
            variant='outline'
            size='sm'
            onClick={() => setUploadDialogOpen(true)}
            iconName='Upload'
            className='min-w-21'
          >
            Upload
          </AppButton> */}
            {(search || status || assetGroupId || site) && (
              <AppButton
                variant="secondary"
                size="sm"
                onClick={clearFilters}
                className="min-w-21"
                type="button"
              >
                Reset
              </AppButton>
            )}
          </FilterBar>

        <BulkAssetsUploadDialog
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
            renderRowActions={(asset) => {
              if (!canEdit && !canDelete) return null;
              return (
                <div className="flex">
                  {canEdit && (
                    <EditButton
                      tooltip="Edit Asset"
                      aria-label="Edit Asset"
                      onClick={() =>
                        pushWithScrollSave(`/assets/${asset.id}/edit`)
                      }
                    />
                  )}
                  {canDelete && (
                    <DeleteButton
                      onDelete={() => handleDelete(asset.id)}
                      itemLabel="asset"
                      title="Delete asset?"
                      description={`This will permanently remove asset ${asset.assetName}. This action cannot be undone.`}
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
    </Form>
  );
}
