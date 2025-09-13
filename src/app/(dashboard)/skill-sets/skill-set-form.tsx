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

export interface SkillSetFormInitialData {
	id?: number;
	skillsetName?: string;
}

export interface SkillSetFormProps {
	mode: 'create' | 'edit';
	initial?: SkillSetFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string; // default '/skill-sets'
}

export function SkillSetForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/skill-sets',
}: SkillSetFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	const schema = z.object({
		skillsetName: z.string().min(1, 'Skill set name is required').max(255, 'Skill set name is too long'),
	});

	type FormValues = z.infer<typeof schema>;
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			skillsetName: initial?.skillsetName || '',
		},
	});
	const { control, handleSubmit } = form;
	const isCreate = mode === 'create';

	async function onSubmit(form: FormValues) {
		setSubmitting(true);
		try {
			if (mode === 'create') {
				const res = await apiPost('/api/skill-sets', {
					skillsetName: form.skillsetName.trim(),
				});
				toast.success('Skill set created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/skill-sets', {
					id: initial.id,
					skillsetName: form.skillsetName.trim(),
				});
				toast.success('Skill set updated');
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
					<AppCard.Title>{isCreate ? 'Create Skill Set' : 'Edit Skill Set'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Add a new skill set.' : 'Update skill set details.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content>
						<FormSection legend='Skill Set Details'>
							<FormRow>
								<TextInput 
									control={control} 
									name='skillsetName' 
									label='Skill Set Name' 
									placeholder='Enter skill set name' 
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
							{isCreate ? 'Create Skill Set' : 'Save Changes'}
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default SkillSetForm;
