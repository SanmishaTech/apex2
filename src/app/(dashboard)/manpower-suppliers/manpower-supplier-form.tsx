'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface ManpowerSupplierInitialData {
  id?: number;
  vendorCode?: string | null;
  supplierName?: string;
  contactPerson?: string | null;
  representativeName?: string | null;
  localContactNo?: string | null;
  permanentContactNo?: string | null;
  address?: string | null;
  state?: string | null;
  permanentAddress?: string | null;
  city?: string | null;
  pincode?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  ifscNo?: string | null;
  rtgsNo?: string | null;
  panNo?: string | null;
  adharNo?: string | null;
  pfNo?: string | null;
  esicNo?: string | null;
  gstNo?: string | null;
  numberOfWorkers?: number | null;
  typeOfWork?: string | null;
  workDone?: string | null;
}

export interface ManpowerSupplierFormProps {
  mode: 'create' | 'edit';
  initial?: ManpowerSupplierInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/manpower-suppliers'
}

const schema = z.object({
  vendorCode: z.string().optional(),
  supplierName: z.string().min(1, 'Manpower Supplier is required'),
  contactPerson: z.string().optional(),
  representativeName: z.string().optional(),
  localContactNo: z.string().optional(),
  permanentContactNo: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  permanentAddress: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  bankName: z.string().optional(),
  accountNo: z.string().optional(),
  ifscNo: z.string().optional(),
  rtgsNo: z.string().optional(),
  panNo: z.string().optional(),
  adharNo: z.string().optional(),
  pfNo: z.string().optional(),
  esicNo: z.string().optional(),
  gstNo: z.string().optional(),
  numberOfWorkers: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), {
      message: 'No Of Worker must be a non-negative number',
    }),
  typeOfWork: z.string().optional(),
  workDone: z.string().optional(),
});

