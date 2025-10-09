'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { SelectInput } from '@/components/common/select-input';
import { CheckboxInput } from '@/components/common/checkbox-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

export interface SiteBudgetFormInitialData {
  id?: number;
  siteId?: number;
  itemId?: number;
  budgetQty?: number;
  budgetRate?: number;
  purchaseRate?: number;
  orderedQty?: number;
  avgRate?: number;
  qty50Alert?: boolean;
  value50Alert?: boolean;
  qty75Alert?: boolean;
  value75Alert?: boolean;
}

export interface SiteBudgetFormProps {
  mode: 'create' | 'edit';
  siteId?: number; // For create mode
  initial?: SiteBudgetFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

const inputSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  budgetQty: z.string().min(1, 'Budget Qty is required'),
  budgetRate: z.string().min(1, 'Budget Rate is required'),
  purchaseRate: z.string().min(1, 'Purchase Rate is required'),
  orderedQty: z.string().optional(),
  avgRate: z.string().optional(),
  qty50Alert: z.boolean().optional(),
  value50Alert: z.boolean().optional(),
  qty75Alert: z.boolean().optional(),
  value75Alert: z.boolean().optional(),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues, siteId: number) {
  return {
    siteId,
    itemId: parseInt(data.itemId),
    budgetQty: parseFloat(data.budgetQty),
    budgetRate: parseFloat(data.budgetRate),
    purchaseRate: parseFloat(data.purchaseRate),
    orderedQty: data.orderedQty ? parseFloat(data.orderedQty) : 0,
    avgRate: data.avgRate ? parseFloat(data.avgRate) : 0,
    qty50Alert: data.qty50Alert || false,
    value50Alert: data.value50Alert || false,
    qty75Alert: data.qty75Alert || false,
    value75Alert: data.value75Alert || false,
  };
}

