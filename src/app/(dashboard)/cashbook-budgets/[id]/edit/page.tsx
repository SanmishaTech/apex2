'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useProtectPage } from '@/hooks/use-protect-page';
import { CashbookBudgetForm, CashbookBudgetFormInitialData } from '../../cashbook-budget-form';
import { toast } from '@/lib/toast';

type CashbookBudgetResponse = {
	id: number;
	name: string;
	month: string;
	totalBudget: string;
	siteId: number;
	boqName: string | null;
	attachCopyUrl: string | null;
	approved1Remarks: string | null;
	remarksForFinalApproval: string | null;
	budgetItems: Array<{
		id: number;
		cashbookHeadId: number;
		description: string;
		amount: string;
		cashbookHead: { id: number; cashbookHeadName: string };
	}>;
	site: { id: number; site: string };
	createdAt: string;
	updatedAt: string;
};

export default function EditCashbookBudgetPage() {
	const params = useParams();
	const { can } = usePermissions();
	const id = params.id as string;

	useProtectPage({
		redirectForbidden: '/cashbook-budgets'
	});

	const { data, error, isLoading } = useSWR<CashbookBudgetResponse>(
		id ? `/api/cashbook-budgets/${id}` : null,
		apiGet
	);

	if (error) {
		toast.error((error as Error).message || 'Failed to load cashbook budget');
	}

	if (!can(PERMISSIONS.EDIT_CASHBOOK_BUDGETS)) {
		return null;
	}

	if (isLoading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<div className='text-muted-foreground'>Loading...</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className='flex items-center justify-center h-64'>
				<div className='text-muted-foreground'>Cashbook budget not found</div>
			</div>
		);
	}

	const initialData: CashbookBudgetFormInitialData = {
		id: data.id,
		name: data.name,
		month: data.month,
		siteId: data.siteId,
		boqName: data.boqName,
		attachCopyUrl: data.attachCopyUrl,
		approved1Remarks: data.approved1Remarks,
		remarksForFinalApproval: data.remarksForFinalApproval,
		budgetItems: data.budgetItems.map(item => ({
			id: item.id,
			cashbookHeadId: item.cashbookHeadId,
			description: item.description,
			amount: item.amount,
			cashbookHead: item.cashbookHead,
		})),
	};

	return <CashbookBudgetForm mode='edit' initial={initialData} />;
}