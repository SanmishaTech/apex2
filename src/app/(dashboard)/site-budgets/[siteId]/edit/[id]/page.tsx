'use client';

import { use } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { SiteBudgetForm } from '../../../site-budget-form';
import { AppCard } from '@/components/common';

type EditSiteBudgetPageProps = {
  params: Promise<{ siteId: string; id: string }>;
};

export default function EditSiteBudgetPage({ params }: EditSiteBudgetPageProps) {
  const { siteId, id } = use(params);
  const { data: siteBudget, error, isLoading } = useSWR(`/api/site-budgets/${id}`, apiGet) as { data: any, error: any, isLoading: boolean };

  if (isLoading) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-muted-foreground'>Loading budget item...</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  if (error || !siteBudget) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='flex items-center justify-center py-8'>
            <div className='text-destructive'>Failed to load budget item</div>
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  const initialData = {
    id: siteBudget.id,
    siteId: siteBudget.siteId,
    itemId: siteBudget.itemId,
    budgetQty: siteBudget.budgetQty,
    budgetRate: siteBudget.budgetRate,
    purchaseRate: siteBudget.purchaseRate,
    orderedQty: siteBudget.orderedQty,
    avgRate: siteBudget.avgRate,
    qty50Alert: siteBudget.qty50Alert,
    value50Alert: siteBudget.value50Alert,
    qty75Alert: siteBudget.qty75Alert,
    value75Alert: siteBudget.value75Alert,
  };

  return (
    <SiteBudgetForm 
      mode='edit' 
      initial={initialData}
      redirectOnSuccess={`/site-budgets/${siteId}/view`}
    />
  );
}
