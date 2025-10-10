'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppSelect } from '@/components/common/app-select';
import { FilterBar } from '@/components/common'; // filter layout wrapper
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatRelativeTime, formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useSearchParams } from 'next/navigation';
import { EditButton } from '@/components/common/icon-button';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import type { Rent, RentsResponse } from '@/types/rents';
import type { SitesResponse } from '@/types/sites';

export default function RentsPage() {
	const searchParams = useSearchParams();
	const qs = searchParams ? searchParams.toString() : '';
	const { pushWithScrollSave } = useScrollRestoration('rents-list');
	
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		site: '',
		sort: 'createdAt',
		order: 'desc',
	});
	const { page, perPage, search, site, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			site: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [siteDraft, setSiteDraft] = useState(site);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setSiteDraft(site);
	}, [site]);

	const filtersDirty =
		searchDraft !== search || siteDraft !== site;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			site: siteDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setSiteDraft('');
		setQp({ page: 1, search: '', site: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (site) sp.set('site', site);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/rents?${sp.toString()}`;
	}, [page, perPage, search, site, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<RentsResponse>(
		query,
		apiGet
	);

	// Debug: Log pagination data to understand the issue
	useEffect(() => {
		if (data?.meta) {
			console.log('Rents Pagination Debug:', {
				requestedPerPage: perPage,
				responsePerPage: data.meta.perPage,
				total: data.meta.total,
				totalPages: data.meta.totalPages,
				currentPage: data.meta.page,
				dataLength: data.data.length,
				query,
				timestamp: new Date().toISOString()
			});
		}
	}, [data?.meta, perPage, query]);

	// Show debug info in UI (temporary)
	const showDebugInfo = true;

	// Force cache refresh function
	const forceRefresh = () => {
		console.log('Forcing cache refresh...');
		mutate();
	};

	// Fetch sites for filter dropdown
	const { data: sitesData } = useSWR<SitesResponse>(
		'/api/sites?perPage=100',
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load rents');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<Rent>[] = [
		{
			key: 'owner',
			header: 'Owner',
			sortable: true,
			accessor: (r) => r.owner || '—',
			cellClassName: 'font-medium whitespace-nowrap',
		},
		{
			key: 'site',
			header: 'Site',
			sortable: false,
			accessor: (r) => r.site?.site || '—',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'rentType',
			header: 'Rent Type',
			sortable: false,
			accessor: (r) => r.rentType?.rentType || '—',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'rentalCategory',
			header: 'Category',
			sortable: false,
			accessor: (r) => r.rentalCategory?.rentalCategory || '—',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'fromDate',
			header: 'From Date',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => r.fromDate ? formatDate(r.fromDate) : '—',
		},
		{
			key: 'toDate',
			header: 'To Date',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => r.toDate ? formatDate(r.toDate) : '—',
		},
		{
			key: 'rentAmount',
			header: 'Rent Amount',
			sortable: true,
			className: 'text-right',
			cellClassName: 'text-right',
			accessor: (r) => r.rentAmount ? `₹${r.rentAmount.toLocaleString()}` : '—',
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
			await apiDelete(`/api/rents/${id}`);
			toast.success('Rent deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Rents</AppCard.Title>
				<AppCard.Description>Manage application rents.</AppCard.Description>
				<AppCard.Action className="flex gap-2">
					<AppButton
						size='sm'
						variant='outline'
						type='button'
						onClick={forceRefresh}
					>
						Refresh
					</AppButton>
					{can(PERMISSIONS.CREATE_RENTS) && (
						<AppButton
							size='sm'
							iconName='Plus'
							type='button'
							onClick={() => pushWithScrollSave('/rents/new')}
						>
							Add
						</AppButton>
					)}
				</AppCard.Action>
			</AppCard.Header>
			<AppCard.Content>
				 
				<FilterBar title='Search & Filter'>
					<NonFormTextInput
						aria-label='Search rents'
						placeholder='Search rents...'
						value={searchDraft}
						onChange={(e) => setSearchDraft(e.target.value)}
						containerClassName='w-full'
					/>
					<AppSelect
						value={siteDraft || '__all'}
						onValueChange={(v) => setSiteDraft(v === '__all' ? '' : v)}
						placeholder='Site'
					>
						<AppSelect.Item value='__all'>All Sites</AppSelect.Item>
						{sitesData?.data?.map((site) => (
							<AppSelect.Item key={site.id} value={String(site.id)}>
								{site.site}
							</AppSelect.Item>
						))}
					</AppSelect>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={
							!filtersDirty && !searchDraft && !siteDraft
						}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || site) && (
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
				{/* Horizontal scroll wrapper for mobile */}
				<DataTable
					columns={columns}
					data={data?.data || []}
					loading={isLoading}
					sort={sortState}
					onSortChange={(s) => toggleSort(s.field)}
					stickyColumns={1}
					renderRowActions={(rent) => {
						if (!can(PERMISSIONS.EDIT_RENTS) && !can(PERMISSIONS.DELETE_RENTS))
							return null;
						return (
							<div className='flex gap-2'>
								{can(PERMISSIONS.EDIT_RENTS) && (
									<EditButton 
										tooltip='Edit Rent' 
										aria-label='Edit Rent'
										onClick={() => pushWithScrollSave(`/rents/${rent.id}/edit${qs ? `?${qs}` : ''}`)}
									/>
								)}
								{can(PERMISSIONS.DELETE_RENTS) && (
									<DeleteButton
										onDelete={() => handleDelete(rent.id)}
										itemLabel='rent'
										title='Delete rent?'
										description={`This will permanently remove rent for ${rent.owner}. This action cannot be undone.`}
									/>
								)}
							</div>
						);
					}}
				/>
			</AppCard.Content>
			<AppCard.Footer className='justify-end'>
				<Pagination
					page={data?.meta?.page || page}
					totalPages={data?.meta?.totalPages || 1}
					total={data?.meta?.total}
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
