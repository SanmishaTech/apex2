"use client";

import useSWR from "swr";
import Link from "next/link";
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

  // Build queries for small recent lists (top 5)
  const sitesQuery = "/api/sites?page=1&perPage=5&sort=createdAt&order=desc";
  const employeesQuery = "/api/employees?page=1&perPage=5&sort=createdAt&order=desc";
  const indentsQuery = "/api/indents?page=1&perPage=5&sort=indentDate&order=desc";
  const assetsQuery = "/api/assets?page=1&perPage=5&sort=createdAt&order=desc";

  // Permission gates per section
  const canSites = can(PERMISSIONS.READ_SITES);
  const canEmployees = can(PERMISSIONS.READ_EMPLOYEES);
  const canIndents = can(PERMISSIONS.READ_INDENTS);
  const canAssets = can(PERMISSIONS.READ_ASSETS);

  const { data: sitesData, error: sitesError, isLoading: sitesLoading } = useSWR<SitesResponse>(
    canSites ? sitesQuery : null,
    apiGet
  );
  const { data: employeesData, error: employeesError, isLoading: employeesLoading } = useSWR<EmployeesResponse>(
    canEmployees ? employeesQuery : null,
    apiGet
  );
  const { data: indentsData, error: indentsError, isLoading: indentsLoading } = useSWR<IndentsResponse>(
    canIndents ? indentsQuery : null,
    apiGet
  );
  const { data: assetsData, error: assetsError, isLoading: assetsLoading } = useSWR<AssetsResponse>(
    canAssets ? assetsQuery : null,
    apiGet
  );

  // Surface errors non-intrusively (one-time toast per error type)
  if (sitesError) toast.error((sitesError as Error).message || "Failed to load sites");
  if (employeesError) toast.error((employeesError as Error).message || "Failed to load employees");
  if (indentsError) toast.error((indentsError as Error).message || "Failed to load indents");
  if (assetsError) toast.error((assetsError as Error).message || "Failed to load assets");

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
        <div className="flex items-center gap-2">
          <StatusBadge active={!r.closed} />
          {r.closed && <span className="text-xs">Closed</span>}
        </div>
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
    { key: "name", header: "Name", sortable: false, accessor: (r) => r.name, cellClassName: "font-medium whitespace-nowrap" },
    { key: "department", header: "Department", sortable: false, accessor: (r) => r.department?.department || "—", cellClassName: "whitespace-nowrap" },
    { key: "site", header: "Site", sortable: false, accessor: (r) => r.site?.site || "—", cellClassName: "whitespace-nowrap" },
    { key: "createdAt", header: "Created", sortable: false, accessor: (r) => formatDate(r.createdAt), cellClassName: "text-muted-foreground whitespace-nowrap" },
  ];

  const indentColumns: Column<Indent>[] = [
    { key: "indentNo", header: "Indent No", sortable: false, accessor: (r) => r.indentNo || "—", cellClassName: "font-medium whitespace-nowrap" },
    { key: "indentDate", header: "Indent Date", sortable: false, accessor: (r) => formatDate(r.indentDate), cellClassName: "whitespace-nowrap" },
    { key: "site", header: "Site", sortable: false, accessor: (r) => r.site?.site || "—", cellClassName: "whitespace-nowrap" },
    { key: "items", header: "Items", sortable: false, accessor: (r) => r.indentItems?.length || 0, cellClassName: "text-center" },
  ];

  const assetColumns: Column<Asset>[] = [
    { key: "assetNo", header: "Asset No", sortable: false, accessor: (r) => <span className="font-medium text-blue-600">{r.assetNo}</span>, cellClassName: "whitespace-nowrap" },
    { key: "assetName", header: "Asset Name", sortable: false, accessor: (r) => r.assetName, cellClassName: "whitespace-nowrap" },
    { key: "assetGroup", header: "Group", sortable: false, accessor: (r) => r.assetGroup?.assetGroupName || "—", cellClassName: "whitespace-nowrap" },
    { key: "useStatus", header: "Use Status", sortable: false, accessor: (r) => r.useStatus, cellClassName: "whitespace-nowrap" },
  ];

  return (
    <div className="p-4 space-y-4">
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
              <div className="text-sm text-muted-foreground">You do not have permission to view sites.</div>
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
              <div className="text-sm text-muted-foreground">You do not have permission to view employees.</div>
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
              <div className="text-sm text-muted-foreground">You do not have permission to view indents.</div>
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
              <div className="text-sm text-muted-foreground">You do not have permission to view assets.</div>
            )}
          </AppCard.Content>
        </AppCard>
      </div>
    </div>
  );
}
