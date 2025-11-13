'use client';

import { useRouter } from 'next/navigation';
import { AssetForm } from '@/components/forms/asset-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { toast } from 'sonner';
import { AssetFormData } from '@/types/assets';

export default function NewAssetPage() {
  useProtectPage();
  
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    try {
      const fd = new FormData();
      if (data.assetGroupId) fd.append('assetGroupId', String(data.assetGroupId));
      if (data.assetCategoryId) fd.append('assetCategoryId', String(data.assetCategoryId));
      if (data.assetName) fd.append('assetName', data.assetName);
      if (data.make) fd.append('make', data.make);
      if (data.description) fd.append('description', data.description);
      if (data.purchaseDate) fd.append('purchaseDate', data.purchaseDate);
      if (data.invoiceNo) fd.append('invoiceNo', data.invoiceNo);
      if (data.supplier) fd.append('supplier', data.supplier);
      if (data.invoiceCopyUrl) fd.append('invoiceCopyUrl', data.invoiceCopyUrl);
      if (data.nextMaintenanceDate) fd.append('nextMaintenanceDate', data.nextMaintenanceDate);
      if (data.status) fd.append('status', data.status);
      if (data.useStatus) fd.append('useStatus', data.useStatus);

      const docs = Array.isArray(data.assetDocuments) ? data.assetDocuments : [];
      const metadata = docs.map((doc: any, index: number) => ({
        id: typeof doc.id === 'number' ? doc.id : undefined,
        documentName: doc.documentName || '',
        documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
        index,
      }));
      fd.append('assetDocuments', JSON.stringify(metadata));
      docs.forEach((doc: any, index: number) => {
        if (doc?.documentUrl instanceof File) {
          fd.append(`assetDocuments[${index}][documentFile]`, doc.documentUrl, doc.documentUrl.name);
        }
      });

      const response = await fetch('/api/assets', { method: 'POST', body: fd });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create asset');
      }

      toast.success('Asset created successfully');
      router.push('/assets');
    } catch (error) {
      console.error('Create asset error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create asset');
      throw error; // Re-throw to prevent form submission
    }
  };

  const handleCancel = () => {
    router.push('/assets');
  };

  return (
    <div className="container mx-auto py-6">
      <AssetForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
