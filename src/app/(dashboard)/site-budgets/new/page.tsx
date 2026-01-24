'use client';

import { SiteBudgetsForm } from '../site-budgets-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewSiteBudgetPage() {
  useProtectPage();

  return (
    <SiteBudgetsForm
      mode='create'
      redirectOnSuccess='/site-budgets'
    />
  );
}
