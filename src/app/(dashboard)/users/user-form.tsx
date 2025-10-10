'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmailInput, PasswordInput, AppButton, ComboboxInput } from '@/components/common';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { ROLES } from '@/config/roles';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface UserFormInitialData {
	id?: number;
	email?: string;
	name?: string | null;
	role?: string;
	status?: boolean;
}

export interface UserFormProps {
	mode: 'create' | 'edit';
	initial?: UserFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string; // default '/users'
}

// Helper function to get role label
function getRoleLabel(roleValue: string): string {
	if (roleValue === 'projectManager') return 'Project Manager';
	if (roleValue === 'siteEngineer') return 'Site Engineer';
	if (roleValue === 'siteIncharge') return 'Site Incharge';
	if (roleValue === 'projectUser') return 'Project User';
	if (roleValue === 'humanResources') return 'HR';
	if (roleValue === 'storeIncharge') return 'Store Incharge';
	if (roleValue === 'siteSupervisor') return 'Site Supervisor';
	if (roleValue === 'generalManager') return 'General Manager';
	if (roleValue === 'safetyIncharge') return 'Safety Incharge';
	if (roleValue === 'billingAssistant') return 'Billing Assistant';
	if (roleValue === 'purchaseManager') return 'Purchase Manager';
	if (roleValue === 'qaqc') return 'QA/QC';
	if (roleValue === 'businessDevelopment') return 'Business Development';
	if (roleValue === 'internalAuditor') return 'Internal Auditor';
	if (roleValue === 'externalAuditor') return 'External Auditor';
	return roleValue.charAt(0).toUpperCase() + roleValue.slice(1);
}

export function UserForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/users',
}: UserFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	// Derive allowed roles from central config
	const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];
	const roleOptions = ROLE_VALUES.map(r => ({ value: r, label: getRoleLabel(r) }));
	const schema = z.object({
		name: z.string().min(1, 'Name is required'),
		email: z.string().email('Invalid email'),
		password: (mode === 'create'
			? z.string().min(6, 'Password must be at least 6 characters')
			: z.string().optional()
		).transform((v) => (v === '' ? undefined : v)),
		role: z.enum(ROLE_VALUES, { required_error: 'Role is required' }),
		status: z.boolean(),
	});

	type RawFormValues = z.infer<typeof schema>; // includes sentinel
	// After transform, role will be 'admin' | 'user'. Use RawFormValues for form type.
	const form = useForm<RawFormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: initial?.name || '',
			email: initial?.email || '',
			password: '',
			// role left undefined for placeholder unless editing with known role
			role: (initial?.role && (ROLE_VALUES as readonly string[]).includes(initial.role)) ? (initial.role as any) : (undefined as unknown as any),
			status: initial?.status ?? true,
		},
	});
	const { control, handleSubmit } = form;
	const statusValue = form.watch('status');
	const isCreate = mode === 'create';

	async function onSubmit(form: RawFormValues) {
		setSubmitting(true);
		try {
			if (mode === 'create') {
				const res = await apiPost('/api/users', {
					name: form.name || null,
					email: form.email,
					password: form.password || undefined,
					role: form.role,
					status: form.status,
				});
				toast.success('User created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/users', {
					id: initial.id,
					name: form.name || null,
					role: form.role,
					status: form.status,
					password: form.password || undefined,
				});
				toast.success('User updated');
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
					<AppCard.Title>{isCreate ? 'Create User' : 'Edit User'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Add a new user account.' : 'Update user details or set a new password.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content>
						<FormSection legend='Login Details'>
							<FormRow>
								<TextInput control={control} name='name' label='Name' placeholder='Optional full name' />
							</FormRow>
							<FormRow cols={2}>
								<EmailInput
									control={control}
									name='email'
									label='Email'
									placeholder='user@example.com'
									required
								/>
								<PasswordInput
									control={control}
									name='password'
									label={isCreate ? 'Password' : 'New Password'}
									placeholder={isCreate ? 'Secret password' : 'Leave blank to keep current'}
									autoComplete='new-password'
								/>
							</FormRow>
							<FormRow cols={2} className='grid-cols-2'>
								<ComboboxInput
									control={control}
									name='role'
									label='Role'
									options={roleOptions}
									placeholder='Select role'
									searchPlaceholder='Search roles...'
									emptyText='No role found.'
									required
								/>
								<AppCheckbox
									label='Active Status'
									checked={statusValue}
									onCheckedChange={(v) => form.setValue('status', v)}
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
							{isCreate ? 'Create User' : 'Save Changes'}
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default UserForm;
