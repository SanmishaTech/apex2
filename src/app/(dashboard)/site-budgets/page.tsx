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
import { AppSelect } from "@/components/common/app-select";
import { DataTable, SortState, Column } from "@/components/common/data-table";
import { DeleteButton } from "@/components/common/delete-button";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatRelativeTime, formatDate } from "@/lib/locales";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import Link from "next/link";
import { EditButton } from "@/components/common/icon-button";
import type { SitesResponse } from "@/types/sites";
import { format as dfFormat } from "date-fns";

type SiteBudgetListItem = {
  id: number;
  siteId: number;
  site: { id: number; site: string } | null;
  boqId: number;
  boq: { id: number; boqNo: string | null } | null;
  month: string;
  week: string;
  fromDate: string;
  toDate: string;
  createdAt: string;
  updatedAt: string;
};

type SiteBudgetsResponse = {
  data: SiteBudgetListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const ALL_VALUE = "__ALL__";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  // eslint-disable-next-line no-mixed-operators
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDDMMYYYY(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return dfFormat(d, "dd/MM/yyyy");
}

function monthIndexFromLabel(label: string): number | null {
  const monthName = String(label || "").trim().split(" ")[0];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const idx = names.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
  return idx >= 0 ? idx : null;
}

function yearFromLabel(label: string): number | null {
  const parts = String(label || "").trim().split(" ");
  const yearStr = parts[parts.length - 1];
  const y = Number(yearStr);
  return Number.isFinite(y) ? y : null;
}

function buildMonthYearOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const opts: Array<{ value: string; label: string }> = [];
  for (const y of years) {
    for (const m of names) {
      const label = `${m} ${y}`;
      opts.push({ value: label, label });
    }
  }
  return opts;
}

function buildWeekOptions(monthLabel: string): Array<{ value: string; label: string }> {
  const mi = monthIndexFromLabel(monthLabel);
  const yr = yearFromLabel(monthLabel);
  if (mi === null || yr === null) return [];
  const daysInMonth = new Date(yr, mi + 1, 0).getDate();
  const weeks = Math.ceil(daysInMonth / 7);
  return Array.from({ length: weeks }).map((_, i) => {
    const label = `${ordinal(i + 1)} Week`;
    return { value: label, label };
  });
}

