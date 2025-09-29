'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AssetGroupForm, type AssetGroupFormInitialData } from '../../asset-group-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { AppCard } from '@/components/common/app-card';

export default function EditAssetGroupPage() {
  useProtectPage();
  
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [initial, setInitial] = useState<AssetGroupFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    async function fetchAssetGroup() {
      try {
        const data = await apiGet(`/api/asset-groups/${id}`) as {
          id: number;
          assetGroupName: string;
        };
        setInitial({
          id: data.id,
          assetGroupName: data.assetGroupName,
        });
      } catch (err) {
        toast.error((err as Error).message || 'Failed to load asset group');
      } finally {
        setLoading(false);
      }
    }

    fetchAssetGroup();
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
            Asset group not found
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AssetGroupForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/asset-groups'
    />
  );
}