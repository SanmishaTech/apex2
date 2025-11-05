"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import DepartmentForm, {
  DepartmentFormInitialData,
} from "@/app/(dashboard)/departments/department-form";
import { Department } from "@/types/departments";

export default function EditDepartmentPage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const {
    data: dept,
    error,
    isLoading,
    mutate,
  } = useSWR<Department>(id ? `/api/departments/${id}` : null, apiGet);

  const initialData = useMemo<DepartmentFormInitialData | null>(() => {
    if (!dept) return null;
    return {
      id: dept.id,
      department: dept.department,
    };
  }, [dept]);

  if (error) {
    toast.error((error as Error).message || "Failed to load department");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load department. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return <DepartmentForm mode="edit" initial={initialData} mutate={mutate} />;
}
