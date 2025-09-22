'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useProtectPage } from '@/hooks/use-protect-page';
import { CashbookBudgetForm } from '../cashbook-budget-form';

export default function NewCashbookBudgetPage() {
	const { can } = usePermissions();

	useProtectPage({
		redirectForbidden: '/cashbook-budgets'
	});

	if (!can(PERMISSIONS.CREATE_CASHBOOK_BUDGETS)) {
		return null;
	}

	return <CashbookBudgetForm mode='create' />;
}