'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common';
import { TextInput } from '@/components/common/text-input';
import { AppSelect } from '@/components/common/app-select';
import { FormSection, FormRow } from '@/components/common/app-form';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export interface MinimumWageInitialData {
  id?: number;
  siteId?: number | null;
  categoryId?: number | null;
  skillSetId?: number | null;
  minWage?: string | number | null;
}

export default function MinimumWageForm({ mode, initial, redirectOnSuccess = '/minimum-wages' }: { mode: 'create' | 'edit'; initial?: MinimumWageInitialData | null; redirectOnSuccess?: string; }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    siteId: z.string().min(1, 'Site is required'),
    categoryId: z.string().min(1, 'Category is required'),
    skillSetId: z.string().min(1, 'Skill Set is required'),
    minWage: z.string().min(1, 'Minimum wage is required'),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: initial?.siteId ? String(initial.siteId) : '',
      categoryId: initial?.categoryId ? String(initial.categoryId) : '',
      skillSetId: initial?.skillSetId ? String(initial.skillSetId) : '',
      minWage: initial?.minWage ? String(initial.minWage) : '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  // Load dropdown data
  type SitesResponse = { data: { id: number; site: string; shortName?: string | null }[] };
  type CategoriesResponse = { data: { id: number; categoryName: string }[] };
  type SkillSetsResponse = { data: { id: number; skillsetName: string }[] };

  const { data: sites } = useSWR<SitesResponse>('/api/sites?perPage=1000', apiGet);
  const { data: categories } = useSWR<CategoriesResponse>('/api/categories?perPage=1000', apiGet);
  const { data: skillsets } = useSWR<SkillSetsResponse>('/api/skill-sets?perPage=1000', apiGet);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        siteId: Number(values.siteId),
        categoryId: Number(values.categoryId),
        skillSetId: Number(values.skillSetId),
        minWage: values.minWage,
      };

      let res: any;
      if (isCreate) {
        const resp = await fetch('/api/minimum-wages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error(data?.message || 'Failed to create minimum wage');
        res = data;
        toast.success('Minimum wage created');
      } else if (initial?.id) {
        const resp = await fetch('/api/minimum-wages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: initial.id, ...payload }) });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error(data?.message || 'Failed to update minimum wage');
        res = data;
        toast.success('Minimum wage updated');
      }

      router.push(redirectOnSuccess);
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Minimum Wage' : 'Edit Minimum Wage'}</AppCard.Title>
          <AppCard.Description>
            Define a minimum wage for a Site + Category + Skill Set combination.
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Details'>
              <FormRow className='grid-cols-12'>
                <AppSelect control={control} name='siteId' label='Site' placeholder='Select site' className='col-span-4' required>
                  {sites?.data?.map(s => (
                    <AppSelect.Item key={s.id} value={String(s.id)}>{s.shortName ? `${s.shortName} (${s.site})` : s.site}</AppSelect.Item>
                  ))}
                </AppSelect>
                <AppSelect control={control} name='categoryId' label='Category' placeholder='Select category' className='col-span-4' required>
                  {categories?.data?.map(c => (
                    <AppSelect.Item key={c.id} value={String(c.id)}>{c.categoryName}</AppSelect.Item>
                  ))}
                </AppSelect>
                <AppSelect control={control} name='skillSetId' label='Skill Set' placeholder='Select skill set' className='col-span-4' required>
                  {skillsets?.data?.map(sk => (
                    <AppSelect.Item key={sk.id} value={String(sk.id)}>{sk.skillsetName}</AppSelect.Item>
                  ))}
                </AppSelect>
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextInput control={control} name='minWage' label='Minimum Wage' placeholder='0.00' itemClassName='col-span-4' required />
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className='justify-end'>
            <AppButton type='button' variant='secondary' onClick={() => router.push(redirectOnSuccess)} disabled={submitting} iconName='X'>
              Cancel
            </AppButton>
            <AppButton type='submit' iconName={isCreate ? 'Plus' : 'Save'} isLoading={submitting} disabled={submitting || !form.formState.isValid}>
              {isCreate ? 'Create' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
