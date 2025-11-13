'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppCard } from '@/components/common/app-card';
import { FormSection, FormRow } from '@/components/common/app-form';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { toast } from 'sonner';
import { z } from 'zod';
import { Asset, AssetFormData, AssetGroup, AssetCategory, ASSET_STATUS_OPTIONS, ASSET_USE_STATUS_OPTIONS } from '@/types/assets';
import { formatDateForInput } from '@/lib/locales';
import useSWR from 'swr';
import { Upload, FileText, Trash2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const assetSchema = z.object({
  assetGroupId: z.number().positive("Asset group is required"),
  assetCategoryId: z.number().positive("Asset category is required"),
  assetName: z.string().min(1, "Asset name is required"),
  make: z.string(),
  description: z.string(),
  purchaseDate: z.string(),
  invoiceNo: z.string(),
  supplier: z.string(),
  nextMaintenanceDate: z.string(),
  status: z.string().min(1, "Status is required"),
  useStatus: z.string().min(1, "Use status is required"),
});

interface AssetFormProps {
  asset?: Asset;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function AssetForm({ asset, onSubmit, onCancel, isSubmitting = false }: AssetFormProps) {
  const { backWithScrollRestore } = useScrollRestoration('assets-list');
  
  const [formData, setFormData] = useState<AssetFormData>({
    assetGroupId: asset?.assetGroupId || null,
    assetCategoryId: asset?.assetCategoryId || null,
    assetName: asset?.assetName || '',
    make: asset?.make || '',
    description: asset?.description || '',
    purchaseDate: asset?.purchaseDate ? formatDateForInput(asset.purchaseDate) : '',
    invoiceNo: asset?.invoiceNo || '',
    supplier: asset?.supplier || '',
    nextMaintenanceDate: asset?.nextMaintenanceDate ? formatDateForInput(asset.nextMaintenanceDate) : '',
    status: asset?.status || 'Working',
    useStatus: asset?.useStatus || 'In Use',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [assetDocuments, setAssetDocuments] = useState<Array<{ id?: number; documentName: string; documentUrl: string | File | null; _isNew?: boolean; _tempId?: number }>>(() => {
    return [];
  });

  const addEmptyDocument = () => {
    const tempId = -Date.now();
    setAssetDocuments((prev) => [
      ...prev,
      { id: tempId, documentName: '', documentUrl: null, _isNew: true, _tempId: tempId },
    ]);
  };

  const removeDocumentAt = (index: number) => {
    setAssetDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Initialize documents for edit mode
  useEffect(() => {
    if (asset && Array.isArray((asset as any).assetDocuments)) {
      const docs = (asset as any).assetDocuments.map((d: any) => ({
        id: d.id,
        documentName: d.documentName || '',
        documentUrl: d.documentUrl || '',
        _isNew: false,
      }));
      setAssetDocuments(docs);
    }
  }, [asset]);

  // Fetch asset groups
  const { data: assetGroupsData } = useSWR('/api/asset-groups?perPage=100', fetcher);
  const assetGroups: AssetGroup[] = assetGroupsData?.data || [];

  // Fetch asset categories based on selected asset group
  const assetGroupIdParam = formData.assetGroupId ? `assetGroupId=${formData.assetGroupId}` : '';
  const { data: assetCategoriesData } = useSWR(
    formData.assetGroupId ? `/api/asset-categories?perPage=100&${assetGroupIdParam}` : null,
    fetcher
  );
  const assetCategories: AssetCategory[] = assetCategoriesData?.data || [];

  // Reset asset category when asset group changes
  useEffect(() => {
    if (formData.assetGroupId && asset?.assetGroupId !== formData.assetGroupId) {
      setFormData(prev => ({ ...prev, assetCategoryId: null }));
    }
  }, [formData.assetGroupId, asset?.assetGroupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate required fields manually since some are optional
      const validationData = {
        ...formData,
        assetGroupId: formData.assetGroupId || 0,
        assetCategoryId: formData.assetCategoryId || 0,
      };

      const validatedData = assetSchema.parse(validationData);
      
      // Convert back to the correct format for submission
      const submitData: any = {
        ...formData,
        assetGroupId: formData.assetGroupId!,
        assetCategoryId: formData.assetCategoryId!,
        assetDocuments,
      };

      await onSubmit(submitData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error('Please correct the form errors');
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  };

  const handleCancel = () => {
    backWithScrollRestore();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <h2 className="text-lg font-semibold">
            {asset ? 'Edit Asset' : 'Create New Asset'}
          </h2>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {/* Asset Details Section */}
          <FormSection 
            legend="Asset Details" 
            description="Basic information about the asset"
          >
            {asset && (
              <FormRow>
                <div className="space-y-2">
                  <Label htmlFor="assetNo">Asset No</Label>
                  <Input
                    id="assetNo"
                    value={asset.assetNo}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </FormRow>
            )}

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label htmlFor="assetGroup">Asset Group *</Label>
                <Select
                  value={formData.assetGroupId?.toString() || ''}
                  onValueChange={(value) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      assetGroupId: value ? parseInt(value) : null 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset group" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.assetGroupName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assetGroupId && (
                  <p className="text-sm text-red-600">{errors.assetGroupId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assetCategory">Asset Category *</Label>
                <Select
                  value={formData.assetCategoryId?.toString() || ''}
                  onValueChange={(value) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      assetCategoryId: value ? parseInt(value) : null 
                    }))
                  }
                  disabled={!formData.assetGroupId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.assetGroupId 
                        ? "Select asset group first" 
                        : "Select asset category"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assetCategoryId && (
                  <p className="text-sm text-red-600">{errors.assetCategoryId}</p>
                )}
              </div>
            </FormRow>

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label htmlFor="assetName">Asset Name *</Label>
                <Input
                  id="assetName"
                  value={formData.assetName}
                  onChange={(e) => setFormData(prev => ({ ...prev, assetName: e.target.value }))}
                  placeholder="Enter asset name"
                />
                {errors.assetName && (
                  <p className="text-sm text-red-600">{errors.assetName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                  placeholder="Enter make/brand"
                />
              </div>
            </FormRow>

            <FormRow>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter asset description"
                  rows={3}
                />
              </div>
            </FormRow>
          </FormSection>

          {/* Documents Section */}
          <FormSection
            legend="Documents"
            description="Add one or more documents for this asset"
          >
            <div className="space-y-4">
              {assetDocuments.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No documents added.
                </div>
              )}

              {assetDocuments.map((doc, index) => {
                const inputId = `asset-doc-${index}`;
                const isFileObject = doc.documentUrl && typeof doc.documentUrl !== 'string' && (doc.documentUrl as File).name;
                return (
                  <div key={(doc as any)._tempId ?? doc.id ?? index} className="rounded-2xl border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="space-y-2 min-w-0">
                          <Label className="text-sm font-semibold">Document Name<span className="text-red-500">*</span></Label>
                          <Input
                            value={doc.documentName}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAssetDocuments((prev) => prev.map((d, i) => i === index ? { ...d, documentName: v } : d));
                            }}
                            placeholder="e.g. Invoice, Warranty"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeDocumentAt(index)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">File<span className="text-red-500">*</span></Label>
                      <label htmlFor={inputId} className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm shadow-sm transition hover:border-primary hover:bg-primary/5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{isFileObject ? (doc.documentUrl as File).name : 'Click to select a file'}</p>
                            <p className="text-xs text-muted-foreground">JPG, PNG, PDF up to 20 MB.</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary transition group-hover:border-primary group-hover:bg-primary/10">Browse</span>
                      </label>
                      <input id={inputId} type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setAssetDocuments((prev) => prev.map((d, i) => i === index ? { ...d, documentUrl: file } : d));
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
                <Button type="button" variant="outline" onClick={addEmptyDocument}>
                  <Upload className="h-4 w-4 mr-2" /> Add Document
                </Button>
              </div>
            </div>
          </FormSection>

          {/* Purchase Details Section */}
          <FormSection 
            legend="Purchase Details" 
            description="Purchase and maintenance information"
          >
            <FormRow cols={2}>
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceNo">Invoice No</Label>
                <Input
                  id="invoiceNo"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                  placeholder="Enter invoice number"
                />
              </div>
            </FormRow>

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="Enter supplier name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextMaintenanceDate">Next Maintenance Date</Label>
                <Input
                  id="nextMaintenanceDate"
                  type="date"
                  value={formData.nextMaintenanceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextMaintenanceDate: e.target.value }))}
                />
              </div>
            </FormRow>

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-sm text-red-600">{errors.status}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="useStatus">Use Status *</Label>
                <Select
                  value={formData.useStatus}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, useStatus: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select use status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_USE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.useStatus && (
                  <p className="text-sm text-red-600">{errors.useStatus}</p>
                )}
              </div>
            </FormRow>
          </FormSection>
        </AppCard.Content>

        <AppCard.Footer>
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </AppCard.Footer>
      </AppCard>
    </form>
  );
}
