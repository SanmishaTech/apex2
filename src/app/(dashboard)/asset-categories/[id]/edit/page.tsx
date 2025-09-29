'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AssetCategoryForm, type AssetCategoryFormInitialData } from '../../asset-category-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { AppCard } from '@/components/common/app-card';

export default function EditAssetCategoryPage() {
  useProtectPage();
  
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [initial, setInitial] = useState<AssetCategoryFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    async function fetchAssetCategory() {
      try {
        const data: AssetCategoryFormInitialData = await apiGet(`/api/asset-categories/${id}`);
        setInitial({
          id: data.id,
          category: data.category,
          assetGroupId: data.assetGroupId,
        });
      } catch (err) {
        toast.error((err as Error).message || 'Failed to load asset category');
      } finally {
        setLoading(false);
      }
    }

    fetchAssetCategory();
  }, [id]);

  if (loading) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className="flex justify-center items-center p-8">
            Loading...
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (!initial) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className="flex justify-center items-center p-8">
            Asset category not found
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AssetCategoryForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/asset-categories'
    />
  );
}

