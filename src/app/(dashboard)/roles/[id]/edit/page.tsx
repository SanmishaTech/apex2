'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import RoleForm, { RoleFormInitialData } from '@/app/(dashboard)/roles/role-form';

type RoleDetail = {
  id: number;
  name: string;
  description: string | null;
};

export default function EditRolePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { data, error, isLoading, mutate } = useSWR<RoleDetail>(
    id ? `/api/access-control/roles/${id}` : null,
    apiGet
  );

  const initialData = useMemo<RoleFormInitialData | null>(() => {
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      description: data.description,
    };
  }, [data]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load role');
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load role. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return <RoleForm mode="edit" initial={initialData} mutate={mutate} />;
}
