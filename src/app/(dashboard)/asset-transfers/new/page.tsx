'use client';

import { useRouter } from 'next/navigation';
import { AssetTransferForm } from '@/components/forms/asset-transfer-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { toast } from '@/lib/toast';
import { apiPost } from '@/lib/api-client';
import { AssetTransferFormData } from '@/types/asset-transfers';

export default function NewAssetTransferPage() {
  useProtectPage();
  
  const router = useRouter();

  const handleSubmit = async (data: AssetTransferFormData) => {
    try {
      await apiPost('/api/asset-transfers', data);
      toast.success('Asset transfer created successfully');
      router.push('/asset-transfers');
    } catch (error) {
      console.error('Create error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create asset transfer';
      toast.error(message);
      throw error;
    }
  };

  const handleCancel = () => {
    router.push('/asset-transfers');
  };

  return (
    <div className="container mx-auto py-6">
      <AssetTransferForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
