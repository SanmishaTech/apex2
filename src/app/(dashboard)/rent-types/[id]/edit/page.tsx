'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import RentTypeForm, { RentTypeFormInitialData } from '@/app/(dashboard)/rent-types/rent-type-form';
import { RentType } from '@/types/rent-types';

export default function EditRentTypePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data: rentType, error, isLoading } = useSWR<RentType>(
    id ? `/api/rent-types/${id}` : null,
    apiGet
  );
  if (error) {
    toast.error((error as Error).message || 'Failed to load rent type');
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!rentType) {
    return <div className='p-6'>Rent type not found</div>;
  }

  const initialData: RentTypeFormInitialData = {
    id: rentType.id,
    rentType: rentType.rentType,
  };

  return (
    <RentTypeForm 
      mode='edit' 
      initial={initialData}
    />
  );
}
