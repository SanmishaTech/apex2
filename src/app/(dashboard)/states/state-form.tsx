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
import { CreateStateData, UpdateStateData } from '@/types/states';

export interface StateFormInitialData {
  id?: number;
  state?: string;
  status?: boolean;
}

export interface StateFormProps {
  mode: 'create' | 'edit';
  initial?: StateFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function StateForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/states',
}: StateFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    state: z.string().min(1, 'State name is required'),
    status: z.boolean(),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      state: initial?.state ?? '',
      status: initial?.status ?? true,
    },
  });

  const { control, handleSubmit } = form;
  const statusValue = form.watch('status');
  const isCreate = mode === 'create';

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateStateData = {
          state: formData.state,
          status: formData.status,
        };
        const res = await apiPost('/api/states', payload);
        toast.success('State created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateStateData = {
          state: formData.state,
          status: formData.status,
        };
        const res = await apiPatch(`/api/states/${initial.id}`, payload);
        toast.success('State updated successfully');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save state');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create State' : 'Edit State'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new state to the master data.' : 'Update state information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='State Information'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='state' 
                  label='State Name' 
                  placeholder='Enter state name'
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
              {isCreate ? 'Create State' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default StateForm;
