'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { SelectInput, SelectOption } from '@/components/common/select-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

export interface AssetCategoryFormInitialData {
	id?: number;
	category?: string;
	assetGroupId?: number;
}

export interface AssetCategoryFormProps {
	mode: 'create' | 'edit';
	initial?: AssetCategoryFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string; // default '/asset-categories'
}

type AssetGroup = {
  id: number;
  assetGroupName: string;
};

export function AssetCategoryForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/asset-categories',
}: AssetCategoryFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	// Fetch asset groups for the dropdown
	const { data: assetGroupsData } = useSWR<{ data: AssetGroup[] }>('/api/asset-groups?perPage=100', apiGet);

	const schema = z.object({
		category: z.string().min(1, 'Category is required').max(255, 'Category is too long'),
		assetGroupId: z.string().min(1, 'Asset group is required'),
	});

	type FormValues = z.infer<typeof schema>;
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			category: initial?.category || '',
			assetGroupId: initial?.assetGroupId ? String(initial.assetGroupId) : '',
		},
	});
	const { control, handleSubmit } = form;
	const isCreate = mode === 'create';

	// Convert asset groups to select options
	const assetGroupOptions: SelectOption[] = assetGroupsData?.data?.map(group => ({
		value: String(group.id),
		label: group.assetGroupName,
	})) || [];

	async function onSubmit(form: FormValues) {
		setSubmitting(true);
		try {
			if (mode === 'create') {
				const res = await apiPost('/api/asset-categories', {
					category: form.category.trim(),
					assetGroupId: Number(form.assetGroupId),
				});
				toast.success('Asset category created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/asset-categories', {
					id: initial.id,
					category: form.category.trim(),
					assetGroupId: Number(form.assetGroupId),
				});
				toast.success('Asset category updated');
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
					<AppCard.Title>{isCreate ? 'Create Asset Category' : 'Edit Asset Category'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Add a new asset category.' : 'Update asset category details.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content>
						<FormSection legend='Asset Category Details'>
							<FormRow>
								<SelectInput
									control={control}
									name='assetGroupId'
									label='Asset Group'
									placeholder='Select an asset group'
									options={assetGroupOptions}
									required
								/>
							</FormRow>
							<FormRow>
								<TextInput 
									control={control} 
									name='category' 
									label='Category' 
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
							{isCreate ? 'Create Asset Category' : 'Save Changes'}
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default AssetCategoryForm;