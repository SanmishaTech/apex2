'use client';

import { CategoryForm } from '../category-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewCategoryPage() {
	useProtectPage();

	return (
		<CategoryForm
			mode='create'
			redirectOnSuccess='/categories'
		/>
	);
}
