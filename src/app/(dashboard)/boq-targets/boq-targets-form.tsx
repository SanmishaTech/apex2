'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { AppSelect } from '@/components/common/app-select';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { SitesResponse } from '@/types/sites';

export interface BoqTargetsFormInitialData {
  id?: number;
  siteId?: number | null;
  boqId?: number | null;
  activityId?: string | null;
  fromTargetDate?: string | null;
  toTargetDate?: string | null;
  dailyTargetQty?: string | number | null;
}

export interface BoqTargetsFormProps {
  mode: 'create' | 'edit';
  initial?: BoqTargetsFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/boq-targets'
}

const inputSchema = z.object({
  siteId: z.string().min(1, 'Site is required'),
  boqId: z.string().min(1, 'Bill of Quantity is required'),
  activityId: z.string().min(1, 'Activity is required'),
  fromTargetDate: z.string().min(1, 'From target date is required'),
  toTargetDate: z.string().min(1, 'To target date is required'),
  dailyTargetQty: z.string().min(1, 'Daily target quantity is required'),
}).refine((data) => {
  if (data.fromTargetDate && data.toTargetDate) {
    return new Date(data.fromTargetDate) <= new Date(data.toTargetDate);
  }
  return true;
}, {
  message: "To target date must be after or equal to from target date",
  path: ["toTargetDate"],
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    siteId: data.siteId && data.siteId !== '' ? parseInt(data.siteId) : null,
    boqId: data.boqId && data.boqId !== '' ? parseInt(data.boqId) : null,
    activityId: data.activityId?.trim() || null,
    fromTargetDate: data.fromTargetDate && data.fromTargetDate !== '' ? new Date(data.fromTargetDate).toISOString() : null,
    toTargetDate: data.toTargetDate && data.toTargetDate !== '' ? new Date(data.toTargetDate).toISOString() : null,
    dailyTargetQty: data.dailyTargetQty && data.dailyTargetQty !== '' ? data.dailyTargetQty : null, // keep as string for Decimal
  };
}

export function BoqTargetsForm({ mode, initial, onSuccess, redirectOnSuccess = '/boq-targets' }: BoqTargetsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedBoqId, setSelectedBoqId] = useState<string>('');

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

    // Run after a short delay to ensure DOM is ready
    const timer = setTimeout(styleAsterisks, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch sites for dropdown
  const { data: sitesData } = useSWR<SitesResponse>('/api/sites?perPage=100', apiGet);
  
  // Fetch BOQs for dropdown
  const { data: boqsData } = useSWR<any>('/api/boqs?perPage=100', apiGet);
  
  // Fetch activities based on selected BOQ
  const { data: activitiesData } = useSWR<any>(
    selectedBoqId ? `/api/boqs/${selectedBoqId}/activities` : null, 
    apiGet
  );

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : '',
      boqId: initial?.boqId ? String(initial.boqId) : '',
      activityId: initial?.activityId || '',
      fromTargetDate: initial?.fromTargetDate ? initial.fromTargetDate.split('T')[0] : '',
      toTargetDate: initial?.toTargetDate ? initial.toTargetDate.split('T')[0] : '',
      dailyTargetQty: initial?.dailyTargetQty != null ? String(initial.dailyTargetQty) : '',
    },
  });

  const { control, handleSubmit, watch, setValue } = form;
  const isCreate = mode === 'create';
  const watchedBoqId = watch('boqId');
  const watchedFromDate = watch('fromTargetDate');

  // Update selectedBoqId when form value changes
  useEffect(() => {
    setSelectedBoqId(watchedBoqId);
    // Reset activity when BOQ changes
    if (watchedBoqId !== selectedBoqId) {
      setValue('activityId', '');
    }
  }, [watchedBoqId, selectedBoqId, setValue]);

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost('/api/boq-targets', payload);
        toast.success('BOQ Target created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/boq-targets', { id: initial.id, ...payload });
        toast.success('BOQ Target updated');
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
    <>
      <style jsx global>{`
        /* Ensure labels maintain their original color while asterisks are styled by JavaScript */
        label {
          color: inherit;
        }
      `}</style>
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>{isCreate ? 'Create BOQ Target' : 'Edit BOQ Target'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new BOQ Target.' : 'Update BOQ Target details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Target Details</span>}>
                <FormRow cols={2} from='md'>
                  <AppSelect
                    control={control}
                    name='siteId'
                    label='Site *'
                    placeholder='Select site'
                    triggerClassName='h-9 w-full'
                  >
                    {sitesData?.data?.map(s => (
                      <AppSelect.Item key={s.id} value={String(s.id)}>{s.site}</AppSelect.Item>
                    ))}
                  </AppSelect>
                  
                  <AppSelect
                    control={control}
                    name='boqId'
                    label='Bill Of Quantity *'
                    placeholder='Select BOQ'
                    triggerClassName='h-9 w-full'
                  >
                    {boqsData?.data?.map((boq: any) => (
                      <AppSelect.Item key={boq.id} value={String(boq.id)}>
                        {boq.boqNo || `BOQ ${boq.id}`}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </FormRow>

                <FormRow cols={2} from='md'>
                  <AppSelect
                    control={control}
                    name='activityId'
                    label='Activity *'
                    placeholder='Select activity'
                    triggerClassName='h-9 w-full'
                    disabled={!selectedBoqId}
                  >
                    {activitiesData?.map((activity: any) => (
                      <AppSelect.Item key={activity.activityId} value={activity.activityId}>
                        {activity.activityId} - {activity.item}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                  
                  <TextInput 
                    control={control} 
                    name='dailyTargetQty' 
                    label='Daily Target Qty *' 
                    type='number' 
                    placeholder='Enter daily target quantity'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                <FormRow cols={2} from='md'>
                  <TextInput 
                    control={control} 
                    name='fromTargetDate' 
                    label='From Target Date *' 
                    type='date' 
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='toTargetDate' 
                    label='To Target Date *' 
                    type='date' 
                    span={1} 
                    spanFrom='md' 
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
                {isCreate ? 'Create BOQ Target' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default BoqTargetsForm;
