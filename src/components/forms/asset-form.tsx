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
      const submitData: AssetFormData = {
        ...formData,
        assetGroupId: formData.assetGroupId!,
        assetCategoryId: formData.assetCategoryId!,
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
