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
import { SelectInput } from '@/components/common/select-input';
import { CheckboxInput } from '@/components/common/checkbox-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

export interface ItemFormInitialData {
  id?: number;
  itemCode?: string | null;
  hsnCode?: string | null;
  item?: string | null;
  itemCategoryId?: number | null;
  unitId?: number | null;
  gstRate?: number | null;
  asset?: boolean;
  discontinue?: boolean;
  description?: string | null;
}

export interface ItemFormProps {
  mode: 'create' | 'edit';
  initial?: ItemFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/items'
}

const inputSchema = z.object({
  hsnCode: z.string().optional(),
  item: z.string().min(1, 'Item name is required'),
  itemCategoryId: z.string().optional(),
  unitId: z.string().optional(),
  gstRate: z.string().optional(),
  asset: z.boolean().default(false),
  discontinue: z.boolean().default(false),
  description: z.string().optional(),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    hsnCode: data.hsnCode?.trim() || null,
    item: data.item?.trim() || null,
    itemCategoryId: data.itemCategoryId ? parseInt(data.itemCategoryId) : null,
    unitId: data.unitId ? parseInt(data.unitId) : null,
    gstRate: data.gstRate ? parseFloat(data.gstRate) : null,
    asset: data.asset || false,
    discontinue: data.discontinue || false,
    description: data.description?.trim() || null,
  };
}

export function ItemForm({ mode, initial, onSuccess, redirectOnSuccess = '/items' }: ItemFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Fetch dropdown data
  const { data: itemCategories } = useSWR('/api/item-categories?perPage=1000', apiGet);
  const { data: units } = useSWR('/api/units?perPage=1000', apiGet);

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
      hsnCode: initial?.hsnCode || '',
      item: initial?.item || '',
      itemCategoryId: initial?.itemCategoryId ? String(initial.itemCategoryId) : '',
      unitId: initial?.unitId ? String(initial.unitId) : '',
      gstRate: initial?.gstRate ? String(initial.gstRate) : '',
      asset: initial?.asset || false,
      discontinue: initial?.discontinue || false,
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
        const res = await apiPost('/api/items', payload);
        toast.success('Item created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/items', { id: initial.id, ...payload });
        toast.success('Item updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Prepare dropdown options
  const itemCategoryOptions = itemCategories?.data?.map((cat: any) => ({
    value: String(cat.id),
    label: `${cat.itemCategoryCode} - ${cat.itemCategory}`,
  })) || [];

  const unitOptions = units?.data?.map((unit: any) => ({
    value: String(unit.id),
    label: unit.unitName,
  })) || [];

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
            <AppCard.Title>{isCreate ? 'Create Item' : 'Edit Item'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new Item.' : 'Update Item details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Item Details</span>}>
                {/* Row 1: Item Code (read-only) and HSN Code */}
                <FormRow cols={2} from='md'>
                  <TextInput 
                    control={control} 
                    name='itemCode' 
                    label='Item Code' 
                    placeholder={initial?.itemCode || 'Auto-generated'}
                    disabled={true}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='hsnCode' 
                    label='HSN Code' 
                    placeholder='Enter HSN code'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 2: Item Name */}
                <FormRow>
                  <TextInput 
                    control={control} 
                    name='item' 
                    label='Item *' 
                    placeholder='Enter item name'
                  />
                </FormRow>

                {/* Row 3: Item Category, Unit, and GST Rate */}
                <FormRow cols={3} from='md'>
                  <SelectInput 
                    control={control} 
                    name='itemCategoryId' 
                    label='Item Category' 
                    placeholder='Select item category'
                    options={itemCategoryOptions}
                    span={1} 
                    spanFrom='md' 
                  />
                  <SelectInput 
                    control={control} 
                    name='unitId' 
                    label='Unit' 
                    placeholder='Select unit'
                    options={unitOptions}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='gstRate' 
                    label='GST Rate (%)' 
                    placeholder='Enter GST rate'
                    type='number'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 4: Checkboxes */}
                <FormRow cols={2} from='md'>
                  <CheckboxInput 
                    control={control} 
                    name='asset' 
                    label='Asset'
                    span={1} 
                    spanFrom='md' 
                  />
                  <CheckboxInput 
                    control={control} 
                    name='discontinue' 
                    label='Discontinue'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 5: Description */}
                <FormRow>
                  <TextareaInput 
                    control={control} 
                    name='description' 
                    label='Description' 
                    placeholder='Enter item description'
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
                {isCreate ? 'Create Item' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default ItemForm;
