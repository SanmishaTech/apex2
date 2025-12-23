"use client";

import { use } from "react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { AppCard } from "@/components/common/app-card";
import { FilterBar } from "@/components/common";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { AppButton } from "@/components/common/app-button";
import { DataTable, Column, SortState } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import type { SitesResponse } from "@/types/sites";
import { useRouter } from "next/navigation";

interface AssignRow {
  id: number;
  name: string;
  user?: { id?: number; email?: string | null } | null;
  department?: { id: number; department: string } | null;
}

type AssignQ = {
  page: number;
  perPage: number;
  name: string;
  sort: string;
  order: "asc" | "desc";
};

type PageProps = { params: Promise<{ id: string }> };

export default function AssignEmployeesPage({ params }: PageProps) {
  const { id } = use(params);
  const siteId = Number(id);
  const { can } = usePermissions();
  const { pushAndRestoreKey } = useScrollRestoration("assign-employees-assign");
  const router = useRouter();

  const [qp, setQp] = useQueryParamsState<AssignQ>({
    page: 1,
    perPage: 10,
    name: "",
    sort: "name",
    order: "asc",
  } as any);
  const { page, perPage, name, sort, order } = qp;

  const [nameDraft, setNameDraft] = useState(name);
  useEffect(() => setNameDraft(name), [name]);

  const filtersDirty = nameDraft !== name;

  const employeesQuery = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("mode", "available");
    sp.set("siteId", String(siteId));
    if (name) sp.set("search", name);
    // Fetch all matching rows, paginate client-side
    sp.set("page", "1");
    sp.set("perPage", "10000");
    sp.set("sort", sort);
    sp.set("order", order);
    return `/api/employee-assignments?${sp.toString()}`;
  }, [siteId, name, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<{
    data: AssignRow[];
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  }>(employeesQuery, apiGet);
  const allRows: AssignRow[] = data?.data || [];
  const totalAvailable = allRows.length;
  const start = (page - 1) * perPage;
  const pageRows: AssignRow[] = allRows.slice(start, start + perPage);
  const totalPages = Math.max(1, Math.ceil(totalAvailable / perPage));

  // Fetch site name for header context
  const { data: siteResp } = useSWR<SitesResponse>(
    Number.isFinite(siteId) ? `/api/sites?id=${siteId}&perPage=1` : null,
    apiGet
  );
  const siteName = siteResp?.data?.[0]?.site;

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  useEffect(() => setSelected({}), [employeesQuery]);

  function applyFilters() {
    setQp({ page: 1, name: nameDraft.trim() } as any);
  }
  function resetFilters() {
    setNameDraft("");
    setQp({ page: 1, name: "" } as any);
  }
  function toggleSort(field: string) {
    setQp(
      sort === field
        ? ({ order: order === "asc" ? "desc" : "asc" } as any)
        : ({ sort: field, order: "asc" } as any)
    );
  }

  const columns: Column<AssignRow>[] = [
    {
      key: "select",
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label="Select all available"
            checked={allRows.length > 0 && allRows.every((r) => selected[r.id])}
            disabled={allRows.length === 0}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setSelected((prev) => {
                const next = { ...prev } as Record<number, boolean>;
                for (const r of allRows) {
                  if (checked) next[r.id] = true;
                  else delete next[r.id];
                }
                return next;
              });
            }}
          />
        </div>
      ),
      sortable: false,
      className: "w-[72px] text-center",
      cellClassName: "text-center",
      accessor: (r) => (
        <input
          type="checkbox"
          checked={!!selected[r.id]}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setSelected((p) => ({ ...p, [r.id]: checked }));
          }}
        />
      ),
    },
    { key: "name", header: "Employee", sortable: true },
    {
      key: "email",
      header: "Email",
      sortable: false,
      accessor: (r: any) => r.user?.email ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "department",
      header: "Department",
      sortable: false,
      accessor: (r: any) => r.department?.department ?? "—",
      className: "whitespace-nowrap",
    },
  ];

  const sortState: SortState = { field: sort, order };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  async function handleAssign() {
    const employeeIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (employeeIds.length === 0) {
      toast.error("Select at least one employee");
      return;
    }
    try {
      await apiPost("/api/employee-assignments", { siteId, employeeIds });
      toast.success("Employees assigned");
      setSelected({});
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign");
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assign Employees</AppCard.Title>
        <AppCard.Description>
          {siteName
            ? `Select employees to assign to ${siteName}.`
            : "Select employees to assign to this site."}
        </AppCard.Description>
        <AppCard.Action>
          <AppButton
            size="sm"
            variant="secondary"
            onClick={() => router.push("/assign-employees")}
          >
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Filters">
          <NonFormTextInput
            aria-label="Employee name"
            placeholder="Employee name..."
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !nameDraft}
            className="min-w-[84px]"
          >
            Search
          </AppButton>
          {name && (
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
          data={pageRows}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-between flex-col sm:flex-row gap-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalAvailable}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val } as any)}
          onPageChange={(p) => setQp({ page: p } as any)}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Selected: {selectedCount} • Total Available: {totalAvailable}
          </div>
          {can(PERMISSIONS.EDIT_EMPLOYEES) && (
            <AppButton
              onClick={handleAssign}
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
