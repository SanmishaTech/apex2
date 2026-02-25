'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import {
  OverallSiteBudgetsForm,
  type OverallSiteBudgetsFormInitialData,
} from '../../../overall-site-budgets-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type ProjectApprovalOverallSiteBudgetPageProps = {
  params: Promise<{ siteId: string; id: string }>;
};

export default function ProjectApprovalOverallSiteBudgetPage({
  params,
}: ProjectApprovalOverallSiteBudgetPageProps) {
  useProtectPage();

  const { id } = use(params);

  const [initial, setInitial] = useState<OverallSiteBudgetsFormInitialData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverallSiteBudget() {
      try {
        const overallSiteBudget = await apiGet<OverallSiteBudgetsFormInitialData>(
          `/api/overall-site-budgets/${id}`
        );
        setInitial(overallSiteBudget);
      } catch {
        toast.error('Failed to load Overall Site Budget');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchOverallSiteBudget();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!initial) return <div>Overall Site Budget not found</div>;

  return (
    <OverallSiteBudgetsForm
      mode='projectApproval'
      initial={initial}
      redirectOnSuccess='/overall-site-budgets'
    />
  );
}
