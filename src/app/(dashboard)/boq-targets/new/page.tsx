'use client';

import { BoqTargetsForm } from '../boq-targets-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewBoqTargetPage() {
  // Guard based on PAGE_ACCESS_RULES for '/boq-targets/new'
  useProtectPage();

  return (
    <BoqTargetsForm
      mode='create'
      redirectOnSuccess='/boq-targets'
    />
  );
}
