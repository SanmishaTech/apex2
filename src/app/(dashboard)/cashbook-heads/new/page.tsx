'use client';

import { CashbookHeadForm } from '../cashbook-head-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewCashbookHeadPage() {
	useProtectPage();

	return (
		<CashbookHeadForm
			mode='create'
			redirectOnSuccess='/cashbook-heads'
		/>
	);
}