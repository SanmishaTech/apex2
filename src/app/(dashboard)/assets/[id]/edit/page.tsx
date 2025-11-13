'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AssetForm } from '@/components/forms/asset-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { toast } from 'sonner';
import { Asset, AssetFormData } from '@/types/assets';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EditAssetPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAssetPage({ params }: EditAssetPageProps) {
  useProtectPage();
  
  const { id } = use(params);
  const router = useRouter();

  const { data: asset, error, isLoading } = useSWR<Asset>(
    id ? `/api/assets/${id}` : null,
    fetcher
  );

  const handleSubmit = async (data: any) => {
    try {
      const fd = new FormData();
      if (data.assetGroupId !== undefined) fd.append('assetGroupId', String(data.assetGroupId));
      if (data.assetCategoryId !== undefined) fd.append('assetCategoryId', String(data.assetCategoryId));
      if (data.assetName !== undefined) fd.append('assetName', data.assetName);
      if (data.make !== undefined) fd.append('make', data.make);
      if (data.description !== undefined) fd.append('description', data.description);
      if (data.purchaseDate !== undefined) fd.append('purchaseDate', data.purchaseDate || '');
      if (data.invoiceNo !== undefined) fd.append('invoiceNo', data.invoiceNo);
      if (data.supplier !== undefined) fd.append('supplier', data.supplier);
      if (data.invoiceCopyUrl !== undefined) fd.append('invoiceCopyUrl', data.invoiceCopyUrl);
      if (data.nextMaintenanceDate !== undefined) fd.append('nextMaintenanceDate', data.nextMaintenanceDate || '');
      if (data.status !== undefined) fd.append('status', data.status);
      if (data.useStatus !== undefined) fd.append('useStatus', data.useStatus);

      const docs = Array.isArray(data.assetDocuments) ? data.assetDocuments : [];
      const metadata = docs.map((doc: any, index: number) => ({
        id: typeof doc.id === 'number' ? doc.id : undefined,
        documentName: typeof doc.documentName === 'string' ? doc.documentName : undefined,
        documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
        index,
      }));
      fd.append('assetDocuments', JSON.stringify(metadata));
      docs.forEach((doc: any, index: number) => {
        if (doc?.documentUrl instanceof File) {
          fd.append(`assetDocuments[${index}][documentFile]`, doc.documentUrl, doc.documentUrl.name);
        }
      });

      const response = await fetch(`/api/assets/${id}`, { method: 'PATCH', body: fd });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update asset');
      }

      toast.success('Asset updated successfully');
      router.push('/assets');
    } catch (error) {
      console.error('Update asset error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update asset');
      throw error; // Re-throw to prevent form submission
    }
  };

  const handleCancel = () => {
    router.push('/assets');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading asset...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600">
              {error ? 'Failed to load asset' : 'Asset not found'}
            </p>
            <button
              onClick={() => router.push('/assets')}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              Back to Assets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <AssetForm
        asset={asset}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