export function SiteBudgetForm({ mode, siteId, initial, onSuccess, redirectOnSuccess }: SiteBudgetFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [budgetValue, setBudgetValue] = useState<number>(0);
  const [orderedValue, setOrderedValue] = useState<number>(0);

  // Fetch dropdown data
  const { data: items } = useSWR('/api/items?perPage=1000', apiGet) as { data: any };
  const { data: site } = useSWR(siteId ? `/api/sites/${siteId}` : null, apiGet) as { data: any };

  // Add effect to style asterisks red after component mounts
  useEffect(() => {
    const styleAsterisks = () => {
      const labels = document.querySelectorAll('label');
      labels.forEach(label => {
        const text = label.textContent || '';
        if (text.includes('*')) {
          const parts = text.split('*');
          if (parts.length === 2) {
            label.innerHTML = `${parts[0]}<span style="color: #ef4444; font-weight: bold;">*</span>${parts[1]}`;
          }
        }
      });
    };

    const timer = setTimeout(styleAsterisks, 100);
    return () => clearTimeout(timer);
  }, []);

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      itemId: initial?.itemId ? String(initial.itemId) : '',
      budgetQty: initial?.budgetQty ? String(initial.budgetQty) : '',
      budgetRate: initial?.budgetRate ? String(initial.budgetRate) : '',
      purchaseRate: initial?.purchaseRate ? String(initial.purchaseRate) : '',
      orderedQty: initial?.orderedQty ? String(initial.orderedQty) : '',
      avgRate: initial?.avgRate ? String(initial.avgRate) : '',
      qty50Alert: initial?.qty50Alert || false,
      value50Alert: initial?.value50Alert || false,
      qty75Alert: initial?.qty75Alert || false,
      value75Alert: initial?.value75Alert || false,
    },
  });

  const { control, handleSubmit, watch } = form;
  const isCreate = mode === 'create';

  // Watch for changes to calculate budget value and ordered value
  const watchedBudgetQty = watch('budgetQty');
  const watchedBudgetRate = watch('budgetRate');
  const watchedOrderedQty = watch('orderedQty');
  const watchedAvgRate = watch('avgRate');

  useEffect(() => {
    const qty = parseFloat(watchedBudgetQty) || 0;
    const rate = parseFloat(watchedBudgetRate) || 0;
    setBudgetValue(qty * rate);
  }, [watchedBudgetQty, watchedBudgetRate]);

  useEffect(() => {
    const qty = parseFloat(watchedOrderedQty ?? '') || 0;
    const rate = parseFloat(watchedAvgRate ?? '') || 0;
    setOrderedValue(qty * rate);
  }, [watchedOrderedQty, watchedAvgRate]);

  async function onSubmit(data: RawFormValues) {
    if (!siteId && !initial?.siteId) {
      toast.error('Site ID is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data, siteId || initial?.siteId!);
      if (isCreate) {
        const res = await apiPost('/api/site-budgets', payload);
        toast.success('Site Budget created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const { siteId: _, ...updatePayload } = payload; // Remove siteId from update
        const res = await apiPatch(`/api/site-budgets/${initial.id}`, updatePayload);
        toast.success('Site Budget updated');
        onSuccess?.(res);
      }
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Prepare dropdown options
  const itemOptions = items?.data?.map((item: any) => ({
    value: String(item.id),
    label: `${item.itemCode} - ${item.item}`,
  })) || [];

  return (
    <>
      <style jsx global>{`
        label {
          color: inherit;
        }
      `}</style>
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>
              {isCreate ? 'Add Budget Item' : 'Edit Budget Item'}
              {site && ` - ${site.site}`}
            </AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new budget item to the site.' : 'Update budget item details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Budget Details</span>}>
                <FormRow cols={2} from='md'>
                  <SelectInput
                    control={control}
                    name='itemId'
                    label='Item *'
                    placeholder='Select item'
                    options={itemOptions}
                    span={2}
                    spanFrom='md'
                  />
                </FormRow>
                <FormRow cols={3} from='md'>
                  <TextInput
                    control={control}
                    name='budgetQty'
                    label='Budget Qty *'
                    placeholder='Enter budget quantity'
                    type='number'
                  />
                  <TextInput
                    control={control}
                    name='budgetRate'
                    label='Budget Rate *'
                    placeholder='Enter budget rate'
                    type='number'
                  />
                  <TextInput
                    control={control}
                    name='purchaseRate'
                    label='Purchase Rate *'
                    placeholder='Enter purchase rate'
                    type='number'
                  />
                </FormRow>
                <FormRow cols={1}>
                  <div className='p-3 bg-muted rounded-md'>
                    <span className='text-sm font-medium'>Budget Value: </span>
                    <span className='text-sm font-bold'>{budgetValue.toFixed(2)}</span>
                  </div>
                </FormRow>
              </FormSection>

              <FormSection legend={<span className='text-base font-semibold'>Ordered Details</span>}>
                <FormRow cols={2} from='md'>
                  <TextInput
                    control={control}
                    name='orderedQty'
                    label='Ordered Qty'
                    placeholder='Enter ordered quantity'
                    type='number'
                  />
                  <TextInput
                    control={control}
                    name='avgRate'
                    label='Avg Rate'
                    placeholder='Enter average rate'
                    type='number'
                  />
                </FormRow>
                <FormRow cols={1}>
                  <div className='p-3 bg-muted rounded-md'>
                    <span className='text-sm font-medium'>Ordered Value: </span>
                    <span className='text-sm font-bold'>{orderedValue.toFixed(2)}</span>
                  </div>
                </FormRow>
              </FormSection>

              <FormSection legend={<span className='text-base font-semibold'>Alerts</span>}>
                <FormRow cols={2} from='md'>
                  <CheckboxInput
                    control={control}
                    name='qty50Alert'
                    label='50 Qty Alert'
                  />
                  <CheckboxInput
                    control={control}
                    name='value50Alert'
                    label='50 Value Alert'
                  />
                </FormRow>
                <FormRow cols={2} from='md'>
                  <CheckboxInput
                    control={control}
                    name='qty75Alert'
                    label='75 Qty Alert'
                  />
                  <CheckboxInput
                    control={control}
                    name='value75Alert'
                    label='75 Value Alert'
                  />
                </FormRow>
              </FormSection>
            </AppCard.Content>

            <AppCard.Footer className='justify-end'>
              <AppButton
                type='button'
                variant='secondary'
                onClick={() => router.back()}
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
                {isCreate ? 'Add Budget Item' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default SiteBudgetForm;
