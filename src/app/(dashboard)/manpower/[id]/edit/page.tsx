'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ManpowerForm, { ManpowerInitialData } from '../../manpower-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditManpowerPage() {
  useProtectPage();

  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<ManpowerInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecord() {
      try {
        const record = await apiGet<ManpowerInitialData>(`/api/manpower/${id}`);
        setInitial(record);
      } catch (error) {
        toast.error('Failed to load manpower');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchRecord();
  }, [id]);

  if (loading) return <div className='p-6'>Loading...</div>;
  if (!initial) return <div className='p-6'>Manpower not found</div>;

  return (
    <ManpowerForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/manpower'
    />
  );
}
