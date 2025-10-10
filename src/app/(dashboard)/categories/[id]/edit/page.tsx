'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CategoryForm, CategoryFormInitialData } from '../../category-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditCategoryPage() {
	useProtectPage();
	
	const params = useParams<{ id?: string }>();
	const id = params?.id;
	const [initial, setInitial] = useState<CategoryFormInitialData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchCategory() {
			try {
				const category = await apiGet<CategoryFormInitialData>(`/api/categories/${id}`);
				setInitial(category);
			} catch (error) {
				toast.error('Failed to load category');
			} finally {
				setLoading(false);
			}
		}
		if (id) {
			fetchCategory();
		}
	}, [id]);

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!initial) {
		return <div>Category not found</div>;
	}

	return (
		<CategoryForm
			mode='edit'
			initial={initial}
			redirectOnSuccess='/categories'
		/>
	);
}
