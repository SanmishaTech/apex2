'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppSelect } from '@/components/common/app-select';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { formatDateForInput } from '@/lib/locales';
import { Plus, Trash2, Upload, File, Image, X, Eye } from 'lucide-react';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import type { SitesResponse } from '@/types/sites';
import type { CreateCashbookRequest, Cashbook, CashbookDetail } from '@/types/cashbooks';

// Temporary type until proper boqs types are created
interface Boq {
  id: number;
  boqNo?: string;
  workOrderNo?: string;
}

interface BoqsResponse {
  data: Boq[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CashbookFormInitialData {
  id?: number;
  voucherNo?: string | null;
  voucherDate?: string;
  siteId?: number | null;
  boqId?: number | null;
  attachVoucherCopyUrl?: string | null;
  cashbookDetails?: CashbookDetail[];
}

export interface CashbookFormProps {
  mode: 'create' | 'edit';
  initial?: CashbookFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/cashbooks'
}

const cashbookDetailSchema = z.object({
  cashbookHeadId: z.union([z.string(), z.number()])
    .transform(val => String(val))
    .refine(val => val !== '__none' && val !== '0' && val !== '', 'Cashbook head is required')
    .transform(val => parseInt(val)),
  description: z.string().optional(),
  openingQuantity: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => {
      if (!val || val === '' || val === '0') return null;
      return typeof val === 'string' ? parseFloat(val) || null : val;
    })
    .nullable(),
  closingQuantity: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => {
      if (!val || val === '' || val === '0') return null;
      return typeof val === 'string' ? parseFloat(val) || null : val;
    })
    .nullable(),
});

const createInputSchema = z.object({
  voucherDate: z.string().min(1, 'Voucher date is required'),
  siteId: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '__none' || val === '') return null;
      return typeof val === 'string' ? parseInt(val) : val;
    }),
  boqId: z.union([z.string(), z.number(), z.undefined(), z.null()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '__none' || val === '') return null;
      return typeof val === 'string' ? parseInt(val) : val;
    }),
  attachVoucherCopyUrl: z.string().optional(),
  cashbookDetails: z.array(cashbookDetailSchema).min(1, 'At least one cashbook detail is required'),
});

// Use the raw input type before Zod transformation for the form
type FormData = {
  voucherDate: string;
  siteId?: string | number;
  boqId?: string | number;
  attachVoucherCopyUrl?: string;
  cashbookDetails: {
    cashbookHeadId: string | number;
    description?: string;
    openingQuantity?: string | number | null;
    closingQuantity?: string | number | null;
  }[];
};

