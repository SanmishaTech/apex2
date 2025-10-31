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
import { formatDate } from "@/lib/locales";
import type { Employee } from "@/types/employees";

interface PageParams {
  id: string;
}

type PageProps = { params: Promise<PageParams> };

type SiteAssignment = NonNullable<Employee["siteEmployees"]>[number];
type SiteRow = SiteAssignment & { sr: number };

export default function EmployeeAssignedSitesPage({ params }: PageProps) {
  const { id } = use(params);
  const employeeId = Number(id);

  const { can } = usePermissions();
  const { pushAndRestoreKey } = useScrollRestoration("employees-list");

  const canViewSites = can(PERMISSIONS.READ_MANPOWER_ASSIGNMENTS);
  const canUnassignSites = can(PERMISSIONS.DELETE_MANPOWER_ASSIGNMENTS);

  const shouldFetch = canViewSites && Number.isFinite(employeeId);
  const { data, error, isLoading, mutate } = useSWR<Employee>(
    shouldFetch ? `/api/employees/${employeeId}` : null,
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
    setSelected({});
    setPage(1);
  }, [data?.siteEmployees]);

  useEffect(() => {
    setSiteFilterDraft(siteFilter);
  }, [siteFilter]);

  useEffect(() => {
    setCompanyFilterDraft(companyFilter);
  }, [companyFilter]);

  useEffect(() => {
    setPage(1);
  }, [siteFilter, companyFilter]);

  const employeeName = data?.name;
  const baseAssignments = (data?.siteEmployees ?? []) as SiteAssignment[];

  const companyOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const assignment of baseAssignments) {
      const company = assignment.site?.company;
      if (company?.id && !map.has(company.id)) {
        map.set(company.id, {
          id: company.id,
          name: company.companyName,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [baseAssignments]);

  const filteredAssignments = useMemo<SiteRow[]>(() => {
    const term = siteFilter.trim().toLowerCase();
    const list = term
      ? baseAssignments.filter((assignment) => {
          const siteName = assignment.site?.site?.toLowerCase() ?? "";
          const shortName = assignment.site?.shortName?.toLowerCase() ?? "";
          return siteName.includes(term) || shortName.includes(term);
        })
      : baseAssignments;
    const byCompany =
      companyFilter !== "__all"
        ? list.filter(
            (assignment) =>
              assignment.site?.company?.id === Number(companyFilter)
          )
        : list;
    return byCompany.map((assignment, index) => ({
      ...assignment,
      sr: index + 1,
    }));
  }, [baseAssignments, siteFilter, companyFilter]);

  const totalFiltered = filteredAssignments.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage) || 1);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedAssignments = useMemo<SiteRow[]>(() => {
    const start = (page - 1) * perPage;
    return filteredAssignments.slice(start, start + perPage);
  }, [filteredAssignments, page, perPage]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const allSelected =
    filteredAssignments.length > 0 &&
    filteredAssignments.every((row) => selected[row.id]);

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of filteredAssignments) {
        if (checked) {
          next[row.id] = true;
        } else {
          delete next[row.id];
        }
      }
      return next;
    });
  }

  async function unassignSelected() {
    if (!canUnassignSites) return;
    if (!Number.isFinite(employeeId)) {
      toast.error("Invalid employee identifier");
      return;
    }

    const selectedIds = Object.entries(selected)
      .filter(([, value]) => value)
      .map(([key]) => Number(key));

    if (selectedIds.length === 0) {
      toast.error("Select at least one site to unassign");
      return;
    }

    const remainingSiteIds = baseAssignments
      .filter((assignment) => !selectedIds.includes(assignment.id))
      .map((assignment) => assignment.siteId);

    try {
      await apiPatch(`/api/employees/${employeeId}`, {
        siteId: remainingSiteIds,
      });
      toast.success("Selected sites unassigned");
      setSelected({});
      await mutate();
    } catch (err) {
      toast.error((err as Error).message || "Failed to unassign sites");
    }
  }

  if (error) {
    toast.error((error as Error).message || "Failed to load assigned sites");
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

  const columns: Column<SiteRow>[] = [
    {
      key: "select",
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allSelected}
            disabled={filteredAssignments.length === 0}
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
          aria-label={`Select site ${row.site?.site ?? row.siteId}`}
          checked={!!selected[row.id]}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setSelected((prev) => {
              const next = { ...prev };
              if (checked) {
                next[row.id] = true;
              } else {
                delete next[row.id];
              }
              return next;
            });
          }}
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
      accessor: (row) => row.site?.site ?? "—",
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "company",
      header: "Company",
      accessor: (row) => row.site?.company?.companyName ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "siteShortName",
      header: "Short Name",
      accessor: (row) => row.site?.shortName ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "assignedDate",
      header: "Assigned On",
      accessor: (row) =>
        row.assignedDate ? formatDate(row.assignedDate) : "—",
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
  ];

  const filtersDirty =
    siteFilterDraft.trim() !== siteFilter.trim() ||
    companyFilterDraft !== companyFilter;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assigned Sites</AppCard.Title>
        <AppCard.Description>
          {employeeName
            ? `Sites currently assigned to ${employeeName}.`
            : "Sites currently assigned to this employee."}
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
            {companyOptions.map((company) => (
              <AppSelect.Item key={company.id} value={String(company.id)}>
                {company.name}
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
        <DataTable<SiteRow>
          columns={columns}
          data={pagedAssignments}
          loading={isLoading}
          stickyColumns={2}
          simpleStyle
          emptyMessage={siteFilter ? "No sites matched your filter" : "No sites assigned"}
        />
      </AppCard.Content>
      <AppCard.Footer className="flex justify-between gap-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalFiltered}
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
            Selected: {selectedCount} • Total Assigned: {baseAssignments.length}
          </div>
          {canUnassignSites && (
            <AppButton
              variant="destructive"
              onClick={unassignSelected}
              disabled={selectedCount === 0 || isLoading}
            >
              Unassign Selected
            </AppButton>
          )}
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
