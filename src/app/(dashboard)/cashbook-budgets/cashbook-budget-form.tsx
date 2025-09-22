'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Form, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { AppSelect } from '@/components/common/app-select';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Trash2 } from 'lucide-react';

export interface CashbookBudgetFormInitialData {
	id?: number;
	name?: string;
	month?: string;
	siteId?: number;
	boqName?: string;
	attachCopyUrl?: string;
	approved1Remarks?: string;
	remarksForFinalApproval?: string;
	budgetItems?: Array<{
		id?: number;
		cashbookHeadId?: number;
		description?: string;
		amount?: string;
		cashbookHead?: { id: number; cashbookHeadName: string };
	}>;
}

export interface CashbookBudgetFormProps {
	mode: 'create' | 'edit';
	initial?: CashbookBudgetFormInitialData | null;
	onSuccess?: (result?: unknown) => void;
	redirectOnSuccess?: string;
}

type SitesResponse = {
	data: Array<{ id: number; site: string }>;
};

type CashbookHeadsResponse = {
	data: Array<{ id: number; cashbookHeadName: string }>;
};

const budgetItemSchema = z.object({
	cashbookHeadId: z.string().min(1, 'Cashbook head is required'),
	description: z.string().optional(),
	amount: z.string().min(1, 'Amount is required').refine((val) => {
		const num = Number(val);
		return !isNaN(num) && num > 0;
	}, 'Amount must be a valid positive number'),
});

const schema = z.object({
	name: z.string().min(1, 'Budget name is required').max(255, 'Budget name is too long'),
	month: z.string().min(1, 'Month is required'),
	siteId: z.string().min(1, 'Site is required'),
	boqName: z.string().optional(),
	attachCopyUrl: z.string().optional(),
	approved1Remarks: z.string().optional(),
	remarksForFinalApproval: z.string().optional(),
	budgetItems: z.array(budgetItemSchema).min(1, 'At least one budget item is required'),
});

type FormValues = z.infer<typeof schema>;

// Month options
const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

