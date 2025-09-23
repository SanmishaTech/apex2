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
import { CreateAssetGroupData, UpdateAssetGroupData } from '@/types/asset-groups';

export interface AssetGroupFormInitialData {
  id?: number;
  assetGroup?: string;
}

export interface AssetGroupFormProps {
  mode: 'create' | 'edit';
  initial?: AssetGroupFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function AssetGroupForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/asset-groups',
}: AssetGroupFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { backWithScrollRestore } = useScrollRestoration('asset-groups-list');

  const schema = z.object({
    assetGroup: z.string().min(1, 'Asset group is required'),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      assetGroup: initial?.assetGroup ?? '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateAssetGroupData = {
          assetGroup: formData.assetGroup,
        };
        const res = await apiPost('/api/asset-groups', payload);
        toast.success('Asset group created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateAssetGroupData = {
          assetGroup: formData.assetGroup,
        };
        const res = await apiPatch(`/api/asset-groups/${initial.id}`, payload);
        toast.success('Asset group updated successfully');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save asset group');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Asset Group' : 'Edit Asset Group'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new asset group to the master data.' : 'Update asset group information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Asset Group Information'>
              <FormRow cols={1}>
                <TextInput 
                  control={control} 
                  name='assetGroup' 
                  label='Asset Group' 
                  placeholder='Enter asset group name'
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
              {isCreate ? 'Create Asset Group' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default AssetGroupForm;
