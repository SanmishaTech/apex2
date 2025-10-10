'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProtectPage } from '@/hooks/use-protect-page';
import MinimumWageForm, { MinimumWageInitialData } from '../../minimum-wage-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditMinimumWagePage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;
  const [initial, setInitial] = useState<MinimumWageInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecord() {
      try {
        if (id) {
          const record = await apiGet<MinimumWageInitialData>(`/api/minimum-wages/${id}`);
          setInitial(record);
        }
      } catch (error) {
        toast.error('Failed to load minimum wage');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchRecord();
  }, [id]);

  if (loading) return <div className='p-6'>Loading...</div>;
  if (!initial) return <div className='p-6'>Minimum wage not found</div>;

  return (
    <MinimumWageForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/minimum-wages'
    />
  );
}
