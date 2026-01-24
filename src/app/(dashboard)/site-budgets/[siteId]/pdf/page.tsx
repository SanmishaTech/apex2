'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SiteBudgetPdfPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/site-budgets');
  }, [router]);

  return <div>Redirecting...</div>;
}
