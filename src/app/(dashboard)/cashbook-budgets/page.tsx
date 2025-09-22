'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
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
import { apiDelete } from '@/lib/api-client';

type CashbookBudgetListItem = {
	id: number;
	name: string;
	month: string;
	totalBudget: string;
	siteId: number;
	boqName: string | null;
	attachCopyUrl: string | null;
	approved1Remarks: string | null;
	remarksForFinalApproval: string | null;
	site: { id: number; site: string };
	_count: { budgetItems: number };
	createdAt: string;
	updatedAt: string;
};

type CashbookBudgetsResponse = {
	data: CashbookBudgetListItem[];
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
};

export default function CashbookBudgetsPage() {
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		sort: 'name',
		order: 'asc',
	});
	const { page, perPage, search, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);

	const filtersDirty = searchDraft !== search;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setQp({ page: 1, search: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/cashbook-budgets?${sp.toString()}`;
	}, [page, perPage, search, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<CashbookBudgetsResponse>(
		query,
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load cashbook budgets');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<CashbookBudgetListItem>[] = [
		{
			key: 'name',
			header: 'Budget Name',
			sortable: true,
			cellClassName: 'font-medium whitespace-nowrap',
		},
		{
			key: 'month',
			header: 'Month',
			sortable: true,
			cellClassName: 'text-muted-foreground whitespace-nowrap',
		},
		{
			key: 'site',
			header: 'Site',
			sortable: false,
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => r.site.site,
		},
		{
			key: 'boqName',
			header: 'BOQ',
			sortable: false,
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => r.boqName || '-',
		},
		{
			key: 'totalBudget',
			header: 'Total Budget',
			sortable: true,
			className: 'text-right whitespace-nowrap',
			cellClassName: 'text-right font-mono whitespace-nowrap',
			accessor: (r) => new Intl.NumberFormat('en-IN', {
				style: 'currency',
				currency: 'INR',
				minimumFractionDigits: 2
			}).format(Number(r.totalBudget)),
		},
		{
			key: '_count',
			header: 'Items',
			sortable: false,
			className: 'text-center whitespace-nowrap',
			cellClassName: 'text-center whitespace-nowrap',
			accessor: (r) => r._count.budgetItems,
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
			await apiDelete(`/api/cashbook-budgets/${id}`);
			toast.success('Cashbook budget deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Cashbook Budgets</AppCard.Title>
				<AppCard.Description>Manage cashbook budgets with detailed line items for financial planning.</AppCard.Description>
				{can(PERMISSIONS.CREATE_CASHBOOK_BUDGETS) && (
					<AppCard.Action>
						<Link href='/cashbook-budgets/new'>
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
						aria-label='Search cashbook budgets'
						placeholder='Search budgets...'
						value={searchDraft}
						onChange={(e) => setSearchDraft(e.target.value)}
						containerClassName='w-full'
					/>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={!filtersDirty && !searchDraft}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{search && (
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
					renderRowActions={(budget) => {
						if (!can(PERMISSIONS.EDIT_CASHBOOK_BUDGETS) && !can(PERMISSIONS.DELETE_CASHBOOK_BUDGETS))
							return null;
						return (
							<div className='flex'>
								{can(PERMISSIONS.EDIT_CASHBOOK_BUDGETS) && (
									<Link href={`/cashbook-budgets/${budget.id}/edit`}>
										<EditButton tooltip='Edit Cashbook Budget' aria-label='Edit Cashbook Budget' />
									</Link>
								)}
								{can(PERMISSIONS.DELETE_CASHBOOK_BUDGETS) && (
									<DeleteButton
										onDelete={() => handleDelete(budget.id)}
										itemLabel='cashbook budget'
										title='Delete cashbook budget?'
										description={`This will permanently remove cashbook budget "${budget.name}" and all its items. This action cannot be undone.`}
									/>
								)}
							</div>
						);
					}}
				/>
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