'use client';

import { CashbookForm } from '../cashbook-form';
import { useProtectPage } from '@/hooks/use-protect-page';

export default function NewCashbookPage() {
  useProtectPage();

  return (
    <div className="container mx-auto py-6">
      <CashbookForm mode="create" />
    </div>
  );
}
