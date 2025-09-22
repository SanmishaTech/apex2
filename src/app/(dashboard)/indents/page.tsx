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
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';
import type { Indent, IndentsResponse } from '@/types/indents';
import type { SitesResponse } from '@/types/sites';

export default function IndentsPage() {
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		site: '',
		sort: 'indentDate',
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
		return `/api/indents?${sp.toString()}`;
	}, [page, perPage, search, site, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<IndentsResponse>(
		query,
		apiGet
	);

	// Fetch sites for filter dropdown
	const { data: sitesData } = useSWR<SitesResponse>(
		'/api/sites?perPage=100',
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load indents');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<Indent>[] = [
		{
			key: 'indentNo',
			header: 'Indent No',
			sortable: true,
			accessor: (r) => r.indentNo || '—',
			cellClassName: 'font-medium whitespace-nowrap',
		},
		{
			key: 'indentDate',
			header: 'Indent Date',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => formatDate(r.indentDate),
		},
		{
			key: 'site',
			header: 'Site',
			sortable: false,
			accessor: (r) => r.site?.site || '—',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'deliveryDate',
			header: 'Delivery Date',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => formatDate(r.deliveryDate),
		},
		{
			key: 'itemsCount',
			header: 'Items',
			sortable: false,
			className: 'text-center',
			cellClassName: 'text-center text-muted-foreground',
			accessor: (r) => r.indentItems?.length || 0,
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
			await apiDelete(`/api/indents/${id}`);
			toast.success('Indent deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Indents</AppCard.Title>
				<AppCard.Description>Manage application indents.</AppCard.Description>
				{can(PERMISSIONS.CREATE_INDENTS) && (
					<AppCard.Action>
						<Link href='/indents/new'>
							<AppButton size='sm' iconName='Plus' type='button'>
								Add
							</AppButton>
						</Link>
					</AppCard.Action>
				)}
			</AppCard.Header>
			<AppCard.Content>
				<FilterBar title='Search & Filter'>
					<NonFormTextInput
						aria-label='Search indents'
						placeholder='Search indents...'
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
					renderRowActions={(indent) => {
						if (!can(PERMISSIONS.EDIT_INDENTS) && !can(PERMISSIONS.DELETE_INDENTS))
							return null;
						return (
							<div className='flex'>
								{can(PERMISSIONS.EDIT_INDENTS) && (
									<Link href={`/indents/${indent.id}/edit`}>
										<EditButton tooltip='Edit Indent' aria-label='Edit Indent' />
									</Link>
								)}
								{can(PERMISSIONS.DELETE_INDENTS) && (
									<DeleteButton
										onDelete={() => handleDelete(indent.id)}
										itemLabel='indent'
										title='Delete indent?'
										description={`This will permanently remove indent ${indent.indentNo}. This action cannot be undone.`}
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
