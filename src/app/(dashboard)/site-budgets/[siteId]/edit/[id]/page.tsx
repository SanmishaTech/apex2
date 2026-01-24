'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { SiteBudgetsForm, type SiteBudgetsFormInitialData } from '../../../site-budgets-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type EditSiteBudgetPageProps = {
  params: Promise<{ siteId: string; id: string }>;
};

export default function EditSiteBudgetPage({ params }: EditSiteBudgetPageProps) {
  useProtectPage();

  const { siteId, id } = use(params);

  const [initial, setInitial] = useState<SiteBudgetsFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSiteBudget() {
      try {
        const siteBudget = await apiGet<SiteBudgetsFormInitialData>(`/api/site-budgets/${id}`);
        setInitial(siteBudget);
      } catch {
        toast.error('Failed to load Site Budget');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchSiteBudget();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!initial) return <div>Site Budget not found</div>;

  return (
    <SiteBudgetsForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/site-budgets'
    />
  );
}