export default function SiteBudgetsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: "",
    siteId: "",
    month: "",
    week: "",
    sort: "createdAt",
    order: "desc",
  });

  const { page, perPage, search, siteId, month, week, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      siteId: string;
      month: string;
      week: string;
      sort: string;
      order: "asc" | "desc";
    };

  const { can } = usePermissions();

  const canReadSites = can(PERMISSIONS.READ_SITES) || can(PERMISSIONS.VIEW_SITES);

  const [searchDraft, setSearchDraft] = useState(search);
  const [siteIdDraft, setSiteIdDraft] = useState(siteId);
  const [monthDraft, setMonthDraft] = useState(month);
  const [weekDraft, setWeekDraft] = useState(week);

  useEffect(() => {
    setSearchDraft(search);
    setSiteIdDraft(siteId);
    setMonthDraft(month);
    setWeekDraft(week);
  }, [search, siteId, month, week]);

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);
  const weekOptions = useMemo(() => buildWeekOptions(monthDraft), [monthDraft]);

  const { data: sitesData } = useSWR<SitesResponse>(
    canReadSites ? "/api/sites?perPage=100" : null,
    apiGet
  );

  const filtersDirty =
    searchDraft !== search ||
    siteIdDraft !== siteId ||
    monthDraft !== month ||
    weekDraft !== week;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      siteId: siteIdDraft,
      month: monthDraft,
      week: weekDraft,
    });
  }

  function resetFilters() {
    setSearchDraft("");
    setSiteIdDraft("");
    setMonthDraft("");
    setWeekDraft("");
    setQp({ page: 1, search: "", siteId: "", month: "", week: "" });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("perPage", String(perPage));
    if (search) sp.set("search", search);
    if (siteId) sp.set("siteId", siteId);
    if (month) sp.set("month", month);
    if (week) sp.set("week", week);
    if (sort) sp.set("sort", sort);
    if (order) sp.set("order", order);
    return `/api/site-budgets?${sp.toString()}`;
  }, [page, perPage, search, siteId, month, week, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<SiteBudgetsResponse>(query, apiGet);

  useEffect(() => {
    if (error) toast.error((error as Error).message || "Failed to load site budgets");
  }, [error]);

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === "asc" ? "desc" : "asc" });
    } else {
      setQp({ sort: field, order: "asc" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/site-budgets/${id}`);
      toast.success("Site Budget deleted");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const columns: Column<SiteBudgetListItem>[] = [
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "boq",
      header: "BOQ No.",
      sortable: false,
      accessor: (r) => r.boq?.boqNo || `BOQ ${r.boqId}` || "—",
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "month",
      header: "Month",
      sortable: true,
      accessor: (r) => r.month || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "week",
      header: "Week",
      sortable: true,
      accessor: (r) => r.week || "—",
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "fromDate",
      header: "From Date",
      sortable: true,
      accessor: (r) => (r.fromDate ? formatDDMMYYYY(r.fromDate) : "—"),
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "toDate",
      header: "To Date",
      sortable: true,
      accessor: (r) => (r.toDate ? formatDDMMYYYY(r.toDate) : "—"),
      className: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
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

  const siteOptions = (sitesData?.data || []).map((s) => ({
    value: String(s.id),
    label: s.site,
  }));

  const siteValueUi = siteIdDraft === "" ? ALL_VALUE : siteIdDraft;
  const monthValueUi = monthDraft === "" ? ALL_VALUE : monthDraft;
  const weekValueUi = weekDraft === "" ? ALL_VALUE : weekDraft;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Site Budgets</AppCard.Title>
        <AppCard.Description>Manage site budgets.</AppCard.Description>
        {can(PERMISSIONS.CREATE_SITE_BUDGETS) && (
          <AppCard.Action>
            <Link href="/site-budgets/new">
              <AppButton size="sm" iconName="Plus" type="button">
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search & Filter">
          {canReadSites ? (
            <AppSelect
              label="Site"
              value={siteIdDraft || undefined}
              onValueChange={(v) => setSiteIdDraft(v === ALL_VALUE ? "" : v)}
              placeholder="All Sites"
              triggerClassName="h-9 min-w-[180px]"
            >
              <AppSelect.Item value={ALL_VALUE}>All Sites</AppSelect.Item>
              {siteOptions.map((opt) => (
                <AppSelect.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </AppSelect.Item>
              ))}
            </AppSelect>
          ) : null}

          <AppSelect
            label="Month"
            value={monthDraft || undefined}
            onValueChange={(v) => {
              const next = v === ALL_VALUE ? "" : v;
              setMonthDraft(next);
              if (!next) setWeekDraft("");
            }}
            placeholder="All Months"
            triggerClassName="h-9 min-w-[160px]"
          >
            <AppSelect.Item value={ALL_VALUE}>All Months</AppSelect.Item>
            {monthOptions.map((opt) => (
              <AppSelect.Item key={opt.value} value={opt.value}>
                {opt.label}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <AppSelect
            label="Week"
            value={weekDraft || undefined}
            onValueChange={(v) => setWeekDraft(v === ALL_VALUE ? "" : v)}
            placeholder={monthDraft ? "All Weeks" : "Select Month"}
            triggerClassName="h-9 min-w-[140px]"
            disabled={!monthDraft}
          >
            <AppSelect.Item value={ALL_VALUE}>All Weeks</AppSelect.Item>
            {weekOptions.map((opt) => (
              <AppSelect.Item key={opt.value} value={opt.value}>
                {opt.label}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <NonFormTextInput
            aria-label="Search Site Budgets"
            placeholder="Search by Month, Week, Site..."
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
          {(filtersDirty || search || siteId || month || week || searchDraft || siteIdDraft || monthDraft || weekDraft) && (
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
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.EDIT_SITE_BUDGETS) && !can(PERMISSIONS.DELETE_SITE_BUDGETS)) return null;
            return (
              <div className="flex">
                {can(PERMISSIONS.EDIT_SITE_BUDGETS) && (
                  <Link href={`/site-budgets/${row.siteId}/edit/${row.id}`}>
                    <EditButton tooltip="Edit Site Budget" aria-label="Edit Site Budget" />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_SITE_BUDGETS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel="site budget"
                    title="Delete site budget?"
                    description={`This will permanently remove Site Budget "${row.month || ""} ${row.week || ""}". This action cannot be undone.`}
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
