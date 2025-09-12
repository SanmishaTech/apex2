'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ManpowerSupplierForm, { ManpowerSupplierInitialData } from '../../manpower-supplier-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditManpowerSupplierPage() {
  useProtectPage([PERMISSIONS.EDIT_MANPOWER_SUPPLIERS]);

  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<ManpowerSupplierInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecord() {
      try {
        const record = await apiGet(`/api/manpower-suppliers/${id}`);
        setInitial(record);
      } catch (error) {
        toast.error('Failed to load supplier');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchRecord();
  }, [id]);

  if (loading) return <div className='p-6'>Loading...</div>;
  if (!initial) return <div className='p-6'>Supplier not found</div>;

  return (
    <ManpowerSupplierForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/manpower-suppliers'
    />
  );
}
