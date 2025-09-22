'use client';

import { use } from 'react';
import { InlineBudgetManager } from '../../inline-budget-manager';

type ManageSiteBudgetPageProps = {
  params: Promise<{ siteId: string }>;
};

export default function ManageSiteBudgetPage({ params }: ManageSiteBudgetPageProps) {
  const { siteId } = use(params);
  const siteIdNum = parseInt(siteId);

  return (
    <InlineBudgetManager 
      siteId={siteIdNum}
    />
  );
}
