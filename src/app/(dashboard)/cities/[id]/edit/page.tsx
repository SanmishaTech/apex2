'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import CityForm, { CityFormInitialData } from '@/app/(dashboard)/cities/city-form';
import { City } from '@/types/cities';

export default function EditCityPage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data: city, error, isLoading } = useSWR<City>(
    id ? `/api/cities/${id}` : null,
    apiGet
  );
  if (error) {
    toast.error((error as Error).message || 'Failed to load city');
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!city) {
    return <div className='p-6'>City not found</div>;
  }

  const initialData = {
    id: city.id,
    city: city.city,
    stateId: city.stateId,
  };

  return (
    <CityForm 
      mode='edit' 
      initial={initialData}
    />
  );
}
