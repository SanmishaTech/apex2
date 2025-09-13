'use client';

import { UnitForm } from '../unit-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewUnitPage() {
  useProtectPage();

  return (
    <UnitForm
      mode='create'
      redirectOnSuccess='/units'
    />
  );
}
