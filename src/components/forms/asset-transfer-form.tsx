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
import { AssetTransfer, AssetTransferFormData, ASSET_TRANSFER_TYPE_OPTIONS } from '@/types/asset-transfers';
import { Site } from '@/types/sites';
import { Asset } from '@/types/assets';
import { formatDateForInput } from '@/lib/locales';
import { Badge } from '@/components/ui/badge';
import { X, Upload, FileText } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const assetTransferSchema = z.object({
  transferType: z.string().min(1, "Transfer type is required"),
  challanDate: z.string().min(1, "Challan date is required"),
  fromSiteId: z.number().nullable(),
  toSiteId: z.number().positive("To site is required"),
  assetIds: z.array(z.number()).min(1, "At least one asset must be selected"),
  challanCopyUrl: z.string().optional(),
  remarks: z.string().optional(),
});

interface AssetTransferFormProps {
  assetTransfer?: AssetTransfer;
  onSubmit: (data: AssetTransferFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  viewOnly?: boolean;
}

export function AssetTransferForm({ assetTransfer, onSubmit, onCancel, isSubmitting = false, viewOnly = false }: AssetTransferFormProps) {
  const { backWithScrollRestore } = useScrollRestoration('asset-transfers-list');
  
  const [formData, setFormData] = useState<AssetTransferFormData>({
    transferType: assetTransfer?.transferType || 'New Assign',
    challanDate: assetTransfer?.challanDate ? formatDateForInput(assetTransfer.challanDate) : formatDateForInput(new Date().toISOString()),
    fromSiteId: assetTransfer?.fromSiteId || null,
    toSiteId: assetTransfer?.toSiteId || null,
    assetIds: assetTransfer?.transferItems?.map(item => item.assetId) || [],
    challanCopyUrl: assetTransfer?.challanCopyUrl || '',
    remarks: assetTransfer?.remarks || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch sites
  const { data: sitesData } = useSWR('/api/sites?perPage=100', fetcher);
  const sites: Site[] = sitesData?.data || [];

  // Fetch assets (only for new transfers, not when viewing existing ones)
  const shouldFetchAssets = !viewOnly && !assetTransfer;
  const assetQuery = shouldFetchAssets ? (
    formData.transferType === 'New Assign' 
      ? 'transferStatus=Available&perPage=100' // Only available assets can be newly assigned
      : formData.fromSiteId ? `transferStatus=Assigned&currentSiteId=${formData.fromSiteId}&perPage=100` : null // Only assigned assets at the from site can be transferred
  ) : null;

  const { data: assetsData } = useSWR(
    assetQuery ? `/api/assets?${assetQuery}` : null,
    fetcher
  );
  const assets: Asset[] = assetsData?.data || [];

  // Reset relevant fields when transfer type changes
  useEffect(() => {
    if (formData.transferType === 'New Assign') {
      // When switching to New Assign, clear fromSiteId and selected assets
      setFormData(prev => {
        // Only clear if there were actually fields to clear (avoid initial render)
        if (prev.fromSiteId !== null || prev.assetIds.length > 0) {
          return {
            ...prev,
            fromSiteId: null,
            assetIds: []
          };
        }
        return prev;
      });
    } else if (formData.transferType === 'Transfer') {
      // When switching to Transfer, clear selected assets
      setFormData(prev => {
        // Only clear if there were assets selected (avoid initial render)
        if (prev.assetIds.length > 0) {
          return {
            ...prev,
            assetIds: []
          };
        }
        return prev;
      });
    }
  }, [formData.transferType]);

  // Reset assets when from site changes (for Transfer type)
  useEffect(() => {
    if (formData.transferType === 'Transfer' && formData.fromSiteId) {
      setFormData(prev => ({
        ...prev,
        assetIds: []
      }));
    }
  }, [formData.fromSiteId, formData.transferType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = assetTransferSchema.parse({
        ...formData,
        toSiteId: formData.toSiteId || 0,
      });
      
      await onSubmit(formData);
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
      }
    }
  };

  const handleCancel = () => {
    backWithScrollRestore();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size must be less than 20MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPEG, and PNG files are allowed');
      return;
    }

    setUploadedFile(file);
    setUploading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'document');
      uploadFormData.append('prefix', 'challan');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setFormData(prev => ({ ...prev, challanCopyUrl: result.url }));
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <h2 className="text-lg font-semibold">
            {viewOnly ? 'View Asset Transfer' : assetTransfer ? 'Edit Asset Transfer' : 'Create New Asset Transfer'}
          </h2>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          <FormSection legend="Transfer Details">
            <FormRow cols={2}>
              <div className="space-y-2">
                <Label>Transfer Type *</Label>
                <Select
                  value={formData.transferType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, transferType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TRANSFER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transferType && <p className="text-sm text-red-600">{errors.transferType}</p>}
              </div>

              <div className="space-y-2">
                <Label>Challan Date *</Label>
                <Input
                  type="date"
                  value={formData.challanDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, challanDate: e.target.value }))}
                />
                {errors.challanDate && <p className="text-sm text-red-600">{errors.challanDate}</p>}
              </div>
            </FormRow>

            <FormRow cols={2}>
              <div className="space-y-2">
                <Label>From Site {formData.transferType === 'Transfer' && '*'}</Label>
                <Select
                  value={formData.fromSiteId?.toString() || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fromSiteId: value ? parseInt(value) : null }))}
                  disabled={formData.transferType === 'New Assign'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.site}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fromSiteId && <p className="text-sm text-red-600">{errors.fromSiteId}</p>}
              </div>

              <div className="space-y-2">
                <Label>To Site *</Label>
                <Select
                  value={formData.toSiteId?.toString() || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, toSiteId: value ? parseInt(value) : null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select to site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.filter(site => site.id !== formData.fromSiteId).map((site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.site}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.toSiteId && <p className="text-sm text-red-600">{errors.toSiteId}</p>}
              </div>
            </FormRow>
          </FormSection>

          <FormSection legend="Asset Selection">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Assets *</Label>
                <Select onValueChange={(value) => {
                  const assetId = parseInt(value);
                  if (!formData.assetIds.includes(assetId)) {
                    setFormData(prev => ({ ...prev, assetIds: [...prev.assetIds, assetId] }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assets to transfer" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.filter(asset => !formData.assetIds.includes(asset.id)).map((asset) => (
                      <SelectItem key={asset.id} value={asset.id.toString()}>
                        {asset.assetNo} - {asset.assetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assetIds && <p className="text-sm text-red-600">{errors.assetIds}</p>}
              </div>

              {formData.assetIds.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Assets ({formData.assetIds.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.assetIds.map((assetId) => {
                      const asset = assets.find(a => a.id === assetId);
                      return asset ? (
                        <Badge key={assetId} variant="secondary" className="flex items-center gap-1">
                          {asset.assetNo} - {asset.assetName}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => setFormData(prev => ({ 
                              ...prev, 
                              assetIds: prev.assetIds.filter(id => id !== assetId) 
                            }))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </FormSection>

          <FormSection legend="File Upload">
            <FormRow>
              <div className="space-y-2">
                <Label>Challan Copy</Label>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-sm text-gray-500">
                    Upload challan copy (PDF, JPEG, PNG - Max 20MB)
                  </p>
                  {uploading && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Upload className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                  {formData.challanCopyUrl && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700">File uploaded successfully</span>
                    </div>
                  )}
                </div>
              </div>
            </FormRow>
          </FormSection>

          <FormSection legend="Additional Details">
            <FormRow>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter any additional remarks"
                  rows={3}
                />
              </div>
            </FormRow>
          </FormSection>
        </AppCard.Content>

        <AppCard.Footer>
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
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
