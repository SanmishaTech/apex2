'use client';

import { useEffect, useState } from 'react';
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
import useSWR from 'swr';

export interface BillingAddressFormInitialData {
  id?: number;
  companyName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pincode?: string | null;
  landline1?: string | null;
  landline2?: string | null;
  fax?: string | null;
  email?: string | null;
  panNumber?: string | null;
  vatTinNumber?: string | null;
  gstNumber?: string | null;
  cstTinNumber?: string | null;
  cinNumber?: string | null;
  stateCode?: string | null;
}

export interface BillingAddressFormProps {
  mode: 'create' | 'edit';
  initial?: BillingAddressFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/billing-addresses'
}

const inputSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  landline1: z.string().regex(/^[\d\s\-\+\(\)]{10,15}$/, 'Invalid landline format').optional().or(z.literal('')),
  landline2: z.string().regex(/^[\d\s\-\+\(\)]{10,15}$/, 'Invalid landline format').optional().or(z.literal('')),
  fax: z.string().regex(/^[\d\s\-\+\(\)]{10,15}$/, 'Invalid fax format').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g., ABCDE1234F)').optional().or(z.literal('')),
  vatTinNumber: z.string().regex(/^[0-9]{11}$/, 'VAT TIN must be 11 digits').optional().or(z.literal('')),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format').optional().or(z.literal('')),
  cstTinNumber: z.string().regex(/^[0-9]{11}$/, 'CST TIN must be 11 digits').optional().or(z.literal('')),
  cinNumber: z.string().regex(/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, 'Invalid CIN format').optional().or(z.literal('')),
  stateCode: z.string().regex(/^[0-9]{2}$/, 'State code must be 2 digits').optional().or(z.literal('')),
});

type RawFormValues = z.infer<typeof inputSchema>;

// Transform string inputs to correct types for API payload
function toSubmitPayload(data: RawFormValues) {
  return {
    companyName: data.companyName?.trim() || null,
    addressLine1: data.addressLine1?.trim() || null,
    addressLine2: data.addressLine2?.trim() || null,
    stateId: data.stateId ? parseInt(data.stateId) : null,
    cityId: data.cityId ? parseInt(data.cityId) : null,
    pincode: data.pincode?.trim() || null,
    landline1: data.landline1?.trim() || null,
    landline2: data.landline2?.trim() || null,
    fax: data.fax?.trim() || null,
    email: data.email?.trim() || null,
    panNumber: data.panNumber?.trim() || null,
    vatTinNumber: data.vatTinNumber?.trim() || null,
    gstNumber: data.gstNumber?.trim() || null,
    cstTinNumber: data.cstTinNumber?.trim() || null,
    cinNumber: data.cinNumber?.trim() || null,
    stateCode: data.stateCode?.trim() || null,
  };
}

