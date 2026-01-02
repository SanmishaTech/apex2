"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { AppButton, AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { FilterBar } from "@/components/common/filter-bar";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { DeleteButton } from "@/components/common/delete-button";
import { SortState } from "@/components/common/data-table";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { apiGet, apiDelete } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import { BulkVendorsUploadDialog } from "@/components/common/bulk-vendors-upload-dialog";

// Types
type VendorListItem = {
  id: number;
  vendorName: string;
  contactPerson: string | null;
  addressLine1: string;
  addressLine2: string | null;
  state?: {
    state: string;
  } | null;
  city?: {
    city: string;
  } | null;
  pincode: string | null;
  mobile1: string | null;
  mobile2: string | null;
  email: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  itemCategory?: {
    itemCategory: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type VendorsResponse = {
  data: VendorListItem[];
  meta: {
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function VendorsPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    sort: "vendorName",
    order: "asc",
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
    return `/api/vendors?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<VendorsResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || "Failed to load vendors");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<VendorListItem>[] = [
    {
      key: "vendorName",
      header: "Vendor Name",
      sortable: true,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.contactPerson || "-",
    },
    {
      key: "address",
      header: "Address",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => {
        const parts = [r.addressLine1, r.addressLine2].filter(Boolean);
        return parts.join(", ");
      },
    },
    {
      key: "state",
      header: "State",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.state?.state || "-",
    },
    {
      key: "city",
      header: "City",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.city?.city || "-",
    },
    {
      key: "mobile1",
      header: "Mobile",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.mobile1 || "-",
    },
    {
      key: "email",
      header: "Email",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.email || "-",
    },
    {
      key: "gstNumber",
      header: "GST Number",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.gstNumber || "-",
    },
    {
      key: "itemCategory",
      header: "Category",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      accessor: (r) => r.itemCategory?.itemCategory || "-",
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
      await apiDelete(`/api/vendors/${id}`);
      toast.success("Vendor deleted");
      await mutate();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete vendor");
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Vendors</AppCard.Title>
        <AppCard.Description>Manage vendor information.</AppCard.Description>
        {can(PERMISSIONS.CREATE_VENDORS) && (
          <AppCard.Action>
            <div className="flex gap-2">
              {/* <AppButton
                size="sm"
                variant="outline"
                iconName="Upload"
                type="button"
                onClick={() => setImportOpen(true)}
              >
                Import
              </AppButton> */}
              <Link href="/vendors/new">
                <AppButton size="sm" iconName="Plus" type="button">
                  Add
                </AppButton>
              </Link>
            </div>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search vendors"
            placeholder="Search by vendor name..."
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
          data={data?.data || []}
          columns={columns}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          loading={isLoading}
          emptyMessage="No vendors found"
          renderRowActions={(vendor) => {
            return (
              <div className="flex items-center gap-2">
                {can(PERMISSIONS.EDIT_VENDORS) && (
                  <Link href={`/vendors/${vendor.id}/edit`}>
                    <EditButton
                      tooltip="Edit Vendor"
                      aria-label="Edit Vendor"
                    />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_VENDORS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(vendor.id)}
                    itemLabel="vendor"
                    title="Delete vendor?"
                    description={`This will permanently remove ${vendor.vendorName}. This action cannot be undone.`}
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
      <BulkVendorsUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onUploadSuccess={() => mutate()}
      />
    </AppCard>
  );
}
