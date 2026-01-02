"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { apiGet, apiDelete } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/common/pagination";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { FilterBar } from "@/components/common"; // filter layout wrapper
import { BulkEmployeesUploadDialog } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import type { Employee, EmployeesResponse } from "@/types/employees";
import type { DepartmentsResponse } from "@/types/departments";
import type { SitesResponse } from "@/types/sites";

export default function EmployeesPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    department: "",
    site: "",
    sort: "createdAt",
    order: "desc",
  });
  const { page, perPage, search, department, site, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      department: string;
      site: string;
      sort: string;
      order: "asc" | "desc";
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [departmentDraft, setDepartmentDraft] = useState(department);
  const [siteDraft, setSiteDraft] = useState(site);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  useEffect(() => {
    setDepartmentDraft(department);
  }, [department]);
  useEffect(() => {
    setSiteDraft(site);
  }, [site]);

  const filtersDirty =
    searchDraft !== search ||
    departmentDraft !== department ||
    siteDraft !== site;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      department: departmentDraft,
      site: siteDraft,
    });
  }

  function resetFilters() {
    setSearchDraft("");
    setDepartmentDraft("");
    setSiteDraft("");
    setQp({ page: 1, search: "", department: "", site: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (department) sp.set("department", department);
    if (site) sp.set("site", site);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/employees?${sp.toString()}`;
  }, [page, perPage, search, department, site, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<EmployeesResponse>(
    query,
    apiGet
  );

  // Fetch departments for filter dropdown
  const { data: departmentsData } = useSWR<DepartmentsResponse>(
    "/api/departments?perPage=100",
    apiGet
  );

  // Fetch sites for filter dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration("employees-list");

  if (error) {
    toast.error((error as Error).message || "Failed to load employees");
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  const columns: Column<Employee>[] = [
    {
      key: "employeeNumber",
      header: "Emp No",
      sortable: false,
      accessor: (r) => (r as any).employeeNumber || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (r) => r.name,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "designation",
      header: "Designation",
      sortable: false,
      accessor: (r) =>
        ((r as any).designation?.designationName as string) || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "joinDate",
      header: "Date of Joining",
      sortable: true,
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
      accessor: (r) =>
        (r as any).joinDate ? formatDate((r as any).joinDate) : "—",
    },
    {
      key: "mobile1",
      header: "Mobile 1",
      sortable: false,
      accessor: (r) => ((r as any).mobile1 as string) || "—",
      cellClassName: "whitespace-nowrap",
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/employees/${id}`);
      toast.success("Employee deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Employees</AppCard.Title>
        <AppCard.Description>Manage application employees.</AppCard.Description>
        <AppCard.Action className="flex flex-wrap gap-2">
          {can(PERMISSIONS.EDIT_EMPLOYEES) && (
            <>
              {/* <AppButton
                size="sm"
                variant="outline"
                iconName="Upload"
                type="button"
                onClick={() => setImportOpen(true)}
              >
                Import
              </AppButton> */}
              <AppButton
                size="sm"
                iconName="Plus"
                type="button"
                onClick={() => pushWithScrollSave("/employees/new")}
              >
                Add
              </AppButton>
            </>
          )}
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search employees"
            placeholder="Search employees..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppSelect
            value={departmentDraft || "__all"}
            onValueChange={(v) => setDepartmentDraft(v === "__all" ? "" : v)}
            placeholder="Department"
          >
            <AppSelect.Item value="__all">All Departments</AppSelect.Item>
            {departmentsData?.data?.map((dept) => (
              <AppSelect.Item key={dept.id} value={String(dept.id)}>
                {dept.department}
              </AppSelect.Item>
            ))}
          </AppSelect>
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
            disabled={
              !filtersDirty && !searchDraft && !departmentDraft && !siteDraft
            }
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {(search || department || site) && (
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
          renderRowActions={(employee) => {
            const canViewAssignedSites = can(
              PERMISSIONS.READ_MANPOWER_ASSIGNMENTS
            );
            const canAssignSites = can(PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS);
            const canEditEmployee = can(PERMISSIONS.EDIT_EMPLOYEES);
            const canDeleteEmployee = can(PERMISSIONS.DELETE_EMPLOYEES);

            if (
              !canViewAssignedSites &&
              !canAssignSites &&
              !canEditEmployee &&
              !canDeleteEmployee
            )
              return null;

            return (
              <div className="flex flex-wrap justify-end gap-2">
                {canEditEmployee && (
                  <EditButton
                    tooltip="Edit Employee"
                    aria-label="Edit Employee"
                    onClick={() =>
                      pushWithScrollSave(`/employees/${employee.id}/edit`)
                    }
                  />
                )}
                {canDeleteEmployee && (
                  <DeleteButton
                    onDelete={() => handleDelete(employee.id)}
                    itemLabel="employee"
                    title="Delete employee?"
                    description={`This will permanently remove employee #${employee.id}. This action cannot be undone.`}
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
      <BulkEmployeesUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onUploadSuccess={() => mutate()}
      />
    </AppCard>
  );
}