export function BillingAddressForm({ mode, initial, onSuccess, redirectOnSuccess = '/billing-addresses' }: BillingAddressFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Fetch dropdown data
  const { data: states } = useSWR('/api/states?perPage=1000', apiGet) as { data: any };
  const { data: cities } = useSWR('/api/cities?perPage=1000', apiGet) as { data: any };

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
      companyName: initial?.companyName || '',
      addressLine1: initial?.addressLine1 || '',
      addressLine2: initial?.addressLine2 || '',
      stateId: initial?.stateId ? String(initial.stateId) : '',
      cityId: initial?.cityId ? String(initial.cityId) : '',
      pincode: initial?.pincode || '',
      landline1: initial?.landline1 || '',
      landline2: initial?.landline2 || '',
      fax: initial?.fax || '',
      email: initial?.email || '',
      panNumber: initial?.panNumber || '',
      vatTinNumber: initial?.vatTinNumber || '',
      gstNumber: initial?.gstNumber || '',
      cstTinNumber: initial?.cstTinNumber || '',
      cinNumber: initial?.cinNumber || '',
      stateCode: initial?.stateCode || '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(data: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = toSubmitPayload(data);
      if (isCreate) {
        const res = await apiPost('/api/billing-addresses', payload);
        toast.success('Billing Address created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/billing-addresses', { id: initial.id, ...payload });
        toast.success('Billing Address updated');
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
  const stateOptions = states?.data?.map((state: any) => ({
    value: String(state.id),
    label: state.state,
  })) || [];

  const cityOptions = cities?.data?.map((city: any) => ({
    value: String(city.id),
    label: city.city,
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
            <AppCard.Title>{isCreate ? 'Create Billing Address' : 'Edit Billing Address'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new billing address.' : 'Update billing address details.'}
            </AppCard.Description>
          </AppCard.Header>
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend={<span className='text-base font-semibold'>Company Information</span>}>
                {/* Row 1: Company Name */}
                <FormRow>
                  <TextInput 
                    control={control} 
                    name='companyName' 
                    label='Company Name *' 
                    placeholder='Enter company name'
                  />
                </FormRow>

                {/* Row 2: Address Lines */}
                <FormRow cols={2} from='md'>
                  <TextInput 
                    control={control} 
                    name='addressLine1' 
                    label='Address Line 1 *' 
                    placeholder='Enter address line 1'
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='addressLine2' 
                    label='Address Line 2' 
                    placeholder='Enter address line 2'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 3: State, City, Pincode */}
                <FormRow cols={3} from='md'>
                  <SelectInput 
                    control={control} 
                    name='stateId' 
                    label='State' 
                    placeholder='Select state'
                    options={stateOptions}
                    span={1} 
                    spanFrom='md' 
                  />
                  <SelectInput 
                    control={control} 
                    name='cityId' 
                    label='City' 
                    placeholder='Select city'
                    options={cityOptions}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='pincode' 
                    label='Pincode' 
                    placeholder='Enter 6-digit pincode'
                    maxLength={6}
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>
              </FormSection>

              <FormSection legend={<span className='text-base font-semibold'>Contact Information</span>}>
                {/* Row 4: Contact Details */}
                <FormRow cols={3} from='md'>
                  <TextInput 
                    control={control} 
                    name='landline1' 
                    label='Landline 1' 
                    placeholder='e.g., +91-11-12345678'
                    maxLength={15}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='landline2' 
                    label='Landline 2' 
                    placeholder='e.g., +91-11-12345678'
                    maxLength={15}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='fax' 
                    label='Fax' 
                    placeholder='e.g., +91-11-12345678'
                    maxLength={15}
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 5: Email */}
                <FormRow>
                  <TextInput 
                    control={control} 
                    name='email' 
                    label='Email' 
                    placeholder='Enter email address'
                    type='email'
                  />
                </FormRow>
              </FormSection>

              <FormSection legend={<span className='text-base font-semibold'>Tax Information</span>}>
                {/* Row 6: Tax Numbers - First Row */}
                <FormRow cols={3} from='md'>
                  <TextInput 
                    control={control} 
                    name='panNumber' 
                    label='PAN Number' 
                    placeholder='e.g., ABCDE1234F'
                    maxLength={10}
                    className='uppercase'
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='vatTinNumber' 
                    label='VAT TIN Number' 
                    placeholder='Enter 11-digit VAT TIN'
                    maxLength={11}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='gstNumber' 
                    label='GST Number' 
                    placeholder='e.g., 22AAAAA0000A1Z5'
                    maxLength={15}
                    className='uppercase'
                    span={1} 
                    spanFrom='md' 
                  />
                </FormRow>

                {/* Row 7: Tax Numbers - Second Row */}
                <FormRow cols={3} from='md'>
                  <TextInput 
                    control={control} 
                    name='cstTinNumber' 
                    label='CST TIN Number' 
                    placeholder='Enter 11-digit CST TIN'
                    maxLength={11}
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='cinNumber' 
                    label='CIN Number' 
                    placeholder='e.g., L12345MH2020PLC123456'
                    maxLength={21}
                    className='uppercase'
                    span={1} 
                    spanFrom='md' 
                  />
                  <TextInput 
                    control={control} 
                    name='stateCode' 
                    label='State Code' 
                    placeholder='e.g., 27'
                    maxLength={2}
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
                {isCreate ? 'Create Billing Address' : 'Save Changes'}
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>
    </>
  );
}

export default BillingAddressForm;
