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
import Link from 'next/link';

type SiteListItem = Site;

export default function SitesPage() {
	const { pushWithScrollSave } = useScrollRestoration('sites-list');
	
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		closed: '',
		permanentClosed: '',
		monitor: '',
		sort: 'site',
		order: 'asc',
	});
	const { page, perPage, search, closed, permanentClosed, monitor, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			closed: string;
			permanentClosed: string;
			monitor: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [closedDraft, setClosedDraft] = useState(closed);
	const [permanentClosedDraft, setPermanentClosedDraft] = useState(permanentClosed);
	const [monitorDraft, setMonitorDraft] = useState(monitor);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setClosedDraft(closed);
	}, [closed]);
	useEffect(() => {
		setPermanentClosedDraft(permanentClosed);
	}, [permanentClosed]);
	useEffect(() => {
		setMonitorDraft(monitor);
	}, [monitor]);

	const filtersDirty =
		searchDraft !== search || 
		closedDraft !== closed || 
		permanentClosedDraft !== permanentClosed || 
		monitorDraft !== monitor;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			closed: closedDraft,
			permanentClosed: permanentClosedDraft,
			monitor: monitorDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setClosedDraft('');
		setPermanentClosedDraft('');
		setMonitorDraft('');
		setQp({ page: 1, search: '', closed: '', permanentClosed: '', monitor: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (closed) sp.set('closed', closed);
		if (permanentClosed) sp.set('permanentClosed', permanentClosed);
		if (monitor) sp.set('monitor', monitor);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/sites?${sp.toString()}`;
	}, [page, perPage, search, closed, permanentClosed, monitor, sort, order]);

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
					{r.uinNo && (
						<div className="text-xs text-muted-foreground">
							UIN: {r.uinNo}
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
			accessor: (r) => (
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<StatusBadge active={!r.closed} />
						{r.closed && <span className="text-xs">Closed</span>}
					</div>
					{r.permanentClosed && (
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-red-500"></div>
							<span className="text-xs text-red-600">Permanent</span>
						</div>
					)}
					{r.monitor && (
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-blue-500"></div>
							<span className="text-xs text-blue-600">Monitor</span>
						</div>
					)}
				</div>
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
						value={closedDraft || '__all'}
						onValueChange={(v) => setClosedDraft(v === '__all' ? '' : v)}
						placeholder='Status'
					>
						<AppSelect.Item value='__all'>All Statuses</AppSelect.Item>
						<AppSelect.Item value='false'>Active</AppSelect.Item>
						<AppSelect.Item value='true'>Closed</AppSelect.Item>
					</AppSelect>
					<AppSelect
						value={permanentClosedDraft || '__all'}
						onValueChange={(v) => setPermanentClosedDraft(v === '__all' ? '' : v)}
						placeholder='Permanent Status'
					>
						<AppSelect.Item value='__all'>All</AppSelect.Item>
						<AppSelect.Item value='false'>Not Permanent</AppSelect.Item>
						<AppSelect.Item value='true'>Permanent Closed</AppSelect.Item>
					</AppSelect>
					<AppSelect
						value={monitorDraft || '__all'}
						onValueChange={(v) => setMonitorDraft(v === '__all' ? '' : v)}
						placeholder='Monitor'
					>
						<AppSelect.Item value='__all'>All</AppSelect.Item>
						<AppSelect.Item value='false'>Not Monitored</AppSelect.Item>
						<AppSelect.Item value='true'>Monitored</AppSelect.Item>
					</AppSelect>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={
							!filtersDirty && !searchDraft && !closedDraft && !permanentClosedDraft && !monitorDraft
						}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || closed || permanentClosed || monitor) && (
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
