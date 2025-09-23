'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import AssetGroupForm from '../asset-group-form';

export default function CreateAssetGroupPage() {
  useProtectPage();
  
  return <AssetGroupForm mode='create' />;
}
