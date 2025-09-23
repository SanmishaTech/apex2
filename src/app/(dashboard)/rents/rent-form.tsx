'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppSelect } from '@/components/common/app-select';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Input } from '@/components/ui/input';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { formatDateForInput } from '@/lib/locales';
import useSWR from 'swr';
import { RENT_DAY_OPTIONS } from '@/types/rents';

interface SitesResponse {
  data: Array<{ id: number; site: string }>;
}

interface RentalCategoriesResponse {
  data: Array<{ id: number; rentalCategory: string }>;
}

interface RentTypesResponse {
  data: Array<{ id: number; rentType: string }>;
}

interface BoqsResponse {
  data: Array<{ id: number; boqNo: string; siteId?: number | null; workName?: string | null }>;
}

export interface RentFormProps {
  mode: 'create' | 'edit';
  initial?: any;
  onSuccess?: (result?: unknown) => void;
}

export function RentForm({ mode, initial, onSuccess }: RentFormProps) {
  const { backWithScrollRestore } = useScrollRestoration('rents-list');
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    siteId: z.number().optional().nullable(),
    boqId: z.number().optional().nullable(),
    rentalCategoryId: z.number().optional().nullable(),
    rentTypeId: z.number().optional().nullable(),
    owner: z.string().optional(),
    pancardNo: z.string().optional(),
    rentDay: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    description: z.string().optional(),
    depositAmount: z.preprocess((val) => (val === '' || val == null ? null : Number(val)), z.number().min(0).nullable().optional()),
    rentAmount: z.preprocess((val) => (val === '' || val == null ? null : Number(val)), z.number().min(0).nullable().optional()),
    bank: z.string().optional(),
    branch: z.string().optional(),
    accountNo: z.string().optional(),
    accountName: z.string().optional(),
    ifscCode: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: initial?.siteId ?? null,
      boqId: initial?.boqId ?? null,
      rentalCategoryId: initial?.rentalCategoryId ?? null,
      rentTypeId: initial?.rentTypeId ?? null,
      owner: initial?.owner ?? '',
      pancardNo: initial?.pancardNo ?? '',
      rentDay: initial?.rentDay ?? '',
      fromDate: initial?.fromDate ? formatDateForInput(new Date(initial.fromDate)) : '',
      toDate: initial?.toDate ? formatDateForInput(new Date(initial.toDate)) : '',
      description: initial?.description ?? '',
      depositAmount: initial?.depositAmount ?? '',
      rentAmount: initial?.rentAmount ?? '',
      bank: initial?.bank ?? '',
      branch: initial?.branch ?? '',
      accountNo: initial?.accountNo ?? '',
      accountName: initial?.accountName ?? '',
      ifscCode: initial?.ifscCode ?? '',
    },
  });

  const { control, handleSubmit, watch, setValue } = form;
  const selectedSiteId = watch('siteId');

  // Fetch dropdown data
  const { data: sitesData } = useSWR<SitesResponse>('/api/sites?perPage=100', apiGet);
  const { data: categoriesData } = useSWR<RentalCategoriesResponse>('/api/rental-categories?perPage=100', apiGet);
  const { data: typesData } = useSWR<RentTypesResponse>('/api/rent-types?perPage=100', apiGet);
  const { data: boqsData } = useSWR<BoqsResponse>('/api/boqs?perPage=100', apiGet);

  async function onSubmit(data: any) {
    setSubmitting(true);
    try {
      // Clean up the data before sending to API
      const cleanData = {
        ...data,
        // Remove null/undefined numeric fields to let API handle them properly
        siteId: data.siteId || undefined,
        boqId: data.boqId || undefined,
        rentalCategoryId: data.rentalCategoryId || undefined,
        rentTypeId: data.rentTypeId || undefined,
        // Clean up empty strings
        owner: data.owner?.trim() || undefined,
        pancardNo: data.pancardNo?.trim() || undefined,
        rentDay: data.rentDay || undefined,
        fromDate: data.fromDate?.trim() || undefined,
        toDate: data.toDate?.trim() || undefined,
        description: data.description?.trim() || undefined,
        bank: data.bank?.trim() || undefined,
        branch: data.branch?.trim() || undefined,
        accountNo: data.accountNo?.trim() || undefined,
        accountName: data.accountName?.trim() || undefined,
        ifscCode: data.ifscCode?.trim() || undefined,
      };

      const result = mode === 'create' 
        ? await apiPost('/api/rents', cleanData)
        : await apiPatch(`/api/rents/${initial?.id}`, cleanData);
      
      toast.success(`Rent ${mode === 'create' ? 'created' : 'updated'} successfully`);
      if (onSuccess) onSuccess(result);
      else backWithScrollRestore();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>{mode === 'create' ? 'Add New Rent' : 'Edit Rent'}</AppCard.Title>
      </AppCard.Header>
      <AppCard.Content>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection legend={<span>Basic Details</span>}>
              <FormRow cols={2} from="md">
                <TextInput control={control} name="owner" label="Owner" />
                <TextInput control={control} name="pancardNo" label="PAN Card No" />
              </FormRow>
              <FormRow cols={2} from="md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Site</label>
                  <AppSelect
                    value={watch('siteId') ? String(watch('siteId')) : ''}
                    onValueChange={(v) => setValue('siteId', v ? parseInt(v) : null)}
                  >
                    {sitesData?.data?.map((s: any) => (
                      <AppSelect.Item key={s.id} value={String(s.id)}>{s.site}</AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bill Of Quantity</label>
                  <AppSelect
                    value={watch('boqId') ? String(watch('boqId')) : ''}
                    onValueChange={(v) => setValue('boqId', v ? parseInt(v) : null)}
                    disabled={!selectedSiteId}
                  >
                    {boqsData?.data?.filter((b: any) => !selectedSiteId || b.siteId === selectedSiteId).map((b: any) => (
                      <AppSelect.Item key={b.id} value={String(b.id)}>
                        {b.boqNo}{b.workName ? ` - ${b.workName}` : ''}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
              <FormRow cols={2} from="md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rent Category</label>
                  <AppSelect
                    value={watch('rentalCategoryId') ? String(watch('rentalCategoryId')) : ''}
                    onValueChange={(v) => setValue('rentalCategoryId', v ? parseInt(v) : null)}
                  >
                    {categoriesData?.data?.map((c: any) => (
                      <AppSelect.Item key={c.id} value={String(c.id)}>{c.rentalCategory}</AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rent Type</label>
                  <AppSelect
                    value={watch('rentTypeId') ? String(watch('rentTypeId')) : ''}
                    onValueChange={(v) => setValue('rentTypeId', v ? parseInt(v) : null)}
                  >
                    {typesData?.data?.map((t: any) => (
                      <AppSelect.Item key={t.id} value={String(t.id)}>{t.rentType}</AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
              <FormRow cols={2} from="md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rent Day</label>
                  <AppSelect value={watch('rentDay')} onValueChange={(v) => setValue('rentDay', v)}>
                    {RENT_DAY_OPTIONS.map((opt) => (
                      <AppSelect.Item key={opt.value} value={opt.value}>{opt.label}</AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <TextInput control={control} name="description" label="Description" />
              </FormRow>
              <FormRow cols={2} from="md">
                <FormField
                  control={control}
                  name="fromDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="toDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
              <FormRow cols={2} from="md">
                <TextInput control={control} name="depositAmount" label="Deposit Amount" type="number" />
                <TextInput control={control} name="rentAmount" label="Rent Amount" type="number" />
              </FormRow>
            </FormSection>

            <FormSection legend={<span>Bank Details</span>}>
              <FormRow cols={2} from="md">
                <TextInput control={control} name="bank" label="Bank" />
                <TextInput control={control} name="branch" label="Branch" />
              </FormRow>
              <FormRow cols={2} from="md">
                <TextInput control={control} name="accountNo" label="Account No" />
                <TextInput control={control} name="accountName" label="Account Name" />
              </FormRow>
              <FormRow cols={2} from="md">
                <TextInput control={control} name="ifscCode" label="IFSC Code" />
                <div></div>
              </FormRow>
            </FormSection>

            <div className="flex gap-2 justify-end">
              <AppButton 
                type="button" 
                variant="outline" 
                onClick={backWithScrollRestore}
              >
                Cancel
              </AppButton>
              <AppButton type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : (mode === 'create' ? 'Create' : 'Update')}
              </AppButton>
            </div>
          </form>
        </Form>
      </AppCard.Content>
    </AppCard>
  );
}
