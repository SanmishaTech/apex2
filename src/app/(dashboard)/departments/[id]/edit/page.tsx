'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import DepartmentForm, { DepartmentFormInitialData } from '@/app/(dashboard)/departments/department-form';
import { Department } from '@/types/departments';

export default function EditDepartmentPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: dept, error, isLoading } = useSWR<Department>(
    id ? `/api/departments/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load department');
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!dept) {
    return <div className='p-6'>Department not found</div>;
  }

  const initialData: DepartmentFormInitialData = {
    id: dept.id,
    department: dept.department,
  };

  return (
    <DepartmentForm 
      mode='edit' 
      initial={initialData}
    />
  );
}
