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


export interface AssetGroupFormInitialData {
	id?: number;
	assetGroupName?: string;
}

export interface AssetGroupFormProps {
	mode: 'create' | 'edit';
	initial?: AssetGroupFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string; // default '/asset-groups'
}

export function AssetGroupForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/asset-groups',
}: AssetGroupFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	const schema = z.object({
		assetGroupName: z.string().min(1, 'Asset group name is required').max(255, 'Asset group name is too long'),
	});

	type FormValues = z.infer<typeof schema>;
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			assetGroupName: initial?.assetGroupName || '',
		},
	});
	const { control, handleSubmit } = form;
	const isCreate = mode === 'create';

	async function onSubmit(form: FormValues) {
		setSubmitting(true);
		try {
			if (mode === 'create') {
				const res = await apiPost('/api/asset-groups', {
					assetGroupName: form.assetGroupName.trim(),
				});
				toast.success('Asset group created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/asset-groups', {
					id: initial.id,
					assetGroupName: form.assetGroupName.trim(),
				});
				toast.success('Asset group updated');
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
					<AppCard.Title>{isCreate ? 'Create Asset Group' : 'Edit Asset Group'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Add a new asset group.' : 'Update asset group details.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content>
						<FormSection legend='Asset Group Details'>
							<FormRow>
								<TextInput 
									control={control} 
									name='assetGroupName' 
									label='Asset Group Name' 
									placeholder='Enter asset group name' 
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
							{isCreate ? 'Create Asset Group' : 'Save Changes'}
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default AssetGroupForm;
