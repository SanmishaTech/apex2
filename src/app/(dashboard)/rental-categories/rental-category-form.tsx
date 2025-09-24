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

export interface RentalCategoryFormInitialData {
  id?: number;
  rentalCategory?: string;
}

export interface RentalCategoryFormProps {
  mode: 'create' | 'edit';
  initial?: RentalCategoryFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/rental-categories'
}

export function RentalCategoryForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/rental-categories',
}: RentalCategoryFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    rentalCategory: z.string().min(1, 'Rental category is required').max(255, 'Too long'),
  });

  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      rentalCategory: initial?.rentalCategory || '',
    },
  });
  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/rental-categories', {
          rentalCategory: values.rentalCategory.trim(),
        });
        toast.success('Rental category created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/rental-categories', {
          id: initial.id,
          rentalCategory: values.rentalCategory.trim(),
        });
        toast.success('Rental category updated');
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
          <AppCard.Title>{isCreate ? 'Create Rental Category' : 'Edit Rental Category'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new rental category.' : 'Update rental category details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Rental Category Details'>
              <FormRow>
                <TextInput
                  control={control}
                  name='rentalCategory'
                  label='Rental Category'
                  placeholder='Enter rental category'
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
              {isCreate ? 'Create Rental Category' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default RentalCategoryForm;
