'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import StateForm, { StateFormInitialData } from '@/app/(dashboard)/states/state-form';
import { State } from '@/types/states';

export default function EditStatePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: state, error, isLoading } = useSWR<State>(
    id ? `/api/states/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load state');
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!state) {
    return <div className='p-6'>State not found</div>;
  }

  const initialData: StateFormInitialData = {
    id: state.id,
    state: state.state,
  };

  return (
    <StateForm 
      mode='edit' 
      initial={initialData}
    />
  );
}