export function ManpowerSupplierForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/manpower-suppliers',
}: ManpowerSupplierFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      vendorCode: initial?.vendorCode ?? '',
      supplierName: initial?.supplierName ?? '',
      contactPerson: initial?.contactPerson ?? '',
      representativeName: initial?.representativeName ?? '',
      localContactNo: initial?.localContactNo ?? '',
      permanentContactNo: initial?.permanentContactNo ?? '',
      address: initial?.address ?? '',
      state: initial?.state ?? '',
      permanentAddress: initial?.permanentAddress ?? '',
      city: initial?.city ?? '',
      pincode: initial?.pincode ?? '',
      bankName: initial?.bankName ?? '',
      accountNo: initial?.accountNo ?? '',
      ifscNo: initial?.ifscNo ?? '',
      rtgsNo: initial?.rtgsNo ?? '',
      panNo: initial?.panNo ?? '',
      adharNo: initial?.adharNo ?? '',
      pfNo: initial?.pfNo ?? '',
      esicNo: initial?.esicNo ?? '',
      gstNo: initial?.gstNo ?? '',
      numberOfWorkers: initial?.numberOfWorkers ?? undefined,
      typeOfWork: initial?.typeOfWork ?? '',
      workDone: initial?.workDone ?? '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload: any = {
        vendorCode: values.vendorCode?.trim() || undefined,
        supplierName: values.supplierName.trim(),
        contactPerson: values.contactPerson?.trim() || undefined,
        representativeName: values.representativeName?.trim() || undefined,
        localContactNo: values.localContactNo?.trim() || undefined,
        permanentContactNo: values.permanentContactNo?.trim() || undefined,
        address: values.address?.trim() || undefined,
        state: values.state?.trim() || undefined,
        permanentAddress: values.permanentAddress?.trim() || undefined,
        city: values.city?.trim() || undefined,
        pincode: values.pincode?.trim() || undefined,
        bankName: values.bankName?.trim() || undefined,
        accountNo: values.accountNo?.trim() || undefined,
        ifscNo: values.ifscNo?.trim() || undefined,
        rtgsNo: values.rtgsNo?.trim() || undefined,
        panNo: values.panNo?.trim() || undefined,
        adharNo: values.adharNo?.trim() || undefined,
        pfNo: values.pfNo?.trim() || undefined,
        esicNo: values.esicNo?.trim() || undefined,
        gstNo: values.gstNo?.trim() || undefined,
        numberOfWorkers: values.numberOfWorkers,
        typeOfWork: values.typeOfWork?.trim() || undefined,
        workDone: values.workDone?.trim() || undefined,
      };

      if (mode === 'create') {
        const res = await apiPost('/api/manpower-suppliers', payload);
        toast.success('Manpower supplier created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/manpower-suppliers', { id: initial.id, ...payload });
        toast.success('Manpower supplier updated');
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
          <AppCard.Title>{isCreate ? 'Create Manpower Supplier' : 'Edit Manpower Supplier'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new manpower supplier.' : 'Update manpower supplier details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Basic Details'>
              <FormRow className='grid-cols-12'>
                <TextInput control={control} name='vendorCode' label='Vendor Code' placeholder='Vendor code' itemClassName='col-span-6' />
                <TextInput control={control} name='supplierName' label='Manpower Supplier' placeholder='Supplier name' required itemClassName='col-span-6' />
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextInput control={control} name='contactPerson' label='Contact Person' placeholder='Contact person' itemClassName='col-span-6' />
                <TextInput control={control} name='representativeName' label='Representative Name' placeholder='Representative name' itemClassName='col-span-6' />
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextInput control={control} name='city' label='City' placeholder='City' itemClassName='col-span-6' />
                <TextInput control={control} name='state' label='State' placeholder='State' itemClassName='col-span-6' />
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextInput control={control} name='localContactNo' label='Local Contact No' placeholder='Local contact number' itemClassName='col-span-6' />
                <TextInput control={control} name='permanentContactNo' label='Permanent Contact No' placeholder='Permanent contact number' itemClassName='col-span-6' />
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextareaInput control={control} name='address' label='Address' placeholder='Address' itemClassName='col-span-6' />
                <TextareaInput control={control} name='permanentAddress' label='Permanent Address' placeholder='Permanent address' itemClassName='col-span-6' />
              </FormRow>
            </FormSection>

            <FormSection legend='Bank & Tax Details'>
              <FormRow mdCols={12}>
                <TextInput control={control} name='bankName' label='Bank Name' placeholder='Bank name' span={4} spanFrom='md' />
                <TextInput control={control} name='accountNo' label='Account No' placeholder='Account number' span={4} spanFrom='md' />
                <TextInput control={control} name='ifscNo' label='IFSC No' placeholder='IFSC code' span={4} spanFrom='md' />
              </FormRow>
              <FormRow mdCols={12}>
                <TextInput control={control} name='rtgsNo' label='RTGS No' placeholder='RTGS number' span={6} spanFrom='md' />
                <TextInput control={control} name='pincode' label='Pincode' placeholder='Pincode' span={6} spanFrom='md' />
              </FormRow>
              <FormRow mdCols={12}>
                <TextInput control={control} name='gstNo' label='GST No' placeholder='GST number' span={6} spanFrom='md' />
                <TextInput control={control} name='panNo' label='PAN No' placeholder='PAN number' span={6} spanFrom='md' />
              </FormRow>
              <FormRow mdCols={12}>
                <TextInput control={control} name='adharNo' label='ADHAR No' placeholder='Aadhar number' span={6} spanFrom='md' />
                <TextInput control={control} name='numberOfWorkers' label='No Of Worker' placeholder='e.g. 25' span={6} spanFrom='md' />
              </FormRow>
              <FormRow mdCols={12}>
                <TextInput control={control} name='pfNo' label='PF No' placeholder='PF number' span={6} spanFrom='md' />
                <TextInput control={control} name='esicNo' label='ESIC No' placeholder='ESIC number' span={6} spanFrom='md' />
              </FormRow>
            </FormSection>

            <FormSection legend='Work Details'>
              <FormRow className='grid-cols-2'>
                <TextareaInput
                  control={control}
                  name='typeOfWork'
                  label='Type Of Work'
                  placeholder='Describe type of work'
                  itemClassName='col-span-1'
                />
                <TextareaInput
                  control={control}
                  name='workDone'
                  label='Work Done'
                  placeholder='Describe previous work done'
                  itemClassName='col-span-1'
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
              {isCreate ? 'Create Supplier' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default ManpowerSupplierForm;
