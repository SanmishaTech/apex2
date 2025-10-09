'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { UnitForm, UnitFormInitialData } from '../../unit-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditUnitPage() {
  useProtectPage();

  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<UnitFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUnit() {
      try {
        const unit = await apiGet<UnitFormInitialData>(`/api/units/${id}`);
        setInitial(unit);
      } catch (error) {
        toast.error('Failed to load unit');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchUnit();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!initial) {
    return <div>Unit not found</div>;
  }

  return (
    <UnitForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/units'
    />
  );
}
