'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import AssetCategoryForm from '../asset-category-form';

export default function CreateAssetCategoryPage() {
  useProtectPage();
  
  return <AssetCategoryForm mode='create' />;
}
