'use client';

import { RentalCategoryForm } from '../rental-category-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { useSearchParams } from 'next/navigation';

export default function NewRentalCategoryPage() {
  useProtectPage();
  const searchParams = useSearchParams();
  const qs = searchParams ? searchParams.toString() : '';
  const redirectOnSuccess = qs
    ? `/rental-categories?${qs}`
    : '/rental-categories';

  return (
    <RentalCategoryForm
      mode='create'
      redirectOnSuccess={redirectOnSuccess}
    />
  );
}
