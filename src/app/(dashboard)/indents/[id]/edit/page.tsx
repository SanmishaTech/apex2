'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { IndentForm, IndentFormInitialData } from '../../indent-form';
import { AppCard } from '@/components/common/app-card';
import { toast } from '@/lib/toast';
import type { Indent } from '@/types/indents';

export default function EditIndentPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	const [initialData, setInitialData] = useState<IndentFormInitialData | null>(null);

	// Build redirect URL with preserved query parameters
	const redirectUrl = searchParams.toString() 
		? `/indents?${searchParams.toString()}` 
		: '/indents';

	const { data, error, isLoading } = useSWR<Indent>(
		id ? `/api/indents/${id}` : null,
		apiGet
	);

	useEffect(() => {
		if (data) {
			setInitialData({
				id: data.id,
				indentNo: data.indentNo,
				indentDate: data.indentDate,
				siteId: data.siteId,
				deliveryDate: data.deliveryDate,
				remarks: data.remarks,
				indentItems: data.indentItems,
			});
		}
	}, [data]);

	if (error) {
		toast.error((error as Error).message || 'Failed to load indent');
		return (
			<AppCard>
				<AppCard.Content className="p-6">
					<p className="text-destructive">Failed to load indent data</p>
				</AppCard.Content>
			</AppCard>
		);
	}

	if (isLoading || !initialData) {
		return (
			<AppCard>
				<AppCard.Content className="p-6">
					<p>Loading indent data...</p>
				</AppCard.Content>
			</AppCard>
		);
	}

	return <IndentForm mode="edit" initial={initialData} redirectOnSuccess={redirectUrl} />;
}
