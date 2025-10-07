"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  DailyProgressForm,
  DailyProgressFormInitialData,
} from "../../daily-progress-form";
import { useProtectPage } from "@/hooks/use-protect-page";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export default function EditDpPage() {
  // Guard based on PAGE_ACCESS_RULES for '/boqs/:id/...'
  useProtectPage();

  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<DailyProgressFormInitialData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoq() {
      try {
        const boq = await apiGet(`/api/daily-progresses/${id}`);
        setInitial(boq);
      } catch (error) {
        toast.error("Failed to load Daily Progress");
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchBoq();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!initial) {
    return <div>Daily Progress not found</div>;
  }

  return (
    <DailyProgressForm
      mode="edit"
      initial={initial}
      redirectOnSuccess="/daily-progresses"
    />
  );
}
