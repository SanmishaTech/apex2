"use client";

import { useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { DataTable, type Column } from "@/components/common/data-table";
import { toast } from "@/lib/toast";
import { apiGet } from "@/lib/api-client";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatDate } from "@/lib/locales";
import { StatusBadge } from "@/components/common/status-badge";
import type { Site, SitesResponse } from "@/types/sites";
import type { Employee, EmployeesResponse } from "@/types/employees";
import type { Indent, IndentsResponse } from "@/types/indents";
import type { Asset, AssetsResponse } from "@/types/assets";

export default function InternalDashboard() {
  const { can } = usePermissions();
  const router = useRouter();

  type TodayApi = {
    data: {
      hasEmployee: boolean;
      in: { time: string | Date } | null;
      out: { time: string | Date } | null;
    };
  };

  const { data: todayData } = useSWR<TodayApi>(
    "/api/employee-attendances/today",
    apiGet
  );

  const hasEmployee = todayData?.data?.hasEmployee === true;
  const inMarked = Boolean(todayData?.data?.in);
  const outMarked = Boolean(todayData?.data?.out);

  useEffect(() => {
    try {
      const msg = window.sessionStorage.getItem("employee_attendance_toast");
      if (msg) {
        window.sessionStorage.removeItem("employee_attendance_toast");
        toast.success(msg);
      }
    } catch {
      // ignore
    }
  }, []);

  const goMark = (type: "IN" | "OUT") => {
    try {
      window.sessionStorage.setItem("employee_attendance_type", type);
    } catch {
      // ignore
    }
    router.push("/employee-attendance");
  };

  // Build queries for small recent lists (top 5)
  const sitesQuery = "/api/sites?page=1&perPage=5&sort=createdAt&order=desc";
  const employeesQuery =
    "/api/employees?page=1&perPage=5&sort=createdAt&order=desc";
  const indentsQuery =
    "/api/indents?page=1&perPage=5&sort=indentDate&order=desc";
  const assetsQuery = "/api/assets?page=1&perPage=5&sort=createdAt&order=desc";

  // Permission gates per section
  const canSites = can(PERMISSIONS.READ_SITES);
  const canEmployees = can(PERMISSIONS.READ_EMPLOYEES);
  const canIndents = can(PERMISSIONS.READ_INDENTS);
  const canAssets = can(PERMISSIONS.READ_ASSETS);

  const {
    data: sitesData,
    error: sitesError,
    isLoading: sitesLoading,
  } = useSWR<SitesResponse>(canSites ? sitesQuery : null, apiGet);
  const {
    data: employeesData,
    error: employeesError,
    isLoading: employeesLoading,
  } = useSWR<EmployeesResponse>(canEmployees ? employeesQuery : null, apiGet);
  const {
    data: indentsData,
    error: indentsError,
    isLoading: indentsLoading,
  } = useSWR<IndentsResponse>(canIndents ? indentsQuery : null, apiGet);
  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
  } = useSWR<AssetsResponse>(canAssets ? assetsQuery : null, apiGet);

  // Surface errors non-intrusively (one-time toast per error type)
  if (sitesError)
    toast.error((sitesError as Error).message || "Failed to load sites");
  if (employeesError)
    toast.error(
      (employeesError as Error).message || "Failed to load employees"
    );
  if (indentsError)
    toast.error((indentsError as Error).message || "Failed to load indents");
  if (assetsError)
    toast.error((assetsError as Error).message || "Failed to load assets");

  const siteColumns: Column<Site>[] = [
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => (
        <div>
          <div className="font-medium whitespace-nowrap">{r.site}</div>
          {r.shortName && (
            <div className="text-xs text-muted-foreground">{r.shortName}</div>
          )}
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      sortable: false,
      accessor: (r) => r.company?.companyName || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "status",
      header: "Status",
      sortable: false,
      accessor: (r) => (
        <StatusBadge
          status={r.status.toLowerCase()}
          stylesMap={{
            ongoing: {
              label: "Ongoing",
              className:
                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            },
            hold: {
              label: "Hold",
              className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            },
            closed: {
              label: "Closed",
              className: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
            },
            completed: {
              label: "Completed",
              className:
                "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
            },
            mobilization_stage: {
              label: "Mobilization Stage",
              className:
                "bg-purple-500/10 text-purple-600 dark:text-purple-400",
            },
          }}
        />
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: false,
      accessor: (r) => formatDate(r.createdAt),
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
  ];

  const employeeColumns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      sortable: false,
      accessor: (r) => r.name,
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "department",
      header: "Department",
      sortable: false,
      accessor: (r) => r.department?.department || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: false,
      accessor: (r) => formatDate(r.createdAt),
      cellClassName: "text-muted-foreground whitespace-nowrap",
    },
  ];

  const indentColumns: Column<Indent>[] = [
    {
      key: "indentNo",
      header: "Indent No",
      sortable: false,
      accessor: (r) => r.indentNo || "—",
      cellClassName: "font-medium whitespace-nowrap",
    },
    {
      key: "indentDate",
      header: "Indent Date",
      sortable: false,
      accessor: (r) => formatDate(r.indentDate),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "site",
      header: "Site",
      sortable: false,
      accessor: (r) => r.site?.site || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "items",
      header: "Items",
      sortable: false,
      accessor: (r) => r.indentItems?.length || 0,
      cellClassName: "text-center",
    },
  ];

  const assetColumns: Column<Asset>[] = [
    {
      key: "assetNo",
      header: "Asset No",
      sortable: false,
      accessor: (r) => (
        <span className="font-medium text-blue-600">{r.assetNo}</span>
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "assetName",
      header: "Asset Name",
      sortable: false,
      accessor: (r) => r.assetName,
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "assetGroup",
      header: "Group",
      sortable: false,
      accessor: (r) => r.assetGroup?.assetGroupName || "—",
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "useStatus",
      header: "Use Status",
      sortable: false,
      accessor: (r) => r.useStatus,
      cellClassName: "whitespace-nowrap",
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {hasEmployee && (!inMarked || !outMarked) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!inMarked && (
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Office IN
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Capture photo + location to mark entry.
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <LogIn className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
              <div className="mt-4">
                <AppButton className="w-full" onClick={() => goMark("IN")}>
                  Mark IN
                </AppButton>
              </div>
            </div>
          )}

          {!outMarked && (
            <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/15 via-amber-500/10 to-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    Office OUT
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Capture photo + location to mark exit.
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-rose-700 dark:text-rose-300" />
                </div>
              </div>
              <div className="mt-4">
                <AppButton
                  className="w-full"
                  variant="secondary"
                  onClick={() => goMark("OUT")}
                >
                  Mark OUT
                </AppButton>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Recent Sites</AppCard.Title>
            <AppCard.Description>Latest 5 sites.</AppCard.Description>
            {can(PERMISSIONS.READ_SITES) && (
              <AppCard.Action>
                <AppButton size="sm" asChild>
                  <Link href="/sites">View All</Link>
                </AppButton>
              </AppCard.Action>
            )}
          </AppCard.Header>
          <AppCard.Content>
            {canSites ? (
              <DataTable<Site>
                columns={siteColumns}
                data={sitesData?.data || []}
                loading={sitesLoading}
                simpleStyle
                stickyColumns={1}
                skeletonRows={5}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                You do not have permission to view sites.
              </div>
            )}
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Recent Employees</AppCard.Title>
            <AppCard.Description>Latest 5 employees.</AppCard.Description>
            {can(PERMISSIONS.READ_EMPLOYEES) && (
              <AppCard.Action>
                <AppButton size="sm" asChild>
                  <Link href="/employees">View All</Link>
                </AppButton>
              </AppCard.Action>
            )}
          </AppCard.Header>
          <AppCard.Content>
            {canEmployees ? (
              <DataTable<Employee>
                columns={employeeColumns}
                data={employeesData?.data || []}
                loading={employeesLoading}
                simpleStyle
                stickyColumns={1}
                skeletonRows={5}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                You do not have permission to view employees.
              </div>
            )}
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Recent Indents</AppCard.Title>
            <AppCard.Description>Latest 5 indents.</AppCard.Description>
            {can(PERMISSIONS.READ_INDENTS) && (
              <AppCard.Action>
                <AppButton size="sm" asChild>
                  <Link href="/indents">View All</Link>
                </AppButton>
              </AppCard.Action>
            )}
          </AppCard.Header>
          <AppCard.Content>
            {canIndents ? (
              <DataTable<Indent>
                columns={indentColumns}
                data={indentsData?.data || []}
                loading={indentsLoading}
                simpleStyle
                stickyColumns={1}
                skeletonRows={5}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                You do not have permission to view indents.
              </div>
            )}
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Recent Assets</AppCard.Title>
            <AppCard.Description>Latest 5 assets.</AppCard.Description>
            {can(PERMISSIONS.READ_ASSETS) && (
              <AppCard.Action>
                <AppButton size="sm" asChild>
                  <Link href="/assets">View All</Link>
                </AppButton>
              </AppCard.Action>
            )}
          </AppCard.Header>
          <AppCard.Content>
            {canAssets ? (
              <DataTable<Asset>
                columns={assetColumns}
                data={assetsData?.data || []}
                loading={assetsLoading}
                simpleStyle
                stickyColumns={1}
                skeletonRows={5}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                You do not have permission to view assets.
              </div>
            )}
          </AppCard.Content>
        </AppCard>
      </div>
    </div>
  );
}
