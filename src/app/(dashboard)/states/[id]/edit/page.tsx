'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import StateForm, { StateFormInitialData } from '@/app/(dashboard)/states/state-form';
import { State } from '@/types/states';

export default function EditStatePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data: state, error, isLoading, mutate } = useSWR<State>(
    id ? `/api/states/${id}` : null,
    apiGet
  );

  const initialData = useMemo<StateFormInitialData | null>(() => {
    if (!state) return null;
    return {
      id: state.id,
      state: state.state,
    };
  }, [state]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load state');
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load state. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <StateForm 
      mode="edit"
      initial={initialData}
      mutate={mutate}
    />
  );
}