'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { CreateCityData, UpdateCityData } from '@/types/cities';
import { State } from '@/types/states';
import { AppSelect } from '@/components/common/app-select';
import { apiGet } from '@/lib/api-client';
import useSWR from 'swr';

export interface CityFormInitialData {
  id?: number;
  city?: string;
  status?: boolean;
  stateId?: number | null;
}

export interface CityFormProps {
  mode: 'create' | 'edit';
  initial?: CityFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function CityForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/cities',
}: CityFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    city: z.string().min(1, 'City name is required'),
    status: z.boolean(),
    stateId: z.number().optional().nullable(),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      city: initial?.city ?? '',
      status: initial?.status ?? true,
      stateId: initial?.stateId ?? null,
    },
  });

  const { control, handleSubmit } = form;
  const statusValue = form.watch('status');
  const stateIdValue = form.watch('stateId');
  const isCreate = mode === 'create';

  // Fetch states for dropdown
  const { data: statesData } = useSWR<{data: State[]}>('/api/states?perPage=100', apiGet);

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateCityData = {
          city: formData.city,
          status: formData.status,
          stateId: formData.stateId,
        };
        const res = await apiPost('/api/cities', payload);
        toast.success('City created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateCityData = {
          city: formData.city,
          status: formData.status,
          stateId: formData.stateId,
        };
        const res = await apiPatch(`/api/cities/${initial.id}`, payload);
        toast.success('City updated successfully');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save city');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create City' : 'Edit City'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new city to the master data.' : 'Update city information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='City Information'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='city' 
                  label='City Name' 
                  placeholder='Enter city name'
                  required
                />
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>State</label>
                  <AppSelect
                    value={stateIdValue ? String(stateIdValue) : '__none'}
                    onValueChange={(value) => {
                      const numValue = value === '__none' ? null : parseInt(value);
                      form.setValue('stateId', numValue);
                    }}
                    placeholder='Select state'
                  >
                    <AppSelect.Item value='__none'>No State</AppSelect.Item>
                    {statesData?.data?.map((state: State) => (
                      <AppSelect.Item key={state.id} value={String(state.id)}>
                        {state.state}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
              <FormRow cols={1}>
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
              {isCreate ? 'Create City' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default CityForm;
