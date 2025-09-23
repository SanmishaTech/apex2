'use client';

import { use } from 'react';
import useSWR from 'swr';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import AssetGroupForm from '../../asset-group-form';
import { AssetGroup } from '@/types/asset-groups';

interface EditAssetGroupPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAssetGroupPage({ params }: EditAssetGroupPageProps) {
  useProtectPage();
  
  const { id } = use(params);
  const assetGroupId = parseInt(id);
  const { data: assetGroup, error, isLoading } = useSWR<AssetGroup>(
    !isNaN(assetGroupId) ? `/api/asset-groups/${assetGroupId}` : null,
    apiGet
  );

  if (isLoading) return <div className='p-6'>Loading...</div>;
  if (isNaN(assetGroupId)) return <div className='p-6'>Invalid asset group ID</div>;
  if (error) return <div className='p-6'>Failed to load asset group</div>;
  if (!assetGroup) return <div className='p-6'>Asset group not found</div>;

  return (
    <AssetGroupForm 
      mode='edit' 
      initial={{
        id: assetGroup.id,
        assetGroup: assetGroup.assetGroup,
      }}
    />
  );
}
