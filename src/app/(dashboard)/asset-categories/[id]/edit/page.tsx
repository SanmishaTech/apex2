'use client';

import { use } from 'react';
import useSWR from 'swr';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import AssetCategoryForm from '../../asset-category-form';
import { AssetCategory } from '@/types/asset-categories';

interface EditAssetCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAssetCategoryPage({ params }: EditAssetCategoryPageProps) {
  useProtectPage();
  
  const { id } = use(params);
  const assetCategoryId = parseInt(id);
  const { data: assetCategory, error, isLoading } = useSWR<AssetCategory>(
    !isNaN(assetCategoryId) ? `/api/asset-categories/${assetCategoryId}` : null,
    apiGet
  );

  if (isLoading) return <div className='p-6'>Loading...</div>;
  if (isNaN(assetCategoryId)) return <div className='p-6'>Invalid asset category ID</div>;
  if (error) return <div className='p-6'>Failed to load asset category</div>;
  if (!assetCategory) return <div className='p-6'>Asset category not found</div>;

  return (
    <AssetCategoryForm 
      mode='edit' 
      initial={{
        id: assetCategory.id,
        assetGroupId: assetCategory.assetGroupId,
        category: assetCategory.category,
      }}
    />
  );
}
