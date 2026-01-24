'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ManageSiteBudgetPageProps = {
  params: Promise<{ siteId: string }>;
};

export default function ManageSiteBudgetPage({ params }: ManageSiteBudgetPageProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace('/site-budgets');
  }, [router]);

  return <div>Redirecting...</div>;
}
