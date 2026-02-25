'use client';

import { OverallSiteBudgetsForm } from '../overall-site-budgets-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewOverallSiteBudgetPage() {
  useProtectPage();

  return (
    <OverallSiteBudgetsForm
      mode='create'
      redirectOnSuccess='/overall-site-budgets'
    />
  );
}
