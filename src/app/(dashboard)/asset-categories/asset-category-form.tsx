'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { SelectInput } from '@/components/common/select-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { CreateAssetCategoryData, UpdateAssetCategoryData, AssetGroupOption } from '@/types/asset-categories';
import useSWR from 'swr';

export interface AssetCategoryFormInitialData {
  id?: number;
  assetGroupId?: number;
  category?: string;
}

export interface AssetCategoryFormProps {
  mode: 'create' | 'edit';
  initial?: AssetCategoryFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function AssetCategoryForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/asset-categories',
}: AssetCategoryFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration('asset-categories-list');

  // Fetch asset groups for dropdown
  const { data: assetGroupsData, error: assetGroupsError } = useSWR<{data: AssetGroupOption[]}>(
    '/api/asset-groups?perPage=100&sort=assetGroup&order=asc',
    apiGet
  );

  const schema = z.object({
    assetGroupId: z.string().min(1, 'Asset group is required'),
    category: z.string().min(1, 'Category is required'),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      assetGroupId: initial?.assetGroupId ? initial.assetGroupId.toString() : '',
      category: initial?.category ?? '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  // Convert asset groups data to options
  const assetGroupOptions = (assetGroupsData?.data || []).map(group => ({
    value: group.id.toString(),
    label: group.assetGroup,
  }));

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateAssetCategoryData = {
          assetGroupId: parseInt(formData.assetGroupId, 10),
          category: formData.category,
        };
        const res = await apiPost('/api/asset-categories', payload);
        toast.success('Asset category created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateAssetCategoryData = {
          assetGroupId: parseInt(formData.assetGroupId, 10),
          category: formData.category,
        };
        const res = await apiPatch(`/api/asset-categories/${initial.id}`, payload);
        toast.success('Asset category updated successfully');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save asset category');
    } finally {
      setSubmitting(false);
    }
  }

  if (assetGroupsError) {
    return (
      <AppCard>
        <AppCard.Content className='p-6'>
          <div className='text-center text-muted-foreground'>
            Failed to load asset groups. Please try again.
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Asset Category' : 'Edit Asset Category'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new asset category to an asset group.' : 'Update asset category information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Asset Category Information'>
              <FormRow cols={2}>
                <SelectInput 
                  control={control} 
                  name='assetGroupId' 
                  label='Asset Group' 
                  placeholder='Select asset group'
                  options={assetGroupOptions}
                  disabled={!assetGroupsData}
                />
                <TextInput 
                  control={control} 
                  name='category' 
                  label='Category' 
                  placeholder='Enter category name'
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
              disabled={submitting || !form.formState.isValid || !assetGroupsData}
            >
              {isCreate ? 'Create Asset Category' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default AssetCategoryForm;
