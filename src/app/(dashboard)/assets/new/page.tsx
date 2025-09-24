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

  const handleSubmit = async (data: AssetFormData) => {
    try {
      // Convert date strings to ISO format for API
      const submitData = {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : undefined,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : undefined,
      };

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

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
