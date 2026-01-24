'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type AddSiteBudgetPageProps = {
  params: Promise<{ siteId: string }>;
};

export default function AddSiteBudgetPage({ params }: AddSiteBudgetPageProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace('/site-budgets/new');
  }, [router]);

  return <div>Redirecting...</div>;
}
