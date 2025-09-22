'use client';

import { AssetCategoryForm } from '../asset-category-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewAssetCategoryPage() {
  useProtectPage();

  return (
    <AssetCategoryForm
      mode='create'
      redirectOnSuccess='/asset-categories'
    />
  );
}