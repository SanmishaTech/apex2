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
import { Company, CompaniesResponse } from '@/types/companies';
import Link from 'next/link';
import Image from 'next/image';

type CompanyListItem = Company;

export default function CompaniesPage() {
	const { pushWithScrollSave } = useScrollRestoration('companies-list');
	
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		closed: '',
		sort: 'companyName',
		order: 'asc',
	});
	const { page, perPage, search, closed, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			closed: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [closedDraft, setClosedDraft] = useState(closed);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setClosedDraft(closed);
	}, [closed]);

	const filtersDirty =
		searchDraft !== search || closedDraft !== closed;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			closed: closedDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setClosedDraft('');
		setQp({ page: 1, search: '', closed: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (closed) sp.set('closed', closed);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/companies?${sp.toString()}`;
	}, [page, perPage, search, closed, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<CompaniesResponse>(
		query,
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load companies');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<CompanyListItem>[] = [
		{
			key: 'companyName',
			header: 'Company Name',
			sortable: true,
			accessor: (r) => (
				<div className="flex items-center gap-3">
					{r.logoUrl && (
						<div className="relative h-8 w-8 flex-shrink-0">
							<Image
								src={r.logoUrl}
								alt={`${r.companyName} logo`}
								fill
								className="rounded-sm object-contain"
							/>
						</div>
					)}
					<div>
						<div className="font-medium">{r.companyName}</div>
						{r.shortName && (
							<div className="text-sm text-muted-foreground">
								{r.shortName}
							</div>
						)}
					</div>
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
				</div>
			),
			cellClassName: 'max-w-48',
		},
		{
			key: 'gstNo',
			header: 'GST No',
			accessor: (r) => r.gstNo || '—',
			cellClassName: 'font-mono text-sm whitespace-nowrap',
		},
		{
			key: 'closed',
			header: 'Status',
			sortable: true,
			accessor: (r) => <StatusBadge active={!r.closed} />,
			cellClassName: 'whitespace-nowrap',
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
			await apiDelete(`/api/companies/${id}`);
			toast.success('Company deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Companies</AppCard.Title>
				<AppCard.Description>Manage application companies.</AppCard.Description>
				{can(PERMISSIONS.EDIT_COMPANIES) && (
					<AppCard.Action>
						<AppButton 
							size='sm' 
							iconName='Plus' 
							type='button'
							onClick={() => pushWithScrollSave('/companies/new')}
						>
							Add
						</AppButton>
					</AppCard.Action>
				)}
			</AppCard.Header>
			<AppCard.Content>
				<FilterBar title='Search & Filter'>
					<NonFormTextInput
						aria-label='Search companies'
						placeholder='Search companies...'
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
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={
							!filtersDirty && !searchDraft && !closedDraft
						}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || closed) && (
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
					renderRowActions={(company) => {
						if (!can(PERMISSIONS.EDIT_COMPANIES) && !can(PERMISSIONS.DELETE_COMPANIES))
							return null;
						return (
							<div className='flex'>
								{can(PERMISSIONS.EDIT_COMPANIES) && (
									<EditButton 
										tooltip='Edit Company' 
										aria-label='Edit Company' 
										onClick={() => pushWithScrollSave(`/companies/${company.id}/edit`)}
									/>
								)}
								{can(PERMISSIONS.DELETE_COMPANIES) && (
									<DeleteButton
										onDelete={() => handleDelete(company.id)}
										itemLabel='company'
										title='Delete company?'
										description={`This will permanently remove ${company.companyName}. This action cannot be undone.`}
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
