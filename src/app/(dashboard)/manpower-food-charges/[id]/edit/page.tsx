"use client";

import { use } from "react";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { AppCard } from "@/components/common/app-card";
import { toast } from "@/lib/toast";
import { ManpowerFoodChargesForm } from "../../manpower-food-charges-form";

export default function EditManpowerFoodChargesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, error, isLoading } = useSWR<any>(
    `/api/manpower-food-charges/${id}`,
    apiGet
  );

  if (isLoading) {
    return (
      <AppCard>
        <AppCard.Content className="p-8 text-center text-muted-foreground">
          Loading Manpower Food Charges...
        </AppCard.Content>
      </AppCard>
    );
  }

  if (error || !data) {
    toast.error(error?.message || "Failed to load Manpower Food Charges");
    return (
      <AppCard>
        <AppCard.Content className="p-8 text-center text-destructive">
          Error loading Manpower Food Charges.
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <div className="py-4 space-y-4">
      <ManpowerFoodChargesForm mode="edit" initial={data} />
    </div>
  );
}
