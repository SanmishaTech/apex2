'use client';

import { UnitForm } from '../unit-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';

export default function NewUnitPage() {
  useProtectPage([PERMISSIONS.EDIT_UNITS]);

  return (
    <UnitForm
      mode='create'
      redirectOnSuccess='/units'
    />
  );
}
