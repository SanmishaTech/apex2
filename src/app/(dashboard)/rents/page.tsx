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
import { EditButton, ViewButton } from '@/components/common/icon-button';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import type { Rent, RentsResponse } from '@/types/rents';
import type { SitesResponse } from '@/types/sites';
import Link from 'next/link';

export default function RentsPage() {
	const searchParams = useSearchParams();
	const qs = searchParams ? searchParams.toString() : '';
	const { pushWithScrollSave } = useScrollRestoration('rents-list');
	
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		site: '',
		fromDate: '',
		toDate: '',
		sort: 'srNo',
		order: 'asc',
	});
	const { page, perPage, search, site, fromDate, toDate, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			site: string;
			fromDate: string;
			toDate: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Get highlight parameter from URL
	const highlightId = searchParams?.get('highlight');
	const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

	// Handle highlight on mount and clear after 3 seconds
	useEffect(() => {
		if (highlightId) {
			setHighlightedRow(highlightId);
			// Remove highlight after 3 seconds
			const timer = setTimeout(() => {
				setHighlightedRow(null);
				// Remove highlight parameter from URL
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.delete('highlight');
				window.history.replaceState({}, '', newUrl.toString());
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [highlightId]);

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [siteDraft, setSiteDraft] = useState(site);
	const [fromDateDraft, setFromDateDraft] = useState(fromDate);
	const [toDateDraft, setToDateDraft] = useState(toDate);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setSiteDraft(site);
	}, [site]);
	useEffect(() => {
		setFromDateDraft(fromDate);
	}, [fromDate]);
	useEffect(() => {
		setToDateDraft(toDate);
	}, [toDate]);

	const filtersDirty =
		searchDraft !== search || siteDraft !== site || fromDateDraft !== fromDate || toDateDraft !== toDate;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			site: siteDraft,
			fromDate: fromDateDraft,
			toDate: toDateDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setSiteDraft('');
		setFromDateDraft('');
		setToDateDraft('');
		setQp({ page: 1, search: '', site: '', fromDate: '', toDate: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (site) sp.set('site', site);
		if (fromDate) sp.set('fromDate', fromDate);
		if (toDate) sp.set('toDate', toDate);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/rents?${sp.toString()}`;
	}, [page, perPage, search, site, fromDate, toDate, sort, order]);

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
			key: 'srNo',
			header: 'Sr No',
			sortable: true,
			accessor: (r) => r.srNo || '—',
			cellClassName: 'text-center',
		},
		{
			key: 'listStatus',
			header: 'Month Status',
			sortable: false,
			accessor: (r) => {
				if (r.listStatus === 'First') {
					return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">First</span>;
				} else if (r.listStatus === 'Last') {
					return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Last</span>;
				}
				return '';
			},
			cellClassName: 'text-center',
		},
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
			key: 'boq',
			header: 'Boq No',
			sortable: false,
			accessor: (r) => r.boq?.boqNo || '—',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'rentalCategory',
			header: 'Rent Category',
			sortable: false,
			accessor: (r) => r.rentalCategory?.rentalCategory || '—',
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
			key: 'description',
			header: 'Description',
			sortable: false,
			accessor: (r) => r.description || '—',
			cellClassName: 'max-w-xs truncate',
		},
		{
			key: 'dueDate',
			header: 'Due Date',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => r.dueDate ? formatDate(r.dueDate) : '—',
		},
		{
			key: 'depositAmount',
			header: 'Deposit Amount',
			sortable: true,
			className: 'text-right',
			cellClassName: 'text-right',
			accessor: (r) => r.depositAmount ? `₹${Number(r.depositAmount).toLocaleString()}` : '—',
		},
		{
			key: 'rentAmount',
			header: 'Rent Amount',
			sortable: true,
			className: 'text-right',
			cellClassName: 'text-right',
			accessor: (r) => r.rentAmount ? `₹${Number(r.rentAmount).toLocaleString()}` : '—',
		},
		{
			key: 'status',
			header: 'Status',
			sortable: true,
			accessor: (r) => {
				if (r.status === 'Paid') {
					return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid</span>;
				} else {
					return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Unpaid</span>;
				}
			},
			cellClassName: 'text-center',
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
					<input
						type="date"
						aria-label='From Date'
						placeholder='From Date'
						value={fromDateDraft}
						onChange={(e) => setFromDateDraft(e.target.value)}
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<input
						type="date"
						aria-label='To Date'
						placeholder='To Date'
						value={toDateDraft}
						onChange={(e) => setToDateDraft(e.target.value)}
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
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
					{(search || site || fromDate || toDate) && (
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
					getRowClassName={(rent) => 
						highlightedRow === String(rent.id) 
							? 'bg-green-50 dark:bg-green-950 transition-all duration-300 shadow-md border-l-4 border-green-500' 
							: 'transition-all duration-300'
					}
					renderRowActions={(rent) => {
						if (!can(PERMISSIONS.READ_RENTS) && !can(PERMISSIONS.EDIT_RENTS) && !can(PERMISSIONS.DELETE_RENTS))
							return null;
						return (
							<div className='flex gap-2'>
								{can(PERMISSIONS.READ_RENTS) && (
									<Link href={`/rents/${rent.id}/view${qs ? `?${qs}` : ''}`}>
										<ViewButton 
											tooltip='View Rent' 
											aria-label='View Rent'
										/>
									</Link>
								)}
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
