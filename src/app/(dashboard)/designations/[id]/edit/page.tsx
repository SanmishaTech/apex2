'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import DesignationForm, { DesignationFormInitialData } from '@/app/(dashboard)/designations/designation-form';
import type { Designation } from '@/types/designations';

export default function EditDesignationPage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data, error, isLoading, mutate } = useSWR<Designation>(
    id ? `/api/designations/${id}` : null,
    apiGet
  );

  const initialData = useMemo<DesignationFormInitialData | null>(() => {
    if (!data) return null;
    return {
      id: data.id,
      designationName: data.designationName,
    };
  }, [data]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load designation');
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load designation. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <DesignationForm 
      mode="edit"
      initial={initialData}
      mutate={mutate}
    />
  );
}
