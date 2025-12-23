"use client";

import { use } from "react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, type Column } from "@/components/common/data-table";
import { FilterBar } from "@/components/common";
import { NonFormTextInput } from "@/components/common/non-form-text-input";
import { Pagination } from "@/components/common/pagination";
import { toast } from "@/lib/toast";
import { apiGet, apiDelete } from "@/lib/api-client";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useRouter } from "next/navigation";

interface PageParams {
  id: string;
}

type PageProps = { params: Promise<PageParams> };

type AssignedRow = {
  id: number;
  name: string;
  department?: { id: number; department: string } | null;
  siteEmployees?: { id: number; assignedDate: Date }[];
};

type AssignedResponse = {
  data: AssignedRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function SiteAssignedEmployeesPage({ params }: PageProps) {
  const { id } = use(params);
  const siteId = Number(id);

  const { can } = usePermissions();
  const { pushAndRestoreKey } = useScrollRestoration("assign-employees-sites");
  const router = useRouter();

  const canUnassign = can(PERMISSIONS.EDIT_EMPLOYEES);

  const [nameDraft, setNameDraft] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => setNameDraft(name), [name]);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("mode", "assigned");
    sp.set("siteId", String(siteId));
    if (name) sp.set("search", name);
    // fetch all and paginate client-side
    sp.set("page", "1");
    sp.set("perPage", "10000");
    return `/api/employee-assignments?${sp.toString()}`;
  }, [siteId, name]);

  const { data, error, isLoading, mutate } = useSWR<AssignedResponse>(
    query,
    apiGet
  );
  const allRows = data?.data ?? [];

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  useEffect(() => setSelected({}), [query]);

  if (error) {
    toast.error(
      (error as Error).message || "Failed to load assigned employees"
    );
  }

  const start = (page - 1) * perPage;
  const pageRows = allRows.slice(start, start + perPage);
  const totalAvailable = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalAvailable / perPage));
  const tableRows = useMemo(() => {
    return pageRows.map((row, index) => ({ ...row, sr: start + index + 1 }));
  }, [pageRows, start]);

  type TableRow = AssignedRow & { sr: number };

  const columns: Column<TableRow>[] = [
    {
      key: "select",
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label="Select all"
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
      className: "w-16 text-center",
      cellClassName: "text-center",
      accessor: (row) => (
        <input
          type="checkbox"
          aria-label={`Select employee ${row.name}`}
          checked={!!selected[row.id]}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setSelected((prev) => ({ ...prev, [row.id]: checked }));
          }}
        />
      ),
    },
    {
      key: "sr",
      header: "Sr. No.",
      accessor: (r) => r.sr,
      className: "w-20 whitespace-nowrap",
    },
    {
      key: "name",
      header: "Employee",
      accessor: (r) => r.name,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "department",
      header: "Department",
      accessor: (r) => r.department?.department ?? "—",
      className: "whitespace-nowrap",
    },
    {
      key: "assignedDate",
      header: "Assigned On",
      accessor: (r) =>
        r.siteEmployees?.[0]?.assignedDate
          ? new Date(r.siteEmployees[0].assignedDate).toLocaleDateString()
          : "—",
      className: "whitespace-nowrap",
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
  ];

  const filtersDirty = nameDraft.trim() !== name.trim();

  async function unassignSelected() {
    if (!canUnassign) return;
    if (!Number.isFinite(siteId)) {
      toast.error("Invalid site identifier");
      return;
    }
    const employeeIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (employeeIds.length === 0) {
      toast.error("Select at least one employee to unassign");
      return;
    }
    try {
      await apiDelete(`/api/employee-assignments`, { siteId, employeeIds });
      toast.success("Selected employees unassigned");
      setSelected({});
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || "Failed to unassign employees");
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assigned Employees</AppCard.Title>
        <AppCard.Description>
          Employees currently assigned to this site.
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
            label="Employee name"
            aria-label="Employee name"
            placeholder="Filter by employee name..."
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton
            size="sm"
            onClick={() => {
              setName(nameDraft.trim());
              setPage(1);
            }}
            disabled={!filtersDirty}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {name && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setName("");
                setNameDraft("");
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
            name ? "No employees matched your filter" : "No employees assigned"
          }
        />
      </AppCard.Content>
      <AppCard.Footer className="flex justify-between gap-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalAvailable}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(val) => {
            setPerPage(val);
            setPage(1);
          }}
          disabled={isLoading}
          showPageNumbers
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Selected: {Object.values(selected).filter(Boolean).length} • Total
            Assigned: {totalAvailable}
          </div>
          {canUnassign && (
            <AppButton
              variant="destructive"
              onClick={unassignSelected}
              disabled={
                Object.values(selected).filter(Boolean).length === 0 ||
                isLoading
              }
            >
              Unassign Selected
            </AppButton>
          )}
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
