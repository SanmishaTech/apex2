'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { toast } from '@/lib/toast';
import { Form } from '@/components/ui/form';
import { EmailInput } from '@/components/common/email-input';
import { PasswordInput } from '@/components/common/password-input';
import { AppCheckbox } from '@/components/common/app-checkbox';

const FormSchema = z.object({
	email: z.string().email({ message: 'Please enter a valid email address.' }),
	password: z.string().min(1, { message: 'Password is required.' }),
	remember: z.boolean().optional().default(false),
});

export default function LoginPage() {
	const router = useRouter();
	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: { email: '', password: '', remember: false },
	});

	const isLoading = form.formState.isSubmitting;

	async function onSubmit(data: z.infer<typeof FormSchema>) {
		try {
			await apiPost('/api/auth/login', data, { showErrorToast: true });
			toast.success('Login Successful', { description: 'Welcome back!' });
			router.push('/dashboard');
		} catch {
			// toast already shown by api-client
		}
	}

	return (
			<AppCard className='w-full max-w-md shadow-sm'>
				<AppCard.Header className='space-y-1 hidden lg:block'>
					<AppCard.Title className='text-xl'>Welcome back 👋</AppCard.Title>
					<AppCard.Description className='text-xs'>Sign in to your account to continue.</AppCard.Description>
				</AppCard.Header>
				<AppCard.Content>
					<Form {...form}>
						<form noValidate onSubmit={form.handleSubmit(onSubmit)} className='space-y-5'>
							<div className='space-y-4'>
								<EmailInput
									control={form.control}
									name='email'
									label='Email or Username'
									placeholder='Enter your email or username'
									disabled={isLoading}
								/>
								<PasswordInput
									control={form.control}
									name='password'
									label='Password'
									disabled={isLoading}
								/>
								<div className='flex items-center justify-between gap-4'>
									<AppCheckbox
										label='Remember Me'
										name='remember'
										checked={form.watch('remember')}
										onCheckedChange={(v) => form.setValue('remember', v)}
										disabled={isLoading}
									/>
									<a href='/forgot-password' className='text-xs font-medium text-primary hover:underline'>Forgot Password?</a>
								</div>
							</div>
							<AppButton
								className='w-full'
								disabled={isLoading || !form.formState.isValid}
								isLoading={isLoading}
							>
								Sign in
							</AppButton>
						</form>
					</Form>
				</AppCard.Content>
			</AppCard>
	);
}
