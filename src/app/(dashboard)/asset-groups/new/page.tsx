'use client';


import { AssetGroupForm } from '../asset-group-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewAssetGroupPage() {
  useProtectPage();

  return (
    <AssetGroupForm
      mode='create'
      redirectOnSuccess='/asset-groups'
    />
  );
}
