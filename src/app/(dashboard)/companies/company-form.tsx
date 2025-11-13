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
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { CreateCompanyData, UpdateCompanyData } from '@/types/companies';
import { State } from '@/types/states';
import { City } from '@/types/cities';
import useSWR, { mutate } from 'swr';
import Image from 'next/image';
import { Upload, FileText, Trash2 } from 'lucide-react';
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
  const { backWithScrollRestore } = useScrollRestoration('companies-list');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.logoUrl || null);
  const [companyDocuments, setCompanyDocuments] = useState<Array<{ id?: number; documentName: string; documentUrl: string | File | null; _isNew?: boolean; _tempId?: number }>>([]);

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

  // Initialize documents from initial for edit mode
  useEffect(() => {
    if (initial && (initial as any).companyDocuments) {
      const docs = ((initial as any).companyDocuments as Array<any>).map((d) => ({
        id: d.id,
        documentName: d.documentName || '',
        documentUrl: d.documentUrl || '',
        _isNew: false,
      }));
      setCompanyDocuments(docs);
    }
  }, [initial]);

  const addEmptyDocument = () => {
    const tempId = -Date.now();
    setCompanyDocuments((prev) => [
      ...prev,
      { id: tempId, documentName: '', documentUrl: null, _isNew: true, _tempId: tempId },
    ]);
  };

  const removeDocumentAt = (index: number) => {
    setCompanyDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let result: unknown;

      const hasDocFiles = companyDocuments.some((d) => d.documentUrl instanceof File);
      const shouldUseFormData = !!logoFile || hasDocFiles;

      if (shouldUseFormData) {
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
        if (logoFile) formDataPayload.append('logo', logoFile);

        // Company documents metadata + files
        const docMetadata = companyDocuments.map((doc, index) => ({
          id: typeof doc.id === 'number' && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || '',
          documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
          index,
        }));
        formDataPayload.append('companyDocuments', JSON.stringify(docMetadata));
        companyDocuments.forEach((doc, index) => {
          if (doc.documentUrl instanceof File) {
            formDataPayload.append(`companyDocuments[${index}][documentFile]`, doc.documentUrl, doc.documentUrl.name);
          }
        });

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
        const payload: any = {
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

        // Include documents (string URLs only) in JSON mode
        payload.companyDocuments = companyDocuments.map((doc, index) => ({
          id: typeof doc.id === 'number' && doc.id > 0 ? doc.id : undefined,
          documentName: doc.documentName || '',
          documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
          index,
        }));
        
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

            {/* Documents */}
            <FormSection legend='Documents'>
              <div className="space-y-4">
                {companyDocuments.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No documents added.
                  </div>
                )}

                {companyDocuments.map((doc, index) => {
                  const inputId = `company-doc-${index}`;
                  const isFileObject = doc.documentUrl && typeof doc.documentUrl !== 'string' && (doc.documentUrl as File).name;
                  return (
                    <div key={(doc as any)._tempId ?? doc.id ?? index} className="rounded-2xl border p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-2 min-w-0">
                            <label className="text-sm font-semibold">Document Name<span className="text-red-500">*</span></label>
                            <input
                              className="mt-2 w-full rounded-lg border border-muted bg-background px-3 py-2 text-sm"
                              value={doc.documentName}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCompanyDocuments((prev) => prev.map((d, i) => i === index ? { ...d, documentName: v } : d));
                              }}
                              placeholder="e.g. Registration, PAN, GST"
                            />
                          </div>
                        </div>
                        <button type="button" className="text-destructive inline-flex items-center text-sm" onClick={() => removeDocumentAt(index)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold">File<span className="text-red-500">*</span></label>
                        <label htmlFor={inputId} className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{isFileObject ? (doc.documentUrl as File).name : 'Click to select a file'}</p>
                              <p className="text-xs text-muted-foreground">JPG, PNG, PDF up to 20 MB.</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">Browse</span>
                        </label>
                        <input id={inputId} type="file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setCompanyDocuments((prev) => prev.map((d, i) => i === index ? { ...d, documentUrl: file } : d));
                        }} />

                        {typeof doc.documentUrl === 'string' && doc.documentUrl && (
                          <div className="pt-2">
                            {(() => {
                              const url = doc.documentUrl as string;
                              const href = url.startsWith('/uploads/') ? `/api${url}` : (url.startsWith('http') ? url : `/api/documents/${url}`);
                              return (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">
                                  View existing
                                </a>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <button type="button" className="inline-flex items-center text-sm border rounded-md px-3 py-2" onClick={addEmptyDocument}>
                    <Upload className="h-4 w-4 mr-2" /> Add Document
                  </button>
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
              {isCreate ? 'Create Company' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default CompanyForm;
