'use client';

import { use } from 'react';
import { SiteBudgetForm } from '../../site-budget-form';

type AddSiteBudgetPageProps = {
  params: Promise<{ siteId: string }>;
};

export default function AddSiteBudgetPage({ params }: AddSiteBudgetPageProps) {
  const { siteId } = use(params);
  const siteIdNum = parseInt(siteId);

  return (
    <SiteBudgetForm 
      mode='create' 
      siteId={siteIdNum}
      redirectOnSuccess={`/site-budgets/${siteId}/view`}
    />
  );
}