export function CashbookBudgetForm({
	mode,
	initial,
	onSuccess,
	redirectOnSuccess = '/cashbook-budgets',
}: CashbookBudgetFormProps) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	// Fetch dropdown data
	const { data: sitesData } = useSWR<SitesResponse>('/api/sites?perPage=100', apiGet);
	const { data: cashbookHeadsData } = useSWR<CashbookHeadsResponse>('/api/cashbook-heads?perPage=100', apiGet);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: initial?.name || '',
			month: initial?.month || '',
			siteId: initial?.siteId ? String(initial.siteId) : '',
			boqName: initial?.boqName || '',
			attachCopyUrl: initial?.attachCopyUrl || '',
			approved1Remarks: initial?.approved1Remarks || '',
			remarksForFinalApproval: initial?.remarksForFinalApproval || '',
			budgetItems: (initial?.budgetItems || [{ cashbookHeadId: '', description: '', amount: '' }]).map(item => ({
				cashbookHeadId: item.cashbookHeadId ? String(item.cashbookHeadId) : '',
				description: item.description || '',
				amount: item.amount || '',
			})),
		},
	});

	const { control, handleSubmit, watch } = form;
	const isCreate = mode === 'create';
	const { fields, append, remove } = useFieldArray({ control, name: 'budgetItems' });

	// Watch budget items for total calculation
	const budgetItemsWatch = watch('budgetItems');
	const totalBudget = useMemo(() => {
		return budgetItemsWatch.reduce((sum, item) => {
			const amount = Number(item.amount);
			return sum + (isNaN(amount) ? 0 : amount);
		}, 0);
	}, [budgetItemsWatch]);

	async function onSubmit(data: FormValues) {
		setSubmitting(true);
		try {
			const payload = {
				name: data.name.trim(),
				month: data.month.trim(),
				siteId: Number(data.siteId),
				boqName: data.boqName?.trim() || null,
				attachCopyUrl: data.attachCopyUrl?.trim() || null,
				approved1Remarks: data.approved1Remarks?.trim() || null,
				remarksForFinalApproval: data.remarksForFinalApproval?.trim() || null,
				budgetItems: data.budgetItems.map(item => ({
					cashbookHeadId: Number(item.cashbookHeadId),
					description: item.description?.trim() || '',
					amount: item.amount,
				})),
			};

			if (isCreate) {
				const res = await apiPost('/api/cashbook-budgets', payload);
				toast.success('Cashbook budget created');
				onSuccess?.(res);
			} else if (mode === 'edit' && initial?.id) {
				const res = await apiPatch('/api/cashbook-budgets', { id: initial.id, ...payload });
				toast.success('Cashbook budget updated');
				onSuccess?.(res);
			}
			router.push(redirectOnSuccess);
		} catch (err) {
			toast.error((err as Error).message || 'Failed');
		} finally {
			setSubmitting(false);
		}
	}

	function addBudgetItem() {
		append({ cashbookHeadId: '', description: '', amount: '' });
	}

	function removeBudgetItem(index: number) {
		if (fields.length > 1) {
			remove(index);
		}
	}

	return (
		<Form {...form}>
			<AppCard>
				<AppCard.Header>
					<AppCard.Title>{isCreate ? 'Create Cashbook Budget' : 'Edit Cashbook Budget'}</AppCard.Title>
					<AppCard.Description>
						{isCreate ? 'Create a new monthly cashbook budget with detailed line items.' : 'Update cashbook budget details and items.'}
					</AppCard.Description>
				</AppCard.Header>
				<form noValidate onSubmit={handleSubmit(onSubmit)}>
					<AppCard.Content className="space-y-8">
						{/* Top Section */}
						<FormSection legend='Budget Information'>
							<FormRow>
								<TextInput
									control={control}
									name='name'
									label='Budget Name'
									placeholder='Enter budget name'
									required
								/>
							</FormRow>
							<FormRow>
								<AppSelect
									control={control}
									name='month'
									label='Month'
									placeholder='Select month'
									required
								>
									{MONTHS.map(month => (
										<AppSelect.Item key={month} value={month}>{month}</AppSelect.Item>
									))}
								</AppSelect>
								<AppSelect
									control={control}
									name='siteId'
									label='Site'
									placeholder='Select site'
									required
								>
									{sitesData?.data?.map(site => (
										<AppSelect.Item key={site.id} value={String(site.id)}>{site.site}</AppSelect.Item>
									))}
								</AppSelect>
							</FormRow>
							<FormRow>
								<TextInput
									control={control}
									name='boqName'
									label='Bill Of Quantity'
									placeholder='Enter BOQ name (optional)'
								/>
								<TextInput
									control={control}
									name='attachCopyUrl'
									label='Attach Copy'
									placeholder='Enter file URL (optional)'
									type='url'
								/>
							</FormRow>
						</FormSection>

						{/* Budget Items Table */}
						<FormSection legend='Cashbook Budget Details'>
							<div className="border rounded-lg overflow-hidden">
								{/* Table Header */}
								<div className="grid grid-cols-12 gap-0 bg-gray-100 border-b">
									<div className="col-span-4 px-4 py-3 font-medium text-sm text-gray-700 border-r">Cashbook Head</div>
									<div className="col-span-4 px-4 py-3 font-medium text-sm text-gray-700 border-r">Description</div>
									<div className="col-span-3 px-4 py-3 font-medium text-sm text-gray-700 border-r">Amount</div>
									<div className="col-span-1 px-4 py-3 font-medium text-sm text-gray-700 text-center">Action</div>
								</div>

								{/* Table Rows */}
								{fields.map((field, index) => (
									<div key={field.id} className="grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-gray-50">
										<div className="col-span-4 p-3 border-r">
											<FormField
												control={control}
												name={`budgetItems.${index}.cashbookHeadId`}
												render={({ field }) => (
													<Select onValueChange={field.onChange} value={field.value}>
														<SelectTrigger className="w-full h-10 border-gray-300">
															<SelectValue placeholder="Select cashbook head" />
														</SelectTrigger>
														<SelectContent>
															{cashbookHeadsData?.data?.map(head => (
																<SelectItem key={head.id} value={String(head.id)}>
																	{head.cashbookHeadName}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<div className="col-span-4 p-3 border-r">
											<FormField
												control={control}
												name={`budgetItems.${index}.description`}
												render={({ field }) => (
													<Input
														{...field}
														placeholder="Enter description (optional)"
														className="w-full h-10 border-gray-300"
														value={field.value ?? ''}
													/>
												)}
											/>
										</div>
										<div className="col-span-3 p-3 border-r">
											<FormField
												control={control}
												name={`budgetItems.${index}.amount`}
												render={({ field }) => (
													<Input
														{...field}
														type="number"
														step="0.01"
														min="0"
														placeholder="0.00"
														className="w-full h-10 border-gray-300"
														value={field.value ?? ''}
													/>
												)}
											/>
										</div>
										<div className="col-span-1 p-3 flex items-center justify-center">
											{fields.length > 1 && (
												<AppButton
													type='button'
													variant='destructive'
													size='sm'
													onClick={() => removeBudgetItem(index)}
													className='h-8 w-8 p-0'
												>
													<Trash2 className='h-4 w-4' />
												</AppButton>
											)}
										</div>
									</div>
								))}
							</div>

							{/* Add Item Button & Total */}
							<div className='flex justify-between items-center pt-4 border-t'>
								<AppButton
									type='button'
									variant='outline'
									onClick={addBudgetItem}
									iconName='Plus'
								>
									Add Item
								</AppButton>
								<div className='text-right'>
									<div className='text-sm text-gray-600'>Total Budget</div>
									<div className='text-lg font-bold text-gray-900'>
										{new Intl.NumberFormat('en-IN', {
											style: 'currency',
											currency: 'INR',
											minimumFractionDigits: 2
										}).format(totalBudget)}
									</div>
								</div>
							</div>
						</FormSection>

						{/* Remarks Section */}
						<FormSection legend='Remarks'>
							<FormRow>
								<TextareaInput
									control={control}
									name='approved1Remarks'
									label='Approved 1 Remarks'
									placeholder='Enter first approval remarks'
									rows={3}
								/>
							</FormRow>
							<FormRow>
								<TextareaInput
									control={control}
									name='remarksForFinalApproval'
									label='Remarks For Final Approval'
									placeholder='Enter final approval remarks'
									rows={3}
								/>
							</FormRow>
						</FormSection>
					</AppCard.Content>

					{/* Action Buttons */}
					<AppCard.Footer className='justify-end space-x-4'>
						<AppButton
							type='button'
							variant='secondary'
							onClick={() => router.push(redirectOnSuccess)}
							disabled={submitting}
						>
							Cancel
						</AppButton>
						<AppButton
							type='submit'
							isLoading={submitting}
							disabled={submitting || !form.formState.isValid}
						>
							Save
						</AppButton>
					</AppCard.Footer>
				</form>
			</AppCard>
		</Form>
	);
}

export default CashbookBudgetForm;