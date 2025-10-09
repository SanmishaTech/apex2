'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BoqTargetsForm, BoqTargetsFormInitialData } from '../../boq-targets-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditBoqTargetPage() {
  // Guard based on PAGE_ACCESS_RULES for '/boq-targets/:id/...'
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;
  const [initial, setInitial] = useState<BoqTargetsFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoqTarget() {
      try {
        const boqTarget = await apiGet<BoqTargetsFormInitialData>(`/api/boq-targets/${id}`);
        setInitial(boqTarget);
      } catch (error) {
        toast.error('Failed to load BOQ Target');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchBoqTarget();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!initial) {
    return <div>BOQ Target not found</div>;
  }

  return (
    <BoqTargetsForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/boq-targets'
    />
  );
}
