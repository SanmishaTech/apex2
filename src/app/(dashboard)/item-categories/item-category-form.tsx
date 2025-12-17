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
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface ItemCategoryFormInitialData {
  id?: number;
  itemCategoryCode?: string | null;
  itemCategory?: string | null;
}

export interface ItemCategoryFormProps {
  mode: 'create' | 'edit';
  initial?: ItemCategoryFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/item-categories'
  mutate?: () => Promise<any>;
}

const inputSchema = z.object({
  itemCategoryCode: z.string().min(1, 'Item Category Code is required'),
  itemCategory: z.string().min(1, 'Item Category is required'),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    itemCategoryCode: data.itemCategoryCode?.trim() || null,
    itemCategory: data.itemCategory?.trim() || null,
  };
}

export function ItemCategoryForm({ mode, initial, onSuccess, redirectOnSuccess = '/item-categories', mutate }: ItemCategoryFormProps) {
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
      itemCategoryCode: initial?.itemCategoryCode || '',
      itemCategory: initial?.itemCategory || '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost('/api/item-categories', payload);
        toast.success('Item Category created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/item-categories', { id: initial.id, ...payload });
        toast.success('Item Category updated');
        onSuccess?.(res);
      }
      // Invalidate and revalidate the cache similar to states implementation
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
            <AppCard.Title>{isCreate ? 'Create Item Category' : 'Edit Item Category'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new Item Category.' : 'Update Item Category details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Category Details</span>}>
                <FormRow cols={2} from='md'>
                  <TextInput 
                    control={control} 
                    name='itemCategoryCode' 
                    label='Item Category Code *' 
                    placeholder='Enter item category code'
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='itemCategory' 
                    label='Item Category *' 
                    placeholder='Enter item category name'
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
                {isCreate ? 'Create Item Category' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default ItemCategoryForm;
