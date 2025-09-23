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

  const handleSubmit = async (data: AssetFormData) => {
    try {
      // Convert date strings to ISO format for API
      const submitData = {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : null,
      };

      const response = await fetch(`/api/assets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

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
