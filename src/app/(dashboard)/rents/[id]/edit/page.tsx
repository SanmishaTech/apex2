'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { RentForm } from '../../rent-form';
import { apiGet } from '@/lib/api-client';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import type { Rent } from '@/types/rents';

export default function EditRentPage() {
  useProtectPage();
  
  const params = useParams();
  const id = params.id as string;

  const { data: rent, error, isLoading } = useSWR<Rent>(
    id ? `/api/rents/${id}` : null,
    apiGet
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading rent...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          Failed to load rent: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!rent) {
    return (
      <div className="p-6">
        <div className="text-center">Rent not found</div>
      </div>
    );
  }

  return <RentForm mode="edit" initial={rent} />;
}
