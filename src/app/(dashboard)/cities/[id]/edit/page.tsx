"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import CityForm, {
  CityFormInitialData,
} from "@/app/(dashboard)/cities/city-form";
import { City } from "@/types/cities";

export default function EditCityPage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const {
    data: city,
    error,
    isLoading,
    mutate,
  } = useSWR<City>(id ? `/api/cities/${id}` : null, apiGet);

  const initialData = useMemo<CityFormInitialData | null>(() => {
    if (!city) return null;
    if (city.stateId === null || city.stateId === undefined) {
      // Handle the case where stateId is null/undefined
      // You might want to set a default value or throw an error
      console.warn("City has no stateId");
      return null;
    }
    return {
      id: city.id,
      city: city.city,
      stateId: city.stateId, // Now we know this is a number
    };
  }, [city]);

  if (error) {
    toast.error((error as Error).message || "Failed to load city");
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Failed to load city. Please try again.
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return <CityForm mode="edit" initial={initialData} mutate={mutate} />;
}
