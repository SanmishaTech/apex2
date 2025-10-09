'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RentalCategoryForm, RentalCategoryFormInitialData } from '../../rental-category-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditRentalCategoryPage() {
  useProtectPage();

  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<RentalCategoryFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  const redirectOnSuccess = searchParams.toString()
    ? `/rental-categories?${searchParams.toString()}`
    : '/rental-categories';

  useEffect(() => {
    async function fetchData() {
      try {
        const rec = await apiGet<RentalCategoryFormInitialData>(`/api/rental-categories/${id}`);
        setInitial(rec);
      } catch (error) {
        toast.error('Failed to load rental category');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) return <div className='p-6'>Loading...</div>;
  if (!initial) return <div className='p-6'>Rental category not found</div>;

  return (
    <RentalCategoryForm
      mode='edit'
      initial={initial}
      redirectOnSuccess={redirectOnSuccess}
    />
  );
}
