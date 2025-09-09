'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
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
import { StatusBadge } from '@/components/common/status-badge';
import { formatCurrency, formatRelativeTime, formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';
import { apiDelete } from '@/lib/api-client';

type UserListItem = {
	id: number;
	name: string | null;
	email: string;
	role: string;
	status: boolean;
	lastLogin: string | null;
	createdAt: string;
};

type UsersResponse = {
	data: UserListItem[];
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
};

export default function UsersPage() {
	const [qp, setQp] = useQueryParamsState({
		page: 1,
		perPage: 10,
		search: '',
		role: '',
		status: '',
		sort: 'createdAt',
		order: 'desc',
	});
	const { page, perPage, search, role, status, sort, order } =
		qp as unknown as {
			page: number;
			perPage: number;
			search: string;
			role: string;
			status: string;
			sort: string;
			order: 'asc' | 'desc';
		};

	// Local filter draft state (only applied when clicking Filter)
	const [searchDraft, setSearchDraft] = useState(search);
	const [roleDraft, setRoleDraft] = useState(role);
	const [statusDraft, setStatusDraft] = useState(status);

	// Sync drafts when query params change externally (e.g., back navigation)
	useEffect(() => {
		setSearchDraft(search);
	}, [search]);
	useEffect(() => {
		setRoleDraft(role);
	}, [role]);
	useEffect(() => {
		setStatusDraft(status);
	}, [status]);

	const filtersDirty =
		searchDraft !== search || roleDraft !== role || statusDraft !== status;

	function applyFilters() {
		setQp({
			page: 1,
			search: searchDraft.trim(),
			role: roleDraft,
			status: statusDraft,
		});
	}

	function resetFilters() {
		setSearchDraft('');
		setRoleDraft('');
		setStatusDraft('');
		setQp({ page: 1, search: '', role: '', status: '' });
	}

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('page', String(page));
		sp.set('perPage', String(perPage));
		if (search) sp.set('search', search);
		if (role) sp.set('role', role);
		if (status) sp.set('status', status);
		if (sort) sp.set('sort', sort);
		if (order) sp.set('order', order);
		return `/api/users?${sp.toString()}`;
	}, [page, perPage, search, role, status, sort, order]);

	const { data, error, isLoading, mutate } = useSWR<UsersResponse>(
		query,
		apiGet
	);

	const { can } = usePermissions();

	if (error) {
		toast.error((error as Error).message || 'Failed to load users');
	}

	function toggleSort(field: string) {
		if (sort === field) {
			setQp({ order: order === 'asc' ? 'desc' : 'asc' });
		} else {
			setQp({ sort: field, order: 'asc' });
		}
	}

	const columns: Column<UserListItem>[] = [
		{
			key: 'name',
			header: 'Name',
			sortable: true,
			accessor: (r) => r.name || '—',
			cellClassName: 'font-medium whitespace-nowrap',
		},
		{
			key: 'email',
			header: 'Email',
			sortable: true,
			cellClassName: 'break-words',
		},
		{
			key: 'role',
			header: 'Role',
			sortable: true,
			accessor: (r) => <span className='capitalize'>{r.role}</span>,
			className: 'whitespace-nowrap',
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'status',
			header: 'Status',
			sortable: true,
			accessor: (r) => <StatusBadge active={r.status} />,
			cellClassName: 'whitespace-nowrap',
		},
		{
			key: 'invoice_amount',
			header: 'Invoice',
			sortable: true,
			className: 'text-right whitespace-nowrap',
			cellClassName: 'text-right tabular-nums whitespace-nowrap',
			accessor: () => {
				const min = 15000;
				const max = 1000000;
				const amount = Math.floor(Math.random() * (max - min + 1)) + min;
				return formatCurrency(amount);
			},
		},
		{
			key: 'lastLogin',
			header: 'Last Login',
			sortable: true,
			className: 'whitespace-nowrap',
			cellClassName: 'text-muted-foreground whitespace-nowrap',
			accessor: (r) => (r.lastLogin ? formatRelativeTime(r.lastLogin) : '—'),
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

	// Status is read-only; added delete capability with confirmation.

	async function handleDelete(id: number) {
		try {
			await apiDelete(`/api/users/${id}`);
			toast.success('User deleted');
			await mutate();
		} catch (e) {
			toast.error((e as Error).message);
		}
	}

	return (
		<AppCard>
			<AppCard.Header>
				<AppCard.Title>Users</AppCard.Title>
				<AppCard.Description>Manage application users.</AppCard.Description>
				{can(PERMISSIONS.EDIT_USERS) && (
					<AppCard.Action>
						<Link href='/users/new'>
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
						aria-label='Search users'
						placeholder='Search users...'
						value={searchDraft}
						onChange={(e) => setSearchDraft(e.target.value)}
						containerClassName='w-full'
					/>
					<AppSelect
						value={roleDraft || '__all'}
						onValueChange={(v) => setRoleDraft(v === '__all' ? '' : v)}
						placeholder='Role'
					>
						<AppSelect.Item value='__all'>All Roles</AppSelect.Item>
						<AppSelect.Item value='admin'>Admin</AppSelect.Item>
						<AppSelect.Item value='user'>User</AppSelect.Item>
					</AppSelect>
					<AppSelect
						value={statusDraft || '__all'}
						onValueChange={(v) => setStatusDraft(v === '__all' ? '' : v)}
						placeholder='Status'
					>
						<AppSelect.Item value='__all'>All Statuses</AppSelect.Item>
						<AppSelect.Item value='true'>Active</AppSelect.Item>
						<AppSelect.Item value='false'>Inactive</AppSelect.Item>
					</AppSelect>
					<AppButton
						size='sm'
						onClick={applyFilters}
						disabled={
							!filtersDirty && !searchDraft && !roleDraft && !statusDraft
						}
						className='min-w-[84px]'
					>
						Filter
					</AppButton>
					{(search || role || status) && (
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
					renderRowActions={(u) => {
						if (!can(PERMISSIONS.EDIT_USERS) && !can(PERMISSIONS.DELETE_USERS))
							return null;
						return (
							<div className='flex'>
								{can(PERMISSIONS.EDIT_USERS) && (
									<Link href={`/users/${u.id}/edit`}>
										<EditButton tooltip='Edit User' aria-label='Edit User' />
									</Link>
								)}
								{can(PERMISSIONS.DELETE_USERS) && (
									<DeleteButton
										onDelete={() => handleDelete(u.id)}
										itemLabel='user'
										title='Delete user?'
										description={`This will permanently remove user #${u.id}. This action cannot be undone.`}
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
