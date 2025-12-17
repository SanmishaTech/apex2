'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface PaymentTermFormInitialData {
  id?: number;
  paymentTerm?: string | null;
  description?: string | null;
}

export interface PaymentTermFormProps {
  mode: 'create' | 'edit';
  initial?: PaymentTermFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/payment-terms'
  mutate?: () => Promise<any>;
}

const inputSchema = z.object({
  paymentTerm: z.string().min(1, 'Payment Term is required'),
  description: z.string().optional(),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    paymentTerm: data.paymentTerm?.trim() || null,
    description: data.description?.trim() || null,
  };
}

export function PaymentTermForm({ mode, initial, onSuccess, redirectOnSuccess = '/payment-terms', mutate }: PaymentTermFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

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

  const form = useForm<RawFormValues>({
    resolver: zodResolver(inputSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      paymentTerm: initial?.paymentTerm || '',
      description: initial?.description || '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost('/api/payment-terms', payload);
        toast.success('Payment Term created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch(`/api/payment-terms/${initial.id}`, payload);
        toast.success('Payment Term updated');
        onSuccess?.(res);
      }
      if (mutate) {
        await mutate();
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
            <AppCard.Title>{isCreate ? 'Create Payment Term' : 'Edit Payment Term'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new Payment Term.' : 'Update Payment Term details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Payment Term Details</span>}>
                <FormRow cols={1}>
                  <TextInput 
                    control={control} 
                    name='paymentTerm' 
                    label='Payment Term *' 
                    placeholder='Enter payment term'
                  />
                </FormRow>
                <FormRow cols={1}>
                  <TextareaInput 
                    control={control} 
                    name='description' 
                    label='Description' 
                    placeholder='Enter description (optional)'
                    rows={4}
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
                {isCreate ? 'Create Payment Term' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default PaymentTermForm;
