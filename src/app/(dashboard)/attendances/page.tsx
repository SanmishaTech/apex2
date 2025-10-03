'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ClipboardCheck, Calendar, Users } from 'lucide-react';

import { AppCard } from '@/components/common/app-card';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppButton } from '@/components/common/app-button';
import { Pagination } from '@/components/common/pagination';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import type { SitesAttendanceResponse, SiteWithLastAttendance } from '@/types/attendances';

type AttendancesQ = { page: number; perPage: number; search: string };

export default function AttendancesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration('attendances-list');

  const [qp, setQp] = useQueryParamsState<AttendancesQ>({ page: 1, perPage: 10, search: '' });
  const { page, perPage, search } = qp;

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const filtersDirty = searchDraft !== search;

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    return `/api/attendances/sites?${sp.toString()}`;
  }, [page, perPage, search]);

  const { data, error, isLoading } = useSWR<SitesAttendanceResponse>(query, apiGet);
  const rows: SiteWithLastAttendance[] = data?.data ?? [];

  if (error) toast.error((error as Error).message || 'Failed to load sites');

  function applyFilters() { setQp({ page: 1, search: searchDraft.trim() }); }
  function resetFilters() { setSearchDraft(''); setQp({ page: 1, search: '' }); }

  const columns: Column<SiteWithLastAttendance>[] = [
    { 
      key: 'site', 
      header: 'Site Name', 
      sortable: false, 
      cellClassName: 'font-semibold text-foreground',
      className: 'min-w-[200px]'
    },
    { 
      key: 'shortName', 
      header: 'Short Name', 
      sortable: false, 
      accessor: (r) => r.shortName || '-',
      className: 'min-w-[120px]'
    },
    { 
      key: 'assignedManpowerCount', 
      header: 'Assigned Manpower', 
      sortable: false, 
      cellClassName: 'text-center font-medium',
      className: 'text-center min-w-[140px]',
      accessor: (r) => (
        <div className="flex items-center justify-center gap-1.5">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span>{r.assignedManpowerCount}</span>
        </div>
      )
    },
    { 
      key: 'lastAttendanceDate', 
      header: 'Last Attendance', 
      sortable: false,
      className: 'min-w-[160px]',
      accessor: (r) => {
        if (!r.lastAttendanceDate) {
          return <span className="text-muted-foreground italic">Never recorded</span>;
        }
        const date = new Date(r.lastAttendanceDate);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const dateStr = date.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (dateStr === todayStr) {
          return (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-green-700 dark:text-green-400">Today</span>
            </div>
          );
        } else if (dateStr === yesterdayStr) {
          return (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-orange-700 dark:text-orange-400">Yesterday</span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{date.toLocaleDateString()}</span>
            </div>
          );
        }
      },
    },
  ];

  const canCreate = can(PERMISSIONS.CREATE_ATTENDANCES);

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          <ClipboardCheck className="w-5 h-5 mr-2" />
          Manage Attendance
        </AppCard.Title>
        <AppCard.Description>View sites and mark attendance for assigned manpower.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title="Search">
          <NonFormTextInput 
            aria-label="Search sites" 
            placeholder="Search sites..." 
            value={searchDraft} 
            onChange={(e) => setSearchDraft(e.target.value)} 
            containerClassName="w-full" 
          />
          <AppButton size="sm" onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className="min-w-[84px]">
            Filter
          </AppButton>
          {search && (
            <AppButton variant="secondary" size="sm" onClick={resetFilters} className="min-w-[84px]">
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {canCreate && (
                <AppButton 
                  size="sm"
                  onClick={() => pushWithScrollSave(`/attendances/mark/${row.id}`)}
                >
                  <ClipboardCheck className="w-4 h-4 mr-1.5" />
                  Mark Attendance
                </AppButton>
              )}
            </div>
          )}
        />
        <Pagination
          page={data?.meta?.page || 1}
          perPage={data?.meta?.perPage || 10}
          total={data?.meta?.total || 0}
          totalPages={data?.meta?.totalPages || 1}
          onPageChange={(p) => setQp({ page: p })}
          onPerPageChange={(pp) => setQp({ page: 1, perPage: pp })}
        />
      </AppCard.Content>
    </AppCard>
  );
}