export function CashbookForm({ mode, initial, onSuccess, redirectOnSuccess = '/cashbooks' }: CashbookFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreview, setFilePreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { backWithScrollRestore } = useScrollRestoration('cashbooks-list');

  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(createInputSchema),
    defaultValues: {
      voucherDate: initial?.voucherDate ? formatDateForInput(initial.voucherDate) : formatDateForInput(new Date().toISOString()),
      siteId: initial?.siteId ? String(initial.siteId) : '__none',
      boqId: initial?.boqId ? String(initial.boqId) : '__none',
      attachVoucherCopyUrl: initial?.attachVoucherCopyUrl || '',
      cashbookDetails: initial?.cashbookDetails?.map(detail => ({
        cashbookHeadId: detail.cashbookHeadId ? String(detail.cashbookHeadId) : '__none',
        description: detail.description || '',
        openingQuantity: detail.openingQuantity || '',
        closingQuantity: detail.closingQuantity || '',
      })) || [{
        cashbookHeadId: '__none',
        description: '',
        openingQuantity: '',
        closingQuantity: '',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'cashbookDetails',
  });

  // Fetch sites, BOQs, and cashbook heads for dropdowns
  const { data: sitesData } = useSWR<SitesResponse>('/api/sites?perPage=100', apiGet);
  const { data: boqsData } = useSWR<BoqsResponse>('/api/boqs?perPage=100', apiGet);
  const { data: cashbookHeadsData } = useSWR<{ data: any[] }>('/api/cashbook-heads?perPage=100', apiGet);

  // Initialize file preview for existing file when editing
  useEffect(() => {
    if (initial?.attachVoucherCopyUrl && mode === 'edit') {
      // Set preview for existing file
      const fileUrl = initial.attachVoucherCopyUrl;
      const fileName = fileUrl.split('/').pop() || 'Attached File';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
      
      setFilePreview({
        url: fileUrl,
        type: isImage ? 'image' : 'document',
        name: fileName
      });
    }
  }, [initial?.attachVoucherCopyUrl, mode]);

  // File handling functions
  const handleFileSelect = (file: File, onChange: (value: string) => void) => {
    setCurrentFile(file);
    
    // Create preview
    const reader = new FileReader();
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      reader.onload = (e) => {
        if (e.target?.result) {
          setFilePreview({
            url: e.target.result as string,
            type: 'image',
            name: file.name
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview({
        url: '',
        type: 'document',
        name: file.name
      });
    }
    
    // Update form value - in a real app, you'd upload the file here
    onChange(file.name);
  };

  const removeFile = (onChange: (value: string) => void) => {
    setCurrentFile(null);
    setFilePreview(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImageFile = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
  };

  // Reset form values when initial data changes
  useEffect(() => {
    if (initial && mode === 'edit') {
      form.reset({
        voucherDate: initial.voucherDate ? formatDateForInput(initial.voucherDate) : formatDateForInput(new Date().toISOString()),
        siteId: initial.siteId ? String(initial.siteId) : '__none',
        boqId: initial.boqId ? String(initial.boqId) : '__none',
        attachVoucherCopyUrl: initial.attachVoucherCopyUrl || '',
        cashbookDetails: initial.cashbookDetails?.map(detail => ({
          cashbookHeadId: detail.cashbookHeadId ? String(detail.cashbookHeadId) : '__none',
          description: detail.description || '',
          openingQuantity: detail.openingQuantity || '',
          closingQuantity: detail.closingQuantity || '',
        })) || [{
          cashbookHeadId: '__none',
          description: '',
          openingQuantity: '',
          closingQuantity: '',
        }],
      });
    }
  }, [initial, mode, form]);

  const addDetail = () => {
    append({
      cashbookHeadId: '__none',
      description: '',
      openingQuantity: '',
      closingQuantity: '',
    });
  };

  const removeDetail = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      // Validate and transform using Zod schema
      const transformedData = createInputSchema.parse(values);
      
      const payload: CreateCashbookRequest = {
        voucherDate: transformedData.voucherDate,
        siteId: transformedData.siteId,
        boqId: transformedData.boqId,
        attachVoucherCopyUrl: transformedData.attachVoucherCopyUrl || null,
        cashbookDetails: transformedData.cashbookDetails.map(detail => ({
          cashbookHeadId: detail.cashbookHeadId,
          description: detail.description || null,
          openingQuantity: detail.openingQuantity,
          closingQuantity: detail.closingQuantity,
        })),
      };

      let result;
      if (mode === 'create') {
        result = await apiPost('/api/cashbooks', payload);
        toast.success('Cashbook created successfully');
      } else {
        result = await apiPatch(`/api/cashbooks/${initial?.id}`, payload);
        toast.success('Cashbook updated successfully');
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(redirectOnSuccess);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode} cashbook`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Render cashbook details table
  const renderDetailsTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium text-sm">Cashbook Head *</th>
            <th className="text-left p-2 font-medium text-sm">Description</th>
            <th className="text-left p-2 font-medium text-sm">Opening Quantity</th>
            <th className="text-left p-2 font-medium text-sm">Closing Quantity</th>
            <th className="text-center p-2 font-medium text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id} className="border-t">
              <td className="p-2">
                <FormField
                  control={form.control}
                  name={`cashbookDetails.${index}.cashbookHeadId`}
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <AppSelect value={String(field.value || '__none')} onValueChange={field.onChange}>
                          <AppSelect.Item value="__none">Select Cashbook Head</AppSelect.Item>
                          {cashbookHeadsData?.data?.map((head: any) => (
                            <AppSelect.Item key={head.id} value={head.id.toString()}>
                              {head.cashbookHeadName}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <div className="min-h-[16px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-2">
                <FormField
                  control={form.control}
                  name={`cashbookDetails.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Textarea {...field} placeholder="Enter description" className="min-h-[60px] text-sm" />
                      </FormControl>
                      <div className="min-h-[16px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-2">
                <FormField
                  control={form.control}
                  name={`cashbookDetails.${index}.openingQuantity`}
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" step="0.01" placeholder="0.00" className="text-sm" />
                      </FormControl>
                      <div className="min-h-[16px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-2">
                <FormField
                  control={form.control}
                  name={`cashbookDetails.${index}.closingQuantity`}
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" step="0.01" placeholder="0.00" className="text-sm" />
                      </FormControl>
                      <div className="min-h-[16px]">
                        <FormMessage className="text-xs" />
                      </div>
                    </FormItem>
                  )}
                />
              </td>
              <td className="p-2 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeDetail(index)}
                  disabled={fields.length <= 1}
                  className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 border-t bg-muted/25">
        <Button type="button" variant="outline" size="sm" onClick={addDetail} className="gap-2 h-8">
          <Plus className="h-3 w-3" />
          <span className="text-sm">Add Detail</span>
        </Button>
      </div>
    </div>
  );

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>{mode === 'create' ? 'Create Cashbook' : 'Edit Cashbook'}</AppCard.Title>
        <AppCard.Description>
          {mode === 'create' 
            ? 'Create a new cashbook voucher with details.'
            : 'Update cashbook voucher information.'}
        </AppCard.Description>
      </AppCard.Header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AppCard.Content className="space-y-6">
            {/* Header Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Header Section</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Voucher No (readonly for edit, placeholder for create) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voucher No</label>
                  <Input 
                    value={initial?.voucherNo || '<New Code>'}
                    disabled
                    className="bg-muted"
                  />
                </div>

                {/* Voucher Date */}
                <FormField
                  control={form.control}
                  name="voucherDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voucher Date *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Site */}
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <FormControl>
                        <AppSelect value={String(field.value || '__none')} onValueChange={field.onChange}>
                          <AppSelect.Item value="__none">Select Site</AppSelect.Item>
                          {sitesData?.data?.map((site) => (
                            <AppSelect.Item key={site.id} value={site.id.toString()}>
                              {site.site}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Bill of Quantity */}
                <FormField
                  control={form.control}
                  name="boqId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill of Quantity</FormLabel>
                      <FormControl>
                        <AppSelect value={String(field.value || '__none')} onValueChange={field.onChange}>
                          <AppSelect.Item value="__none">Select BOQ</AppSelect.Item>
                          {boqsData?.data?.map((boq) => (
                            <AppSelect.Item key={boq.id} value={boq.id.toString()}>
                              {boq.boqNo && boq.workOrderNo 
                                ? `${boq.boqNo} - ${boq.workOrderNo}` 
                                : boq.boqNo || boq.workOrderNo || `BOQ ${boq.id}`}
                            </AppSelect.Item>
                          ))}
                        </AppSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Attach Voucher Copy */}
              <FormField
                control={form.control}
                name="attachVoucherCopyUrl"
                render={({ field: { onChange, name, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Attach Voucher Copy</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {/* File Input */}
                        <div className="flex items-center gap-2">
                          <Input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileSelect(file, onChange);
                              }
                            }}
                            name={name}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                          />
                          {filePreview && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFile(onChange)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* File Preview */}
                        {filePreview && (
                          <div className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-start gap-3">
                              {filePreview.type === 'image' ? (
                                <div className="flex-shrink-0">
                                  <div className="w-24 h-24 border rounded overflow-hidden bg-muted">
                                    <img 
                                      src={filePreview.url} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // If image fails to load, show file icon instead
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-24 h-24 border rounded flex items-center justify-center bg-muted">
                                  <File className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{filePreview.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {filePreview.type === 'image' ? 'Image file' : 'Document file'}
                                </p>
                                
                                {/* Action buttons for existing files */}
                                {mode === 'edit' && initial?.attachVoucherCopyUrl && !currentFile && filePreview.type === 'image' && (
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(filePreview.url, '_blank')}
                                      className="h-7 text-xs"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View Full Size
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Upload hint */}
                        {!filePreview && (
                          <p className="text-xs text-muted-foreground">
                            Supported formats: PDF, JPG, JPEG, PNG, DOC, DOCX (Max 20MB)
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dynamic Cashbook Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cashbook Details</h3>
              {renderDetailsTable()}
            </div>
          </AppCard.Content>

          <AppCard.Footer className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => backWithScrollRestore()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <AppButton type="submit" isLoading={isSubmitting}>
              {mode === 'create' ? 'Create Cashbook' : 'Update Cashbook'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </Form>
    </AppCard>
  );
}
