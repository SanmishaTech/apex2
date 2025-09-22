'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CashbookHeadForm, CashbookHeadFormInitialData } from '../../cashbook-head-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditCashbookHeadPage() {
	useProtectPage();

	const params = useParams();
	const id = params.id as string;
	const [initial, setInitial] = useState<CashbookHeadFormInitialData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchCashbookHead() {
			try {
				const cashbookHead = await apiGet(`/api/cashbook-heads/${id}`);
				setInitial(cashbookHead);
			} catch (error) {
				toast.error('Failed to load cashbook head');
			} finally {
				setLoading(false);
			}
		}
		if (id) {
			fetchCashbookHead();
		}
	}, [id]);

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!initial) {
		return <div>Cashbook head not found</div>;
	}

	return (
		<CashbookHeadForm
			mode='edit'
			initial={initial}
			redirectOnSuccess='/cashbook-heads'
		/>
	);
}