"use client";

import { use, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, type Column } from "@/components/common/data-table";
import { FilterBar } from "@/components/common";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppSelect } from "@/components/common/app-select";
import { Pagination } from "@/components/common/pagination";
import { toast } from "@/lib/toast";
import { apiGet, apiPatch } from "@/lib/api-client";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import type { Employee } from "@/types/employees";
import type { SitesResponse } from "@/types/sites";

interface PageParams {
  id: string;
}

type PageProps = { params: Promise<PageParams> };

type SiteRow = SitesResponse["data"][number];
type TableRow = SiteRow & { sr: number; assigned: boolean };

type CompaniesResponse = {
  data: {
    id: number;
    companyName: string;
    shortName?: string | null;
  }[];
};

export default function EmployeeAssignSitesPage({ params }: PageProps) {
  const { id } = use(params);
  const employeeId = Number(id);

  const { can } = usePermissions();
  const { pushAndRestoreKey } = useScrollRestoration("employees-list");

  const canViewSites = can(PERMISSIONS.READ_MANPOWER_ASSIGNMENTS);
  const canAssignSites = can(PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS);

  const shouldFetchEmployee = canViewSites && Number.isFinite(employeeId);
  const {
    data: employee,
    error: employeeError,
    isLoading: employeeLoading,
    mutate: mutateEmployee,
  } = useSWR<Employee>(
    shouldFetchEmployee ? `/api/employees/${employeeId}` : null,
    apiGet
  );

  const [siteFilterDraft, setSiteFilterDraft] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [companyFilterDraft, setCompanyFilterDraft] = useState("__all");
  const [companyFilter, setCompanyFilter] = useState("__all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setSiteFilterDraft(siteFilter);
  }, [siteFilter]);

  useEffect(() => {
    setCompanyFilterDraft(companyFilter);
  }, [companyFilter]);

  useEffect(() => {
    setPage(1);
  }, [siteFilter, companyFilter]);

  const sitesQuery = useMemo(() => {
    const sp = new URLSearchParams();
    // Fetch a large page and paginate client-side to show full totals like Assigned Sites
    sp.set("perPage", String(1000));
    if (siteFilter) sp.set("search", siteFilter);
    if (companyFilter !== "__all") sp.set("companyId", companyFilter);
    sp.set("sort", "site");
    sp.set("order", "asc");
    return `/api/sites?${sp.toString()}`;
  }, [siteFilter, companyFilter]);

  const {
    data: sitesData,
    error: sitesError,
    isLoading: sitesLoading,
  } = useSWR<SitesResponse>(sitesQuery, apiGet);

  const { data: companiesData } = useSWR<CompaniesResponse>(
    `/api/companies?perPage=1000`,
    apiGet
  );

  const assignedSiteIds = useMemo(() => {
    const ids = new Set<number>();
    if (employee?.siteEmployees) {
      for (const assignment of employee.siteEmployees) {
        ids.add(assignment.siteId);
      }
    }
    return ids;
  }, [employee?.siteEmployees]);

  useEffect(() => {
    setSelected((prev) => {
      if (!employee?.siteEmployees) return prev;
      const next = { ...prev };
      for (const assignment of employee.siteEmployees) {
        delete next[assignment.siteId];
      }
      return next;
    });
  }, [employee?.siteEmployees]);

  if (employeeError) {
    toast.error(
      (employeeError as Error).message || "Failed to load employee details"
    );
  }
  if (sitesError) {
    toast.error((sitesError as Error).message || "Failed to load sites");
  }

  if (!canViewSites) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className="py-8 text-center text-muted-foreground">
            You do not have permission to view site assignments.
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  const rows = sitesData?.data ?? [];
  const unassignedRows = rows.filter((row) => !assignedSiteIds.has(row.id));
  const total = unassignedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const pageRows = unassignedRows.slice(start, start + perPage);
  const tableRows: TableRow[] = pageRows.map((row, index) => ({
    ...row,
    sr: start + index + 1,
    assigned: false,
  }));

  // totals computed above using full unassignedRows

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );
  const totalAssigned = assignedSiteIds.size;

  const allSelectableChecked = tableRows.every((row) => selected[row.id]);

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of tableRows) {
        if (checked) {
          next[row.id] = true;
        } else {
          delete next[row.id];
        }
      }
      return next;
    });
  }

  function toggleSelect(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }

  async function handleAssignSelected() {
    if (!canAssignSites) return;
    if (!Number.isFinite(employeeId)) {
      toast.error("Invalid employee identifier");
      return;
    }

    const selectedIds = Object.entries(selected)
      .filter(([, value]) => value)
      .map(([key]) => Number(key));

    if (selectedIds.length === 0) {
      toast.error("Select at least one site to assign");
      return;
    }

    const combined = new Set<number>(assignedSiteIds);
    for (const siteId of selectedIds) {
      combined.add(siteId);
    }

    try {
      await apiPatch(`/api/employees/${employeeId}`, {
        siteId: Array.from(combined),
      });
      toast.success("Sites assigned");
      setSelected({});
      await mutateEmployee();
    } catch (err) {
      toast.error((err as Error).message || "Failed to assign sites");
    }
  }

  const filtersDirty =
    siteFilterDraft.trim() !== siteFilter.trim() ||
    companyFilterDraft !== companyFilter;

  const columns: Column<TableRow>[] = [
    {
      key: "select",
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label="Select all available"
            checked={tableRows.length > 0 && allSelectableChecked}
            disabled={tableRows.length === 0}
            onChange={(event) => toggleSelectAll(event.currentTarget.checked)}
          />
        </div>
      ),
      sortable: false,
      className: "w-16 text-center",
      cellClassName: "text-center",
      accessor: (row) => (
        <input
          type="checkbox"
          aria-label={`Select site ${row.site}`}
          checked={!!selected[row.id]}
          onChange={(event) =>
            toggleSelect(row.id, event.currentTarget.checked)
          }
        />
      ),
    },
    {
      key: "sr",
      header: "Sr. No.",
      accessor: (row) => row.sr,
      className: "w-20 whitespace-nowrap",
    },
    {
      key: "site",
      header: "Site",
      accessor: (row) => row.site,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "company",
      header: "Company",
      accessor: (row) => row.company?.companyName ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "siteShortName",
      header: "Short Name",
      accessor: (row) => row.shortName ?? "—",
      className: "whitespace-nowrap",
    },
  ];

  const isLoading = employeeLoading || sitesLoading;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assign Sites</AppCard.Title>
        <AppCard.Description>
          {employee?.name
            ? `Select sites to assign to ${employee.name}.`
            : "Select sites to assign to this employee."}
        </AppCard.Description>
        <AppCard.Action>
          <AppButton
            size="sm"
            variant="secondary"
            onClick={() => pushAndRestoreKey("employees-list")}
          >
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Filters">
          <NonFormTextInput
            label="Site name"
            aria-label="Site name"
            placeholder="Filter by site name..."
            value={siteFilterDraft}
            onChange={(event) => setSiteFilterDraft(event.target.value)}
            containerClassName="w-full"
          />
          <AppSelect
            label="Company"
            value={companyFilterDraft}
            onValueChange={(value) =>
              setCompanyFilterDraft(value === "__all" ? "__all" : value)
            }
            placeholder="Company"
          >
            <AppSelect.Item value="__all">All Companies</AppSelect.Item>
            {companiesData?.data?.map((company) => (
              <AppSelect.Item key={company.id} value={String(company.id)}>
                {company.companyName}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppButton
            size="sm"
            onClick={() => {
              setSiteFilter(siteFilterDraft.trim());
              setCompanyFilter(companyFilterDraft);
            }}
            disabled={!filtersDirty}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {(siteFilter || companyFilter !== "__all") && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setSiteFilter("");
                setSiteFilterDraft("");
                setCompanyFilter("__all");
                setCompanyFilterDraft("__all");
                setPage(1);
              }}
              className="min-w-[84px]"
            >
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable<TableRow>
          columns={columns}
          data={tableRows}
          loading={isLoading}
          stickyColumns={2}
          simpleStyle
          emptyMessage={
            siteFilter ? "No sites matched your filter" : "No sites available"
          }
        />
      </AppCard.Content>
      <AppCard.Footer className="flex justify-between gap-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
          disabled={isLoading}
          showPageNumbers
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Selected: {selectedCount} • Already Assigned: {totalAssigned}
          </div>
          {canAssignSites && (
            <AppButton
              onClick={handleAssignSelected}
              disabled={selectedCount === 0 || isLoading}
            >
              Assign Selected
            </AppButton>
          )}
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
