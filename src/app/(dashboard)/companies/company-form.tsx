'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { AppSelect } from '@/components/common/app-select';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { CreateCompanyData, UpdateCompanyData } from '@/types/companies';
import { State } from '@/types/states';
import { City } from '@/types/cities';
import useSWR, { mutate } from 'swr';
import Image from 'next/image';
import { validatePAN, validateTAN, validateCIN, validateGST } from '@/lib/tax-validation';

export interface CompanyFormInitialData {
  id?: number;
  companyName?: string;
  shortName?: string;
  contactPerson?: string;
  contactNo?: string;
  addressLine1?: string;
  addressLine2?: string;
  stateId?: number;
  cityId?: number;
  pinCode?: string;
  logoUrl?: string;
  closed?: boolean;
  panNo?: string;
  gstNo?: string;
  tanNo?: string;
  cinNo?: string;
}

export interface CompanyFormProps {
  mode: 'create' | 'edit';
  initial?: CompanyFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function CompanyForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/companies',
}: CompanyFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.logoUrl || null);

  const schema = z.object({
    companyName: z.string().min(1, 'Company name is required'),
    shortName: z.string().optional(),
    contactPerson: z.string().optional(),
    contactNo: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    stateId: z.number().optional().nullable(),
    cityId: z.number().optional().nullable(),
    pinCode: z.string().optional(),
    closed: z.boolean(),
    panNo: z.string()
      .optional()
      .refine((val) => !val || validatePAN(val), {
        message: "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)"
      }),
    gstNo: z.string()
      .optional()
      .refine((val) => !val || validateGST(val), {
        message: "Invalid GST format. Format: 27ABCDE1234F1Z5"
      }),
    tanNo: z.string()
      .optional()
      .refine((val) => !val || validateTAN(val), {
        message: "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)"
      }),
    cinNo: z.string()
      .optional()
      .refine((val) => !val || validateCIN(val), {
        message: "Invalid CIN format. Format: U99999AA9999AAA999999"
      }),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      companyName: initial?.companyName ?? '',
      shortName: initial?.shortName ?? '',
      contactPerson: initial?.contactPerson ?? '',
      contactNo: initial?.contactNo ?? '',
      addressLine1: initial?.addressLine1 ?? '',
      addressLine2: initial?.addressLine2 ?? '',
      stateId: initial?.stateId ?? null,
      cityId: initial?.cityId ?? null,
      pinCode: initial?.pinCode ?? '',
      closed: initial?.closed ?? false,
      panNo: initial?.panNo ?? '',
      gstNo: initial?.gstNo ?? '',
      tanNo: initial?.tanNo ?? '',
      cinNo: initial?.cinNo ?? '',
    },
  });

  const { control, handleSubmit, watch, setValue } = form;
  const closedValue = watch('closed');
  const selectedStateId = watch('stateId');
  const isCreate = mode === 'create';

  // Fetch states for dropdown
  const { data: statesData } = useSWR<{ data: State[] }>('/api/states?perPage=100', apiGet);
  const states = statesData?.data || [];

  // Fetch cities for dropdown based on selected state
  const { data: citiesData } = useSWR<{ data: City[] }>(
    selectedStateId ? `/api/cities?perPage=100&stateId=${selectedStateId}` : null,
    apiGet
  );
  const cities = citiesData?.data || [];

  // Reset city when state changes
  useEffect(() => {
    if (selectedStateId !== initial?.stateId) {
      setValue('cityId', null);
    }
  }, [selectedStateId, setValue, initial?.stateId]);

  // Handle logo file selection
  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB');
        return;
      }
      
      setLogoFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  // Remove logo
  function removeLogo() {
    setLogoFile(null);
    setPreviewUrl(null);
  }

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let result: unknown;

      if (logoFile) {
        // Use FormData for file upload with fetch API
        const formDataPayload = new FormData();
        formDataPayload.append('companyName', formData.companyName);
        if (formData.shortName) formDataPayload.append('shortName', formData.shortName);
        if (formData.contactPerson) formDataPayload.append('contactPerson', formData.contactPerson);
        if (formData.contactNo) formDataPayload.append('contactNo', formData.contactNo);
        if (formData.addressLine1) formDataPayload.append('addressLine1', formData.addressLine1);
        if (formData.addressLine2) formDataPayload.append('addressLine2', formData.addressLine2);
        if (formData.stateId) formDataPayload.append('stateId', formData.stateId.toString());
        if (formData.cityId) formDataPayload.append('cityId', formData.cityId.toString());
        if (formData.pinCode) formDataPayload.append('pinCode', formData.pinCode);
        formDataPayload.append('closed', formData.closed.toString());
        if (formData.panNo) formDataPayload.append('panNo', formData.panNo);
        if (formData.gstNo) formDataPayload.append('gstNo', formData.gstNo);
        if (formData.tanNo) formDataPayload.append('tanNo', formData.tanNo);
        if (formData.cinNo) formDataPayload.append('cinNo', formData.cinNo);
        formDataPayload.append('logo', logoFile);

        const endpoint = mode === 'create' 
          ? '/api/companies' 
          : `/api/companies/${initial?.id}`;
        
        const response = await fetch(endpoint, {
          method: mode === 'create' ? 'POST' : 'PATCH',
          body: formDataPayload
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to save company`);
        }

        result = await response.json();
      } else {
        // Use JSON payload with custom API client
        const payload = {
          companyName: formData.companyName,
          shortName: formData.shortName || null,
          contactPerson: formData.contactPerson || null,
          contactNo: formData.contactNo || null,
          addressLine1: formData.addressLine1 || null,
          addressLine2: formData.addressLine2 || null,
          stateId: formData.stateId || null,
          cityId: formData.cityId || null,
          pinCode: formData.pinCode || null,
          closed: formData.closed,
          panNo: formData.panNo || null,
          gstNo: formData.gstNo || null,
          tanNo: formData.tanNo || null,
          cinNo: formData.cinNo || null,
        };
        
        result = mode === 'create' 
          ? await apiPost('/api/companies', payload)
          : await apiPatch(`/api/companies/${initial?.id}`, payload);
      }

      // Invalidate SWR cache to ensure fresh data
      if (mode === 'edit' && initial?.id) {
        // Invalidate the specific company cache
        mutate(`/api/companies/${initial.id}`);
      }
      // Invalidate the companies list cache
      mutate('/api/companies');

      toast.success(mode === 'create' ? 'Company created successfully' : 'Company updated successfully');
      onSuccess?.(result);
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save company');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Company' : 'Edit Company'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new company to the system.' : 'Update company information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            {/* Company Information */}
            <FormSection legend='Company Information'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='companyName' 
                  label='Company Name' 
                  placeholder='Enter company name'
                  required
                />
                <TextInput 
                  control={control} 
                  name='shortName' 
                  label='Short Name' 
                  placeholder='Enter short name'
                />
              </FormRow>
            </FormSection>

            {/* Contact Person Details */}
            <FormSection legend='Contact Person Details'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='contactPerson' 
                  label='Contact Person' 
                  placeholder='Enter contact person name'
                />
                <TextInput 
                  control={control} 
                  name='contactNo' 
                  label='Contact No' 
                  placeholder='Enter contact number'
                />
              </FormRow>
            </FormSection>

            {/* Address Details */}
            <FormSection legend='Address Details'>
              <FormRow cols={1}>
                <TextInput 
                  control={control} 
                  name='addressLine1' 
                  label='Address Line 1' 
                  placeholder='Enter address line 1'
                />
              </FormRow>
              <FormRow cols={1}>
                <TextInput 
                  control={control} 
                  name='addressLine2' 
                  label='Address Line 2' 
                  placeholder='Enter address line 2'
                />
              </FormRow>
              <FormRow cols={3}>
                <div>
                  <label className="block text-sm font-medium mb-2">State</label>
                  <AppSelect
                    value={selectedStateId ? selectedStateId.toString() : '__none'}
                    onValueChange={(v) => setValue('stateId', v === '__none' ? null : Number(v))}
                    placeholder="Select state"
                  >
                    <AppSelect.Item value="__none">Select State</AppSelect.Item>
                    {states.map((state) => (
                      <AppSelect.Item key={state.id} value={state.id.toString()}>
                        {state.state}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">City</label>
                  <AppSelect
                    value={watch('cityId') ? watch('cityId')!.toString() : '__none'}
                    onValueChange={(v) => setValue('cityId', v === '__none' ? null : Number(v))}
                    placeholder="Select city"
                    disabled={!selectedStateId}
                  >
                    <AppSelect.Item value="__none">Select City</AppSelect.Item>
                    {cities.map((city) => (
                      <AppSelect.Item key={city.id} value={city.id.toString()}>
                        {city.city}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
                <TextInput 
                  control={control} 
                  name='pinCode' 
                  label='Pin Code' 
                  placeholder='Enter pin code'
                />
              </FormRow>
            </FormSection>

            {/* Logo Upload */}
            <FormSection legend='Logo'>
              <div className="space-y-4">
                {previewUrl && (
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 border rounded-lg overflow-hidden">
                      <Image
                        src={previewUrl}
                        alt="Logo preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <AppButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeLogo}
                      iconName="X"
                    >
                      Remove Logo
                    </AppButton>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: JPG, PNG, GIF. Max size: 20MB
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Other Details */}
            <FormSection legend='Other Details'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='panNo' 
                  label='PAN No' 
                  placeholder='Enter PAN number'
                />
                <TextInput 
                  control={control} 
                  name='gstNo' 
                  label='GST No' 
                  placeholder='Enter GST number'
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='tanNo' 
                  label='TAN No' 
                  placeholder='Enter TAN number'
                />
                <TextInput 
                  control={control} 
                  name='cinNo' 
                  label='CIN No' 
                  placeholder='Enter CIN number'
                />
              </FormRow>
              <FormRow cols={1}>
                <AppCheckbox
                  label='Company Closed'
                  description='Mark this company as closed/inactive'
                  checked={closedValue}
                  onCheckedChange={(v) => setValue('closed', v)}
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
              {isCreate ? 'Create Company' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default CompanyForm;
