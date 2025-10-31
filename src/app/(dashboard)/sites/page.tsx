'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppSelect } from '@/components/common/app-select';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { EditButton } from '@/components/common/icon-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { StatusBadge } from '@/components/common/status-badge';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { Site, SitesResponse } from '@/types/sites';

type SiteListItem = Site;

export default function SitesPage() {
	const { pushWithScrollSave } = useScrollRestoration('sites-list');
	
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		status: '',
		sort: 'site',
		order: 'asc',
	});
	const { page, perPage, search, status, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      status: string;
      sort: string;
      order: 'asc' | 'desc';
    };

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [statusDraft, setStatusDraft] = useState(status);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setStatusDraft(status);
	}, [status]);

	const filtersDirty = searchDraft !== search || statusDraft !== status;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			status: statusDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setStatusDraft('');
		setQp({ page: 1, search: '', status: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (status) sp.set('status', status);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/sites?${sp.toString()}`;
	}, [page, perPage, search, status, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<SitesResponse>(
		query,
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load sites');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<SiteListItem>[] = [
		{
			key: 'site',
			header: 'Site Name',
			sortable: true,
			accessor: (r) => (
				<div>
					<div className="font-medium">{r.site}</div>
					{r.shortName && (
						<div className="text-sm text-muted-foreground">
							{r.shortName}
						</div>
					)}
					{r.siteCode && (
						<div className="text-xs text-muted-foreground">
							Code: {r.siteCode}
						</div>
					)}
				</div>
			),
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'company',
			header: 'Company',
			accessor: (r) => (
				<div className="text-sm">
					{r.company?.companyName || '—'}
					{r.company?.shortName && (
						<div className="text-xs text-muted-foreground">
							{r.company.shortName}
						</div>
					)}
				</div>
			),
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'contactPerson',
			header: 'Contact Person',
			sortable: true,
			accessor: (r) => (
				<div>
					<div>{r.contactPerson || '—'}</div>
					{r.contactNo && (
						<div className="text-sm text-muted-foreground">
							{r.contactNo}
						</div>
					)}
				</div>
			),
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'location',
			header: 'Location',
			accessor: (r) => (
				<div className="text-sm">
					{r.addressLine1 && <div>{r.addressLine1}</div>}
					{(r.city || r.state) && (
						<div className="text-muted-foreground">
							{[r.city?.city, r.state?.state].filter(Boolean).join(', ')}
							{r.pinCode && ` - ${r.pinCode}`}
						</div>
					)}
					{(r.longitude || r.latitude) && (
						<div className="text-xs text-muted-foreground font-mono">
							{r.latitude}, {r.longitude}
						</div>
					)}
				</div>
			),
			cellClassName: 'max-w-48',
		},
		{
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (r) => (
        <StatusBadge
          status={r.status.toLowerCase()}
          stylesMap={{
            ongoing: { label: 'Ongoing', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
            hold: { label: 'Hold', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
            monitor: { label: 'Monitor', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
          }}
        />
      ),
      cellClassName: 'whitespace-nowrap',
    },
		{
			key: 'gstNo',
			header: 'GST No',
			accessor: (r) => r.gstNo || '—',
			cellClassName: 'font-mono text-sm whitespace-nowrap',
		},
		{
			key: 'createdAt',
			header: 'Created',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => formatDate(r.createdAt),
		},
	];

	const sortState: SortState = { field: sort, order };

	async function handleDelete(id: number) {
		try {
			await apiDelete(`/api/sites/${id}`);
			toast.success('Site deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Sites</AppCard.Title>
				<AppCard.Description>Manage application sites.</AppCard.Description>
				{can(PERMISSIONS.EDIT_SITES) && (
					<AppCard.Action>
						<AppButton 
							size='sm' 
							iconName='Plus' 
							type='button'
							onClick={() => pushWithScrollSave('/sites/new')}
						>
							Add
						</AppButton>
					</AppCard.Action>
				)}
			</AppCard.Header>
			<AppCard.Content>
				<FilterBar title='Search & Filter'>
					<NonFormTextInput
						aria-label='Search sites'
						placeholder='Search sites...'
						value={searchDraft}
						onChange={(e) => setSearchDraft(e.target.value)}
						containerClassName='w-full'
					/>
					<AppSelect
						value={statusDraft || '__all'}
						onValueChange={(v) => setStatusDraft(v === '__all' ? '' : v)}
						placeholder='Status'
					>
						<AppSelect.Item value='__all'>All Statuses</AppSelect.Item>
						<AppSelect.Item value='Ongoing'>Ongoing</AppSelect.Item>
						<AppSelect.Item value='Hold'>Hold</AppSelect.Item>
						<AppSelect.Item value='Monitor'>Monitor</AppSelect.Item>
					</AppSelect>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={!filtersDirty && !searchDraft && !statusDraft}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || status) && (
						<AppButton
							variant='secondary'
							size='sm'
							onClick={resetFilters}
							className='min-w-[84px]'
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
					renderRowActions={(site) => {
						if (!can(PERMISSIONS.EDIT_SITES) && !can(PERMISSIONS.DELETE_SITES))
							return null;
						return (
							<div className='flex'>
								{can(PERMISSIONS.EDIT_SITES) && (
									<EditButton 
										tooltip='Edit Site' 
										aria-label='Edit Site' 
										onClick={() => pushWithScrollSave(`/sites/${site.id}/edit`)}
									/>
								)}
								{can(PERMISSIONS.DELETE_SITES) && (
									<DeleteButton
										onDelete={() => handleDelete(site.id)}
										itemLabel='site'
										title='Delete site?'
										description={`This will permanently remove ${site.site}. This action cannot be undone.`}
									/>
								)}
							</div>
						);
					}}/>
			</AppCard.Content>
			<AppCard.Footer className='justify-end'>
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
