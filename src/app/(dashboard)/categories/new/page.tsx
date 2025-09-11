'use client';

import { CategoryForm } from '../category-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';

export default function NewCategoryPage() {
	useProtectPage([PERMISSIONS.EDIT_CATEGORIES]);

	return (
		<CategoryForm
			mode='create'
			redirectOnSuccess='/categories'
		/>
	);
}
