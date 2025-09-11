'use client';

import { BoqForm } from '../boq-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewBoqPage() {
  // Guard based on PAGE_ACCESS_RULES for '/boqs/new'
  useProtectPage();

  return (
    <BoqForm
      mode='create'
      redirectOnSuccess='/boqs'
    />
  );
}
