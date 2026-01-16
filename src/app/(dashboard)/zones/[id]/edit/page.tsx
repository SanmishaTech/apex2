'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import ZoneForm, { ZoneFormInitialData } from '@/app/(dashboard)/zones/zone-form';
import type { Zone } from '@/types/zones';

export default function EditZonePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data, error, isLoading, mutate } = useSWR<Zone>(id ? `/api/zones/${id}` : null, apiGet);

  const initialData = useMemo<ZoneFormInitialData | null>(() => {
    if (!data) return null;
    return {
      id: data.id,
      zoneName: data.zoneName,
    };
  }, [data]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load zone');
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Failed to load zone. Please try again.</div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return <ZoneForm mode="edit" initial={initialData} mutate={mutate} />;
}
