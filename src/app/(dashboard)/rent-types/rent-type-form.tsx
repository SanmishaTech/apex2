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
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { CreateRentTypeData, UpdateRentTypeData } from '@/types/rent-types';

export interface RentTypeFormInitialData {
  id?: number;
  rentType?: string;
}

export interface RentTypeFormProps {
  mode: 'create' | 'edit';
  initial?: RentTypeFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
  mutate?: () => Promise<any>;
}

export function RentTypeForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/rent-types',
  mutate,
}: RentTypeFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration('rent-types-list');

  const schema = z.object({
    rentType: z.string().min(1, 'Rent type is required'),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      rentType: initial?.rentType ?? '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateRentTypeData = {
          rentType: formData.rentType,
        };
        const res = await apiPost('/api/rent-types', payload);
        toast.success('Rent type created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateRentTypeData = {
          rentType: formData.rentType,
        };
        const res = await apiPatch(`/api/rent-types/${initial.id}`, payload);
        toast.success('Rent type updated successfully');
        onSuccess?.(res);
      }
      if (mutate) {
        await mutate();
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save rent type');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Rent Type' : 'Edit Rent Type'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new rent type to the master data.' : 'Update rent type information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Rent Type Information'>
              <FormRow cols={1}>
                <TextInput 
                  control={control} 
                  name='rentType' 
                  label='Rent Type' 
                  placeholder='Enter rent type name'
                  required
                />
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className='justify-end'>
            <AppButton
              type='button'
              variant='secondary'
              onClick={backWithScrollRestore}
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
              {isCreate ? 'Create Rent Type' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default RentTypeForm;
