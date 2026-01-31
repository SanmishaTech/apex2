'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppSelect } from '@/components/common/app-select';
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
	boqId: number | null;
	attachCopyUrl: string | null;
	approved1Remarks: string | null;
	remarksForFinalApproval: string | null;
	approvedBy: number | null;
	approvedDatetime: string | null;
	approvedBudgetAmount: string | null;
	approved1By: number | null;
	approved1Datetime: string | null;
	approved1BudgetAmount: string | null;
	acceptedBy: number | null;
	acceptedDatetime: string | null;
	site: { id: number; site: string };
	boq: { id: number; boqNo: string | null } | null;
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
	const { can } = usePermissions();
	if (!can(PERMISSIONS.VIEW_CASHBOOK_BUDGETS)) {
		return (
			<div className='text-muted-foreground'>
				You do not have access to Cashbook Budgets.
			</div>
		);
	}

	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		month: '',
		siteId: '',
		boqId: '',
		sort: 'name',
		order: 'asc',
	});
	const { page, perPage, search, month, siteId, boqId, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			month: string;
			siteId: string;
			boqId: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [monthDraft, setMonthDraft] = useState(month);
	const [siteIdDraft, setSiteIdDraft] = useState(siteId);
	const [boqIdDraft, setBoqIdDraft] = useState(boqId);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
		setMonthDraft(month);
		setSiteIdDraft(siteId);
		setBoqIdDraft(boqId);
	}, [search, month, siteId, boqId]);

	const filtersDirty = searchDraft !== search || monthDraft !== month || siteIdDraft !== siteId || boqIdDraft !== boqId;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			month: monthDraft,
			siteId: siteIdDraft,
			boqId: boqIdDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setMonthDraft('');
		setSiteIdDraft('');
		setBoqIdDraft('');
		setQp({ page: 1, search: '', month: '', siteId: '', boqId: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (month) sp.set('month', month);
		if (siteId) sp.set('siteId', siteId);
		if (boqId) sp.set('boqId', boqId);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/cashbook-budgets?${sp.toString()}`;
	}, [page, perPage, search, month, siteId, boqId, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<CashbookBudgetsResponse>(
		can(PERMISSIONS.VIEW_CASHBOOK_BUDGETS) ? query : null,
		apiGet
	);

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
			key: 'month',
			header: 'Month',
			sortable: true,
			cellClassName: 'font-medium whitespace-nowrap',
		},
		{
			key: 'site',
			header: 'Site',
			sortable: false,
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => r.site.site,
		},
		{
			key: 'boqId',
			header: 'BOQ No',
			sortable: false,
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => r.boq?.boqNo || '-',
		},
		{
			key: 'totalBudget',
			header: 'Budget Amount',
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
			key: 'approved1BudgetAmount',
			header: 'Approved 1 Amount',
			sortable: false,
			className: 'text-right whitespace-nowrap',
			cellClassName: 'text-right font-mono whitespace-nowrap text-blue-600',
			accessor: (r) => r.approved1BudgetAmount ? new Intl.NumberFormat('en-IN', {
				style: 'currency',
				currency: 'INR',
				minimumFractionDigits: 2
			}).format(Number(r.approved1BudgetAmount)) : 'Rs. 0.00',
		},
		{
			key: 'approvedBudgetAmount',
			header: 'Approved 2 Amount',
			sortable: false,
			className: 'text-right whitespace-nowrap',
			cellClassName: 'text-right font-mono whitespace-nowrap text-green-600',
			accessor: (r) => r.approvedBudgetAmount ? new Intl.NumberFormat('en-IN', {
				style: 'currency',
				currency: 'INR',
				minimumFractionDigits: 2
			}).format(Number(r.approvedBudgetAmount)) : 'Rs. 0.00',
		},
		{
			key: 'createdBy',
			header: 'Prepared By',
			sortable: false,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => (
				<div className="text-xs">
					<div className="bg-green-100 text-green-800 px-2 py-1 rounded mb-1">Administrator</div>
					<div className="text-muted-foreground">{formatDate(r.createdAt)}</div>
				</div>
			),
		},
		{
			key: 'approved1By',
			header: 'Approved 1 By',
			sortable: false,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => r.approved1By && r.approved1Datetime ? (
				<div className="text-xs">
					<div className="bg-green-100 text-green-800 px-2 py-1 rounded mb-1">Administrator</div>
					<div className="text-muted-foreground">{formatDate(r.approved1Datetime)}</div>
				</div>
			) : '-',
		},
		{
			key: 'approvedBy',
			header: 'Approved 2 By',
			sortable: false,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
			accessor: (r) => r.approvedBy && r.approvedDatetime ? (
				<div className="text-xs">
					<div className="bg-green-100 text-green-800 px-2 py-1 rounded mb-1">Administrator</div>
					<div className="text-muted-foreground">{formatDate(r.approvedDatetime)}</div>
				</div>
			) : '-',
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
						containerClassName='flex-1'
					/>
					<AppSelect
						value={monthDraft || '__all'}
						onValueChange={(v) => setMonthDraft(v === '__all' ? '' : v)}
						placeholder='Month'
					>
						<AppSelect.Item value='__all'>All Months</AppSelect.Item>
						<AppSelect.Item value='January'>January</AppSelect.Item>
						<AppSelect.Item value='February'>February</AppSelect.Item>
						<AppSelect.Item value='March'>March</AppSelect.Item>
						<AppSelect.Item value='April'>April</AppSelect.Item>
						<AppSelect.Item value='May'>May</AppSelect.Item>
						<AppSelect.Item value='June'>June</AppSelect.Item>
						<AppSelect.Item value='July'>July</AppSelect.Item>
						<AppSelect.Item value='August'>August</AppSelect.Item>
						<AppSelect.Item value='September'>September</AppSelect.Item>
						<AppSelect.Item value='October'>October</AppSelect.Item>
						<AppSelect.Item value='November'>November</AppSelect.Item>
						<AppSelect.Item value='December'>December</AppSelect.Item>
					</AppSelect>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={!filtersDirty && !searchDraft && !monthDraft && !siteIdDraft && !boqIdDraft}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || month || siteId || boqId) && (
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
                  const hasApproved1 = !!budget.approved1By;  // First approval
                  const hasApproved = !!budget.approvedBy;     // Final approval
                  const hasAccepted = !!budget.acceptedBy;     // Acceptance
                  
                  return (
                    <div className='flex gap-1'>
                      {/* View Button */}
                      <Link href={`/cashbook-budgets/${budget.id}/view`}>
                        <AppButton size='sm' variant='ghost' className='h-8 px-2'>
                          View
                        </AppButton>
                      </Link>
                      
                      {/* Edit Button - only if not approved1 */}
                      {can(PERMISSIONS.EDIT_CASHBOOK_BUDGETS) && !hasApproved1 && (
                        <Link href={`/cashbook-budgets/${budget.id}/edit`}>
                          <AppButton size='sm' variant='ghost' className='h-8 px-2'>
                            Edit
                          </AppButton>
                        </Link>
                      )}
                      
                      {/* Approval 1 Button - First approval if not done */}
                      {can(PERMISSIONS.APPROVE_CASHBOOK_BUDGETS_L1) && !hasApproved1 && (
                        <Link href={`/cashbook-budgets/${budget.id}/approve-1`}>
                          <AppButton size='sm' variant='default' className='h-8 px-2 bg-blue-600 hover:bg-blue-700'>
                            Approval 1
                          </AppButton>
                        </Link>
                      )}
                      
                      {/* Approval 2 Button - Second approval only if approved1 but not approved */}
                      {can(PERMISSIONS.APPROVE_CASHBOOK_BUDGETS_L2) && hasApproved1 && !hasApproved && (
                        <Link href={`/cashbook-budgets/${budget.id}/approve`}>
                          <AppButton size='sm' variant='default' className='h-8 px-2 bg-green-600 hover:bg-green-700'>
                            Approval 2
                          </AppButton>
                        </Link>
                      )}
                      
                      {/* Accept Button - only if both approvals done but not accepted */}
                      {can(PERMISSIONS.ACCEPT_CASHBOOK_BUDGETS) && hasApproved && !hasAccepted && (
                        <AppButton 
                          size='sm' 
                          variant='default' 
                          className='h-8 px-2 bg-purple-600 hover:bg-purple-700'
                          onClick={async () => {
                            if (confirm('Accept this cashbook budget?')) {
                              try {
                                await fetch(`/api/cashbook-budgets/${budget.id}/actions`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'accept' }),
                                });
                                toast.success('Budget accepted');
                                mutate();
                              } catch (e) {
                                toast.error('Failed to accept budget');
                              }
                            }
                          }}
                        >
                          Accept
                        </AppButton>
                      )}
                      
                      {/* Delete Button - only if not approved1 (first approval) */}
                      {can(PERMISSIONS.DELETE_CASHBOOK_BUDGETS) && !hasApproved1 && (
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