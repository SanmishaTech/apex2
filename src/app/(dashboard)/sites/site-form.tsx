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
import { CreateSiteData, UpdateSiteData } from '@/types/sites';
import { State } from '@/types/states';
import { City } from '@/types/cities';
import { Company } from '@/types/companies';
import useSWR, { mutate } from 'swr';
import Image from 'next/image';
import { validatePAN, validateTAN, validateCIN, validateGST } from '@/lib/tax-validation';

export interface SiteFormInitialData {
  id?: number;
  uinNo?: string;
  site?: string;
  shortName?: string;
  companyId?: number;
  closed?: boolean;
  permanentClosed?: boolean;
  monitor?: boolean;
  attachCopyUrl?: string;
  contactPerson?: string;
  contactNo?: string;
  addressLine1?: string;
  addressLine2?: string;
  stateId?: number;
  cityId?: number;
  pinCode?: string;
  longitude?: string;
  latitude?: string;
  panNo?: string;
  gstNo?: string;
  tanNo?: string;
  cinNo?: string;
}

export interface SiteFormProps {
  mode: 'create' | 'edit';
  initial?: SiteFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

export function SiteForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/sites',
}: SiteFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [attachCopyFile, setAttachCopyFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.attachCopyUrl || null);

  const schema = z.object({
    uinNo: z.string().optional(),
    site: z.string().min(1, 'Site name is required'),
    shortName: z.string().optional(),
    companyId: z.number().optional().nullable(),
    closed: z.boolean(),
    permanentClosed: z.boolean(),
    monitor: z.boolean(),
    contactPerson: z.string().optional(),
    contactNo: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    stateId: z.number().optional().nullable(),
    cityId: z.number().optional().nullable(),
    pinCode: z.string().optional(),
    longitude: z.string().optional(),
    latitude: z.string().optional(),
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
      uinNo: initial?.uinNo ?? '',
      site: initial?.site ?? '',
      shortName: initial?.shortName ?? '',
      companyId: initial?.companyId ?? null,
      closed: initial?.closed ?? false,
      permanentClosed: initial?.permanentClosed ?? false,
      monitor: initial?.monitor ?? false,
      contactPerson: initial?.contactPerson ?? '',
      contactNo: initial?.contactNo ?? '',
      addressLine1: initial?.addressLine1 ?? '',
      addressLine2: initial?.addressLine2 ?? '',
      stateId: initial?.stateId ?? null,
      cityId: initial?.cityId ?? null,
      pinCode: initial?.pinCode ?? '',
      longitude: initial?.longitude ?? '',
      latitude: initial?.latitude ?? '',
      panNo: initial?.panNo ?? '',
      gstNo: initial?.gstNo ?? '',
      tanNo: initial?.tanNo ?? '',
      cinNo: initial?.cinNo ?? '',
    },
  });

  const { control, handleSubmit, watch, setValue } = form;
  const closedValue = watch('closed');
  const permanentClosedValue = watch('permanentClosed');
  const monitorValue = watch('monitor');
  const selectedStateId = watch('stateId');
  const selectedCompanyId = watch('companyId');
  const isCreate = mode === 'create';

  // Fetch companies for dropdown
  const { data: companiesData } = useSWR<{ data: Company[] }>('/api/companies?perPage=100&closed=false', apiGet);
  const companies = companiesData?.data || [];

  // Fetch states for dropdown
  const { data: statesData } = useSWR<{ data: State[] }>('/api/states?perPage=100&status=true', apiGet);
  const states = statesData?.data || [];

  // Fetch cities for dropdown based on selected state
  const { data: citiesData } = useSWR<{ data: City[] }>(
    selectedStateId ? `/api/cities?perPage=100&status=true&stateId=${selectedStateId}` : null,
    apiGet
  );
  const cities = citiesData?.data || [];

  // Reset city when state changes
  useEffect(() => {
    if (selectedStateId !== initial?.stateId) {
      setValue('cityId', null);
    }
  }, [selectedStateId, setValue, initial?.stateId]);

  // Handle attach copy file selection
  function handleAttachCopyChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 
        'image/jpg', 
        'image/png'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid file (PDF, DOC, DOCX, JPG, PNG)');
        return;
      }
      
      // Validate file size
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB');
        return;
      }
      
      setAttachCopyFile(file);
      // Create preview URL for files
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  // Remove attach copy
  function removeAttachCopy() {
    setAttachCopyFile(null);
    setPreviewUrl(null);
  }

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let result: unknown;

      if (attachCopyFile) {
        // Use FormData for file upload with fetch API
        const formDataPayload = new FormData();
        if (formData.uinNo) formDataPayload.append('uinNo', formData.uinNo);
        formDataPayload.append('site', formData.site);
        if (formData.shortName) formDataPayload.append('shortName', formData.shortName);
        if (formData.companyId) formDataPayload.append('companyId', formData.companyId.toString());
        formDataPayload.append('closed', formData.closed.toString());
        formDataPayload.append('permanentClosed', formData.permanentClosed.toString());
        formDataPayload.append('monitor', formData.monitor.toString());
        if (formData.contactPerson) formDataPayload.append('contactPerson', formData.contactPerson);
        if (formData.contactNo) formDataPayload.append('contactNo', formData.contactNo);
        if (formData.addressLine1) formDataPayload.append('addressLine1', formData.addressLine1);
        if (formData.addressLine2) formDataPayload.append('addressLine2', formData.addressLine2);
        if (formData.stateId) formDataPayload.append('stateId', formData.stateId.toString());
        if (formData.cityId) formDataPayload.append('cityId', formData.cityId.toString());
        if (formData.pinCode) formDataPayload.append('pinCode', formData.pinCode);
        if (formData.longitude) formDataPayload.append('longitude', formData.longitude);
        if (formData.latitude) formDataPayload.append('latitude', formData.latitude);
        if (formData.panNo) formDataPayload.append('panNo', formData.panNo);
        if (formData.gstNo) formDataPayload.append('gstNo', formData.gstNo);
        if (formData.tanNo) formDataPayload.append('tanNo', formData.tanNo);
        if (formData.cinNo) formDataPayload.append('cinNo', formData.cinNo);
        formDataPayload.append('attachCopy', attachCopyFile);

        const endpoint = mode === 'create' 
          ? '/api/sites' 
          : `/api/sites/${initial?.id}`;
        
        const response = await fetch(endpoint, {
          method: mode === 'create' ? 'POST' : 'PATCH',
          body: formDataPayload
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to save site`);
        }

        result = await response.json();
      } else {
        // Use JSON payload with custom API client
        const payload = {
          uinNo: formData.uinNo || null,
          site: formData.site,
          shortName: formData.shortName || null,
          companyId: formData.companyId || null,
          closed: formData.closed,
          permanentClosed: formData.permanentClosed,
          monitor: formData.monitor,
          contactPerson: formData.contactPerson || null,
          contactNo: formData.contactNo || null,
          addressLine1: formData.addressLine1 || null,
          addressLine2: formData.addressLine2 || null,
          stateId: formData.stateId || null,
          cityId: formData.cityId || null,
          pinCode: formData.pinCode || null,
          longitude: formData.longitude || null,
          latitude: formData.latitude || null,
          panNo: formData.panNo || null,
          gstNo: formData.gstNo || null,
          tanNo: formData.tanNo || null,
          cinNo: formData.cinNo || null,
        };
        
        result = mode === 'create' 
          ? await apiPost('/api/sites', payload)
          : await apiPatch(`/api/sites/${initial?.id}`, payload);
      }

      // Invalidate SWR cache to ensure fresh data
      if (mode === 'edit' && initial?.id) {
        // Invalidate the specific site cache
        mutate(`/api/sites/${initial.id}`);
      }
      // Invalidate the sites list cache
      mutate('/api/sites');

      toast.success(mode === 'create' ? 'Site created successfully' : 'Site updated successfully');
      onSuccess?.(result);
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save site');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Site' : 'Edit Site'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new site to the system.' : 'Update site information.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content className="space-y-6">
            {/* Site Details */}
            <FormSection legend='Site Details'>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='uinNo' 
                  label='UIN No' 
                  placeholder='Enter UIN number'
                />
                <TextInput 
                  control={control} 
                  name='site' 
                  label='Site' 
                  placeholder='Enter site name'
                  required
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='shortName' 
                  label='Short Name' 
                  placeholder='Enter short name'
                />
                <div>
                  <label className="block text-sm font-medium mb-2">Company</label>
                  <AppSelect
                    value={selectedCompanyId ? selectedCompanyId.toString() : '__none'}
                    onValueChange={(v) => setValue('companyId', v === '__none' ? null : Number(v))}
                    placeholder="Select company"
                  >
                    <AppSelect.Item value="__none">Select Company</AppSelect.Item>
                    {companies.map((company) => (
                      <AppSelect.Item key={company.id} value={company.id.toString()}>
                        {company.companyName}
                        {company.shortName && ` (${company.shortName})`}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </FormRow>
              <FormRow cols={3}>
                <AppCheckbox
                  label='Closed'
                  description='Mark this site as closed'
                  checked={closedValue}
                  onCheckedChange={(v) => setValue('closed', v)}
                />
                <AppCheckbox
                  label='Permanent Closed'
                  description='Mark this site as permanently closed'
                  checked={permanentClosedValue}
                  onCheckedChange={(v) => setValue('permanentClosed', v)}
                />
                <AppCheckbox
                  label='Monitor'
                  description='Enable monitoring for this site'
                  checked={monitorValue}
                  onCheckedChange={(v) => setValue('monitor', v)}
                />
              </FormRow>
            </FormSection>

            {/* Attach Copy Upload */}
            <FormSection legend='Attach Copy'>
              <div className="space-y-4">
                {previewUrl && (
                  <div className="flex items-center gap-4">
                    {attachCopyFile && attachCopyFile.type.startsWith('image/') ? (
                      <div className="relative h-16 w-16 border rounded-lg overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="Attach copy preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : initial?.attachCopyUrl && initial.attachCopyUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                      <div className="relative h-16 w-16 border rounded-lg overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="Attach copy preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 border rounded-lg flex items-center justify-center bg-gray-50">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <div className="text-sm text-muted-foreground">
                        File attached: {attachCopyFile?.name || 'Current file'}
                      </div>
                      <AppButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeAttachCopy}
                        iconName="X"
                      >
                        Remove File
                      </AppButton>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Attach Copy</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleAttachCopyChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG. Max size: 20MB
                  </p>
                </div>
              </div>
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
                  maxLength={6}
                  name='pinCode' 
                  label='Pin Code' 
                  placeholder='Enter pin code'
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput 
                  control={control} 
                  name='longitude' 
                  label='Longitude' 
                  placeholder='Enter longitude'
                />
                <TextInput 
                  control={control} 
                  name='latitude' 
                  label='Latitude' 
                  placeholder='Enter latitude'
                />
              </FormRow>
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
              {isCreate ? 'Create Site' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default SiteForm;
