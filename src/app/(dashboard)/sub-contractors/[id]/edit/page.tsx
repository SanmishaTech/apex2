"use client";

import React from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
import { SubContractorForm } from "../../sub-contractor-form";
import { toast } from "@/lib/toast";

export default function EditSubContractorPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/sub-contractors/${id}` : null,
    apiGet
  );

  if (error) {
    toast.error("Failed to load sub contractor");
  }

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-red-500 font-medium">Sub Contractor not found</div>;

  return <SubContractorForm mode="edit" initial={data} mutate={mutate} />;
}
