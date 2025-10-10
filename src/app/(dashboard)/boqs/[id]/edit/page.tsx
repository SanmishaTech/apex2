'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BoqForm, BoqFormInitialData } from '../../boq-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditBoqPage() {
  // Guard based on PAGE_ACCESS_RULES for '/boqs/:id/...'
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;
  const [initial, setInitial] = useState<BoqFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoq() {
      try {
        if (id) {
          const boq = await apiGet<BoqFormInitialData>(`/api/boqs/${id}`);
          setInitial(boq);
        }
      } catch (error) {
        toast.error('Failed to load BOQ');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchBoq();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!initial) {
    return <div>BOQ not found</div>;
  }

  return (
    <BoqForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/boqs'
    />
  );
}
