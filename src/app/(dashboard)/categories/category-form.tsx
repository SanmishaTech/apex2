'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface CategoryFormInitialData {
	id?: number;
	categoryName?: string;
}

export interface CategoryFormProps {
	mode: 'create' | 'edit';
	initial?: CategoryFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string; // default '/categories'
}

export function CategoryForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/categories',
}: CategoryFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	const schema = z.object({
		categoryName: z.string().min(1, 'Category name is required').max(255, 'Category name is too long'),
	});

	type FormValues = z.infer<typeof schema>;
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			categoryName: initial?.categoryName || '',
		},
	});
	const { control, handleSubmit } = form;
	const isCreate = mode === 'create';

	async function onSubmit(form: FormValues) {
		setSubmitting(true);
		try {
			if (mode === 'create') {
				const res = await apiPost('/api/categories', {
					categoryName: form.categoryName.trim(),
				});
				toast.success('Category created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/categories', {
					id: initial.id,
					categoryName: form.categoryName.trim(),
				});
				toast.success('Category updated');
				onSuccess?.(res);
			}
			router.push(redirectOnSuccess);
		} catch (err) {
			toast.error((err as Error).message || 'Failed');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Form {...form}>
			<AppCard>
				<AppCard.Header>
					<AppCard.Title>{isCreate ? 'Create Category' : 'Edit Category'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Add a new category to organize your data.' : 'Update category details.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content>
						<FormSection legend='Category Details'>
							<FormRow>
								<TextInput 
									control={control} 
									name='categoryName' 
									label='Category Name' 
									placeholder='Enter category name' 
									required
								/>
							</FormRow>
						</FormSection>
					</AppCard.Content>
					<AppCard.Footer className='justify-end'>
						<AppButton
							type='button'
							variant='secondary'
							onClick={() => router.push(redirectOnSuccess)}
							disabled={submitting}
							iconName='X'
						>
							Cancel
						</AppButton>
						<AppButton
							type='submit'
							iconName={isCreate ? 'Plus' : 'Save'}
							isLoading={submitting}
							disabled={submitting || !form.formState.isValid}
						>
							{isCreate ? 'Create Category' : 'Save Changes'}
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default CategoryForm;
